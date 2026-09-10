// R-CPI Task 3 — backend contract tests (ADDITIVE, spec §69)
// Pure matrix/validation tests. Run: npx tsx tests/report.task3.test.ts
import { canTransition as base } from '../src/services/report.service';
import { canTransition } from '../src/services/report-status.service';
import { createReportSchema, rejectSchema, reopenSchema } from '../src/validators/report.validator';

let pass = 0; let failCount = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { failCount++; console.error(`FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
}

// §23 matrix
eq('SUBMITTED->UNDER_REVIEW', base('SUBMITTED', 'UNDER_REVIEW'), true);
eq('UNDER_REVIEW->VERIFIED', base('UNDER_REVIEW', 'VERIFIED'), true);
eq('UNDER_REVIEW->REJECTED', base('UNDER_REVIEW', 'REJECTED'), true);
eq('VERIFIED->ASSIGNED', base('VERIFIED', 'ASSIGNED'), true);
eq('ASSIGNED->IN_PROGRESS', base('ASSIGNED', 'IN_PROGRESS'), true);
eq('IN_PROGRESS->RESOLVED', base('IN_PROGRESS', 'RESOLVED'), true);
eq('RESOLVED->CLOSED', base('RESOLVED', 'CLOSED'), true);
eq('CLOSED->REOPENED(x:REOPEN_REQUESTED in impl)', base('CLOSED', 'REOPEN_REQUESTED'), true);
eq('SUBMITTED->CLOSED blocked', base('SUBMITTED', 'CLOSED'), false);
eq('SUBMITTED->IN_PROGRESS blocked', base('SUBMITTED', 'IN_PROGRESS'), false);

// §46 role-aware
eq('CITIZEN cannot VERIFY', canTransition('UNDER_REVIEW', 'VERIFIED', 'CITIZEN'), false);
eq('OFFICER can VERIFY', canTransition('UNDER_REVIEW', 'VERIFIED', 'OFFICER'), true);
eq('ANALYST cannot ASSIGN', canTransition('VERIFIED', 'ASSIGNED', 'ANALYST'), false);

// §60 validation
eq('reject needs reason', rejectSchema.safeParse({}).success, false);
eq('reject ok', rejectSchema.safeParse({ reason: 'Not verifiable' }).success, true);
eq('reopen needs reason', reopenSchema.safeParse({}).success, false);
eq('create needs title', createReportSchema.safeParse({ description: 'long enough description here', categoryId: 1, districtId: 1 }).success, false);
eq('create lat range', createReportSchema.safeParse({ title: 'Valid title here', description: 'long enough description here', categoryId: 1, districtId: 1, latitude: 999 }).success, false);

console.log(`Task3 contract tests: ${pass} passed, ${failCount} failed`);
if (failCount) process.exit(1);
