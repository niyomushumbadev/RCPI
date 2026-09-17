// R-CPI deadline monitor tests
// Run: npx tsx tests/deadline.test.ts
import { deadlinePhase, isActiveForDeadline, APPROACHING_WINDOW_HOURS, NOTIFY_COOLDOWN_HOURS } from '../src/services/deadline.service';

let pass = 0;
let fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const same = JSON.stringify(got) === JSON.stringify(want);
  if (same) pass++;
  else {
    failCount++;
    console.error(`FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
}
let failCount = 0;

const NOW = new Date('2026-09-17T12:00:00Z');

// Phase classification
eq('deadline 6 months out → NONE', deadlinePhase(new Date('2027-03-17T12:00:00Z'), NOW), 'NONE');
eq('deadline in 47h → APPROACHING', deadlinePhase(new Date(NOW.getTime() + 47 * 3600e3), NOW), 'APPROACHING');
eq('deadline exactly at 48h boundary → APPROACHING', deadlinePhase(new Date(NOW.getTime() + APPROACHING_WINDOW_HOURS * 3600e3), NOW), 'APPROACHING');
eq('deadline in 49h → NONE', deadlinePhase(new Date(NOW.getTime() + 49 * 3600e3), NOW), 'NONE');
eq('deadline 1h ago → OVERDUE', deadlinePhase(new Date(NOW.getTime() - 3600e3), NOW), 'OVERDUE');
eq('deadline 30 days ago → OVERDUE', deadlinePhase(new Date(NOW.getTime() - 30 * 86400e3), NOW), 'OVERDUE');

// Active filtering
eq('IN_PROGRESS is active', isActiveForDeadline('IN_PROGRESS'), true);
eq('ASSIGNED is active', isActiveForDeadline('ASSIGNED'), true);
eq('ESCALATED is active', isActiveForDeadline('ESCALATED'), true);
eq('CLOSED is terminal', isActiveForDeadline('CLOSED'), false);
eq('REJECTED is terminal', isActiveForDeadline('REJECTED'), false);
eq('ARCHIVED is terminal', isActiveForDeadline('ARCHIVED'), false);

// Window constants documented by test
eq('approaching window is 48h', APPROACHING_WINDOW_HOURS, 48);
eq('cooldown is 24h', NOTIFY_COOLDOWN_HOURS, 24);

console.log(`Deadline tests: ${pass} passed, ${failCount} failed`);
if (failCount) process.exit(1);
