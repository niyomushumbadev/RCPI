/**
 * R-CPI Reopen-Request Review Test
 *
 * Covers: citizen reopen request → officer queue → approve (report reopens,
 * citizen notified) → new workflow → decline path → RBAC negative checks.
 *
 * Run with the API on :5000:  npx tsx scripts/reopen-review-test.ts
 */
const BASE = 'http://localhost:5000/api/v1';

let pass = 0;
let failCount = 0;
function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    failCount++;
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

interface HttpResult<T = any> {
  status: number;
  body: T;
  cookies: string[];
}

async function call<T = any>(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string } = {}
): Promise<HttpResult<T>> {
  const headers: Record<string, string> = {};
  if (opts.body) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const cookies = res.headers.getSetCookie?.() ?? [];
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body, cookies };
}

async function main() {
  console.log('\n🧪 R-CPI REOPEN-REQUEST REVIEW TEST\n');
  const stamp = Date.now();

  // ── Citizen + closed report (fast path through the lifecycle) ──
  console.log('1️⃣  Setup: citizen + report driven to CLOSED');
  const reg = await call<{ data: { accessToken: string } }>('POST', '/auth/register', {
    body: { firstName: 'Reopen', lastName: 'Tester', email: `reopen.${stamp}@test.rw`, password: 'TestPass@123', preferredLanguage: 'en' },
  });
  const citizenToken = reg.body?.data?.accessToken;
  check('citizen registered', Boolean(citizenToken));

  const geo = await call<{ data: { provinces: any[] } }>('GET', '/geo/provinces');
  const kigali = geo.body?.data?.provinces?.find((p: any) => p.name === 'Kigali');
  const districts = await call<{ data: { districts: any[] } }>('GET', `/geo/districts?provinceId=${kigali.id}`);
  const gasabo = districts.body?.data?.districts?.find((d: any) => d.name === 'Gasabo');
  const sectors = await call<{ data: { sectors: any[] } }>('GET', `/geo/sectors?districtId=${gasabo.id}`);
  const kacyiru = sectors.body?.data?.sectors?.find((s: any) => s.name === 'Kacyiru');
  const cats = await call<{ data: { categories: any[] } }>('GET', '/categories');
  const drainage = cats.body?.data?.categories?.find((c: any) => c.name === 'Drainage');

  const created = await call<{ data: { report: { id: number; reference: string } } }>('POST', '/citizen/reports', {
    token: citizenToken,
    body: {
      title: `Reopen test ${stamp}: drainage blocked again`,
      description: 'Drainage canal re-blocked after clearing. Water is pooling near houses again.',
      categoryId: drainage.id,
      urgency: 'HIGH',
      provinceId: kigali.id,
      districtId: gasabo.id,
      sectorId: kacyiru?.id,
      latitude: -1.9355,
      longitude: 30.0902,
      locationDescription: 'Kacyiru test site',
      affectedPeople: 15,
    },
  });
  const reportId = created.body?.data?.report?.id;
  const reference = created.body?.data?.report?.reference;
  check('report created', Boolean(reportId), reference);

  const officerLogin = await call<{ data: { accessToken: string } }>('POST', '/auth/login', {
    body: { email: 'officer@rcpi.gov.rw', password: 'Officer@123' },
  });
  const officerToken = officerLogin.body?.data?.accessToken;
  const adminLogin = await call<{ data: { accessToken: string } }>('POST', '/auth/login', {
    body: { email: 'district-admin@rcpi.gov.rw', password: 'District@123' },
  });
  const adminToken = adminLogin.body?.data?.accessToken;
  const cellLogin = await call<{ data: { accessToken: string } }>('POST', '/auth/login', {
    body: { email: 'cell@rcpi.gov.rw', password: 'Cell@12345' },
  });
  const cellToken = cellLogin.body?.data?.accessToken;

  // Drive: VERIFIED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
  const depts = await call<{ data: { departments: any[] } }>('GET', '/departments', { token: officerToken });
  const infrastructure = depts.body?.data?.departments?.find((d: any) => d.name === 'Infrastructure');
  await call('POST', `/workflow/reports/${reportId}/transition`, { token: officerToken, body: { toStatus: 'VERIFIED', note: 'Verified on site.' } });
  await call('POST', `/workflow/reports/${reportId}/transition`, { token: officerToken, body: { toStatus: 'ASSIGNED', departmentId: infrastructure.id, note: 'To Infrastructure.' } });
  await call('POST', `/workflow/reports/${reportId}/transition`, { token: officerToken, body: { toStatus: 'IN_PROGRESS', note: 'Crew dispatched.' } });
  await call('POST', `/workflow/reports/${reportId}/transition`, { token: officerToken, body: { toStatus: 'RESOLVED', note: 'Canal cleared.' } });
  const close = await call('POST', `/workflow/reports/${reportId}/transition`, { token: adminToken, body: { toStatus: 'CLOSED', note: 'Closure approved.' } });
  check('report driven to CLOSED', close.status === 200, `status=${close.status}`);

  // ── Citizen requests reopen ──
  console.log('\n2️⃣  Citizen requests reopen');
  const noReason = await call('POST', `/citizen/reports/${reportId}/reopen`, { token: citizenToken, body: {} });
  check('reopen without reason rejected (422)', noReason.status === 422, `status=${noReason.status}`);

  const reopen = await call('POST', `/citizen/reports/${reportId}/reopen`, {
    token: citizenToken,
    body: { reason: 'The canal is blocked again one week later. Water is entering the compound.' },
  });
  check('reopen request accepted (201)', reopen.status === 201, `status=${reopen.status} ${JSON.stringify(reopen.body).slice(0, 150)}`);

  const dupReopen = await call('POST', `/citizen/reports/${reportId}/reopen`, { token: citizenToken, body: { reason: 'again' } });
  check('duplicate reopen blocked (409)', dupReopen.status === 409, `status=${dupReopen.status}`);

  // ── Officer queue shows it ──
  console.log('\n3️⃣  Officer review queue');
  const officerQueue = await call<{ data: { requests: any[] } }>('GET', '/workflow/reopen-requests', { token: officerToken });
  check('officer sees reopen queue', officerQueue.status === 200, `status=${officerQueue.status}`);
  const mine = officerQueue.body?.data?.requests?.find((r: any) => r.reportId === reportId);
  check('new request visible in queue', Boolean(mine), mine ? `id=${mine.id}` : 'not found');
  const reqId = mine?.id;

  const citizenForbidden = await call('GET', '/workflow/reopen-requests', { token: citizenToken });
  check('citizen blocked from review queue (403)', citizenForbidden.status === 403, `status=${citizenForbidden.status}`);

  // ── RBAC on review endpoint ──
  console.log('\n4️⃣  Review RBAC');
  const cellApprove = await call('POST', `/workflow/reopen-requests/${reqId}/review`, { token: cellToken, body: { decision: 'APPROVE' } });
  check('cell officer cannot APPROVE (403)', cellApprove.status === 403, `status=${cellApprove.status}`);

  const badDecision = await call('POST', `/workflow/reopen-requests/${reqId}/review`, { token: adminToken, body: { decision: 'MAYBE' } });
  check('invalid decision rejected (422)', badDecision.status === 422, `status=${badDecision.status}`);

  // ── Approve path (district admin) ──
  console.log('\n5️⃣  Approve → report reopens');
  const approve = await call('POST', `/workflow/reopen-requests/${reqId}/review`, {
    token: adminToken,
    body: { decision: 'APPROVE', note: 'Site revisited — blockage confirmed. Reopened for remediation.' },
  });
  check('district admin approves (200)', approve.status === 200, `status=${approve.status} ${JSON.stringify(approve.body).slice(0, 150)}`);

  const detail = await call<{ data: { report: { status: string } } }>('GET', `/workflow/reports/${reportId}`, { token: officerToken });
  check('report status is REOPENED', detail.body?.data?.report?.status === 'REOPENED', detail.body?.data?.report?.status);

  const citizenNotifs = await call<{ data: { notifications: any[] } }>('GET', '/notifications', { token: citizenToken });
  check('citizen notified of approval', Boolean(citizenNotifs.body?.data?.notifications?.find((n: any) => n.type === 'REPORT_REOPENED' && (n.message as string)?.includes(reference ?? '***'))));

  const already = await call('POST', `/workflow/reopen-requests/${reqId}/review`, { token: adminToken, body: { decision: 'DECLINE' } });
  check('re-review of decided request blocked (409)', already.status === 409, `status=${already.status}`);

  // ── Decline path (second lifecycle + reopen) ──
  console.log('\n6️⃣  Decline path');
  await call('POST', `/workflow/reports/${reportId}/transition`, { token: officerToken, body: { toStatus: 'RESOLVED', note: 'Re-cleared and re-profiled.' } });
  await call('POST', `/workflow/reports/${reportId}/transition`, { token: adminToken, body: { toStatus: 'CLOSED', note: 'Final closure after remediation.' } });
  const reopen2 = await call('POST', `/citizen/reports/${reportId}/reopen`, { token: citizenToken, body: { reason: 'Still pooling after each rain.' } });
  check('second reopen request accepted', reopen2.status === 201, `status=${reopen2.status}`);

  const queue2 = await call<{ data: { requests: any[] } }>('GET', '/workflow/reopen-requests', { token: officerToken });
  const mine2 = queue2.body?.data?.requests?.find((r: any) => r.reportId === reportId);
  check('second request in queue', Boolean(mine2));

  const decline = await call('POST', `/workflow/reopen-requests/${mine2?.id}/review`, {
    token: officerToken,
    body: { decision: 'DECLINE', note: 'Verified on site: channel flows freely. Standing water is on private land.' },
  });
  check('officer (sector-level) can decline', decline.status === 200, `status=${decline.status} ${JSON.stringify(decline.body).slice(0, 150)}`);

  const detail2 = await call<{ data: { report: { status: string } } }>('GET', `/workflow/reports/${reportId}`, { token: officerToken });
  check('report stays CLOSED after decline', detail2.body?.data?.report?.status === 'CLOSED', detail2.body?.data?.report?.status);

  const citizenNotifs2 = await call<{ data: { notifications: any[] } }>('GET', '/notifications', { token: citizenToken });
  check('citizen notified of decline with note', Boolean(citizenNotifs2.body?.data?.notifications?.find((n: any) => n.title === 'Reopen request declined' && (n.message as string)?.includes('private land'))));

  const queue3 = await call<{ data: { requests: any[] } }>('GET', '/workflow/reopen-requests', { token: officerToken });
  check('declined request removed from pending queue', !queue3.body?.data?.requests?.some((r: any) => r.reportId === reportId));

  // ── Summary ──
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULT: ${pass} passed, ${failCount} failed`);
  console.log(`${'═'.repeat(60)}\n`);
  process.exit(failCount ? 1 : 0);
}

main().catch((e) => {
  console.error('Reopen review test crashed:', e);
  process.exit(1);
});
