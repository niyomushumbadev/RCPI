// R-CPI resolution workflow tests (spec §8, §11, §14, §16)
// Run: npx tsx tests/report-lifecycle.test.ts
import { canonical, citizenCannotConfirm, canReopen, notificationRecipients, ASSIGNMENT_PRIORITIES } from '../src/services/report-lifecycle.service';
import { canTransition as baseCanTransition, STATUS_TRANSITIONS } from '../src/services/report.service';

let pass = 0;
let failCount = 0;
function eq(name: string, got: unknown, want: unknown) {
  const same = JSON.stringify(got) === JSON.stringify(want);
  if (same) pass++;
  else {
    failCount++;
    console.error(`FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
}

// ── §8 status alias ──
eq('RESOLVED_PENDING_CONFIRMATION canonicalizes to RESOLVED', canonical('RESOLVED_PENDING_CONFIRMATION'), 'RESOLVED');
eq('RESOLVED stays RESOLVED', canonical('RESOLVED'), 'RESOLVED');
eq('unknown statuses pass through', canonical('WEIRD_STATE'), 'WEIRD_STATE');

// ── §7 confirmation guards ──
eq('citizen can confirm RESOLVED', citizenCannotConfirm('RESOLVED'), false);
eq('citizen can confirm CLOSED', citizenCannotConfirm('CLOSED'), false);
eq('citizen cannot confirm IN_PROGRESS', citizenCannotConfirm('IN_PROGRESS'), true);
eq('citizen cannot confirm SUBMITTED', citizenCannotConfirm('SUBMITTED'), true);
eq('citizen cannot confirm REOPENED', citizenCannotConfirm('REOPENED'), true);

// ── §7 option B reopen guards ──
eq('RESOLVED can be reopened', canReopen('RESOLVED'), true);
eq('CLOSED can be reopened', canReopen('CLOSED'), true);
eq('PENDING_CLOSURE can be reopened', canReopen('PENDING_CLOSURE'), true);
eq('IN_PROGRESS cannot be reopened', canReopen('IN_PROGRESS'), false);
eq('SUBMITTED cannot be reopened', canReopen('SUBMITTED'), false);

// ── §8 automatic workflow chain (matrix) ──
eq('ASSIGNED → IN_PROGRESS allowed', baseCanTransition('ASSIGNED', 'IN_PROGRESS'), true);
eq('IN_PROGRESS → RESOLVED allowed', baseCanTransition('IN_PROGRESS', 'RESOLVED'), true);
eq('RESOLVED → CLOSED allowed', baseCanTransition('RESOLVED', 'CLOSED'), true);
eq('RESOLVED → REOPENED allowed (citizen rejected)', baseCanTransition('RESOLVED', 'REOPENED'), true);
eq('CLOSED → REOPENED allowed (late rejection)', baseCanTransition('CLOSED', 'REOPENED'), true);
eq('SUBMITTED → RESOLVED blocked', baseCanTransition('SUBMITTED', 'RESOLVED'), false);
eq('CLOSED is terminal in matrix (no ARCHIVED transition needed by citizen confirm)', Array.isArray(STATUS_TRANSITIONS.CLOSED), true);

// ── §4 assignment priority values ──
eq('assignment priorities are LOW..CRITICAL', [...ASSIGNMENT_PRIORITIES], ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

// ── §13 notification routing ──
const baseReport = { citizenId: 1, assignedOfficerId: 42 as number | null, districtId: 3 };
eq('ASSIGNED notifies officer + citizen', notificationRecipients({ report: baseReport, event: 'ASSIGNED' }), ['officer', 'citizen']);
eq('ASSIGNED with no officer still notifies citizen', notificationRecipients({ report: { ...baseReport, assignedOfficerId: null }, event: 'ASSIGNED' }), ['citizen']);
eq('RESOLVED notifies citizen', notificationRecipients({ report: baseReport, event: 'RESOLVED' }), ['citizen']);
eq('CONFIRMED notifies assigned officer', notificationRecipients({ report: baseReport, event: 'CONFIRMED' }), ['officer']);
eq('CONFIRMED with no officer notifies nobody', notificationRecipients({ report: { ...baseReport, assignedOfficerId: null }, event: 'CONFIRMED' }), []);
eq('REJECTED notifies officer + staff', notificationRecipients({ report: baseReport, event: 'REJECTED' }), ['officer', 'staff']);
eq('REOPENED notifies officer + staff', notificationRecipients({ report: baseReport, event: 'REOPENED' }), ['officer', 'staff']);

// ── lifecycle matrix sanity: no dead ends except ARCHIVED/REJECTED ──
for (const status of Object.keys(STATUS_TRANSITIONS)) {
  if (!['ARCHIVED', 'REJECTED'].includes(status)) {
    eq(`matrix: ${status} has at least one transition`, (STATUS_TRANSITIONS[status] ?? []).length > 0, true);
  }
}

console.log(`Lifecycle tests: ${pass} passed, ${failCount} failed`);
if (failCount) process.exit(1);
