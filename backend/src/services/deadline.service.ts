// ─────────────────────────────────────────────────────────────
// R-CPI deadline monitor (spec §13: deadline approaching / overdue)
//
// A periodic scan (every 30 min + once at boot) checks every active
// report with a deadline and warns the responsible officer(s):
//   • APPROACHING — deadline within the next 48h
//   • OVERDUE     — deadline has passed and the report is still open
// Re-notification is rate-limited per report+type (24h cooldown) by
// checking the notification history, so officers get one reminder per
// day at most, and the scan is safe to run repeatedly.
// ─────────────────────────────────────────────────────────────
import { prisma } from '../config/db';
import { notify } from './notification.service';

/** Reports whose deadline is within this many hours are "approaching". */
export const APPROACHING_WINDOW_HOURS = 48;
/** Minimum gap between two notifications of the same type for one report. */
export const NOTIFY_COOLDOWN_HOURS = 24;

export type DeadlinePhase = 'APPROACHING' | 'OVERDUE' | 'NONE';

/** Pure: classify a deadline against a reference time. */
export function deadlinePhase(deadline: Date, now: Date = new Date()): DeadlinePhase {
  const hoursUntil = (deadline.getTime() - now.getTime()) / 3_600_000;
  if (hoursUntil < 0) return 'OVERDUE';
  if (hoursUntil <= APPROACHING_WINDOW_HOURS) return 'APPROACHING';
  return 'NONE';
}

/** Statuses that no longer need deadline reminders. */
const TERMINAL_STATUSES = ['CLOSED', 'REJECTED', 'ARCHIVED'];

/** Pure: only open reports need deadline warnings. */
export function isActiveForDeadline(status: string): boolean {
  return !TERMINAL_STATUSES.includes(status);
}

/** True if this report was already warned about `type` within the cooldown. */
async function recentlyNotified(
  reportId: number,
  type: 'DEADLINE_APPROACHING' | 'REPORT_OVERDUE',
  now: Date
): Promise<boolean> {
  const since = new Date(now.getTime() - NOTIFY_COOLDOWN_HOURS * 3_600_000);
  const found = await prisma.notification.findFirst({
    where: { reportId, type, createdAt: { gte: since } },
    select: { id: true },
  });
  return Boolean(found);
}

/**
 * Who receives the warning: the assigned officer/administrator when there is
 * one; otherwise every active officer/admin in the report's district.
 */
async function resolveRecipients(report: {
  assignedOfficerId: number | null;
  districtId: number | null;
}): Promise<number[]> {
  if (report.assignedOfficerId) return [report.assignedOfficerId];
  if (!report.districtId) return [];
  const officers = await prisma.user.findMany({
    where: {
      isActive: true,
      districtId: report.districtId,
      role: { name: { in: ['SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN'] } },
    },
    select: { id: true },
    take: 5,
  });
  return officers.map((o) => o.id);
}

function messageFor(phase: Exclude<DeadlinePhase, 'NONE'>, report: { reference: string; title: string; deadline: Date }): { title: string; message: string } {
  const due = report.deadline.toISOString().slice(0, 10);
  if (phase === 'APPROACHING') {
    return {
      title: 'Deadline approaching',
      message: `${report.reference} (${report.title.slice(0, 60)}) is due on ${due}. Please progress the work or extend the deadline with a reason.`,
    };
  }
  return {
    title: 'Report overdue',
    message: `${report.reference} (${report.title.slice(0, 60)}) passed its ${due} deadline and is still open. Escalate or re-plan the work.`,
  };
}

/**
 * One scan pass over all open reports with a deadline.
 * Returns counters for logging and the manual admin trigger.
 */
export async function runDeadlineScan(now: Date = new Date()): Promise<{
  scanned: number;
  approaching: number;
  overdue: number;
}> {
  const candidates = await prisma.report.findMany({
    where: {
      deadline: { not: null },
      isArchived: false,
      status: { notIn: TERMINAL_STATUSES },
    },
    select: {
      id: true,
      reference: true,
      title: true,
      status: true,
      deadline: true,
      assignedOfficerId: true,
      districtId: true,
    },
  });

  let approaching = 0;
  let overdue = 0;

  for (const report of candidates) {
    if (!isActiveForDeadline(report.status)) continue;
    const phase = deadlinePhase(report.deadline!, now);
    if (phase === 'NONE') continue;

    const type = phase === 'APPROACHING' ? 'DEADLINE_APPROACHING' : 'REPORT_OVERDUE';
    if (await recentlyNotified(report.id, type, now)) continue;

    const recipients = await resolveRecipients(report);
    const { title, message } = messageFor(phase, { reference: report.reference, title: report.title, deadline: report.deadline! });
    for (const userId of recipients) {
      await notify({ userId, type, title, message, reportId: report.id });
    }
    if (phase === 'APPROACHING') approaching++;
    else overdue++;
  }

  return { scanned: candidates.length, approaching, overdue };
}

// ─── Scheduler ────────────────────────────────────────────────

const SCAN_INTERVAL_MS = 30 * 60 * 1000; // every 30 minutes
let scanInFlight = false;
let timer: ReturnType<typeof setInterval> | null = null;

async function guardedScan(): Promise<void> {
  if (scanInFlight) return; // never overlap passes
  scanInFlight = true;
  try {
    const result = await runDeadlineScan();
    if (result.approaching || result.overdue) {
      console.log(`⏰ deadline scan: ${result.approaching} approaching, ${result.overdue} overdue (of ${result.scanned} with deadlines)`);
    }
  } catch (err) {
    console.error('[deadline-scan] failed:', err);
  } finally {
    scanInFlight = false;
  }
}

/** Start the periodic scan (run once at boot, then every 30 min). */
export function startDeadlineScheduler(): void {
  if (timer) return;
  void guardedScan(); // initial pass shortly after boot
  timer = setInterval(() => void guardedScan(), SCAN_INTERVAL_MS);
  timer.unref?.();
}

/** Stop the scheduler (used by graceful shutdown / tests). */
export function stopDeadlineScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
