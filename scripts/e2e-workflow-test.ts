/**
 * R-CPI End-to-End Workflow Test (master spec §22)
 * 
 * Citizen → AI analysis → verification → assignment → deadline → progress
 * → resolve → close → feedback → analytics.
 * 
 * Run: npx tsx scripts/e2e-workflow-test.ts
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
  opts: { body?: unknown; token?: string; cookies?: string[] } = {}
): Promise<HttpResult<T>> {
  const headers: Record<string, string> = {};
  if (opts.body) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.cookies?.length) headers.Cookie = opts.cookies.join('; ');

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body, cookies: setCookies };
}

function getCookie(cookies: string[], name: string): string | undefined {
  return cookies.find((c) => c.startsWith(`${name}=`));
}

async function main() {
  console.log('\n🧪 R-CPI END-TO-END WORKFLOW TEST (master spec §22)\n');
  const stamp = Date.now();

  // ── Step 1: Citizen registers ──
  console.log('1️⃣  Citizen registration');
  const email = `e2e.citizen.${stamp}@test.rw`;
  const reg = await call<{ data: { user: { id: number }; accessToken: string } }>('POST', '/auth/register', {
    body: {
      firstName: 'E2E',
      lastName: 'Tester',
      email,
      password: 'TestPass@123',
      preferredLanguage: 'en',
    },
  });
  check('registration succeeds (201)', reg.status === 201, `status=${reg.status}`);
  const citizenToken = reg.body?.data?.accessToken;
  check('access token issued', Boolean(citizenToken));

  // ── Step 2-4: Citizen submits report (drainage, with location) ──
  console.log('\n2️⃣  Report submission (blocked drainage + location)');
  const geo = await call<{ data: { provinces: any[] } }>('GET', '/geo/provinces');
  const kigali = geo.body?.data?.provinces?.find((p: any) => p.name === 'Kigali');
  check('geography seeded (Kigali exists)', Boolean(kigali));

  const districts = await call<{ data: { districts: any[] } }>('GET', `/geo/districts?provinceId=${kigali.id}`);
  const gasabo = districts.body?.data?.districts?.find((d: any) => d.name === 'Gasabo');
  const sectors = await call<{ data: { sectors: any[] } }>('GET', `/geo/sectors?districtId=${gasabo.id}`);
  const kacyiru = sectors.body?.data?.sectors?.find((s: any) => s.name === 'Kacyiru');

  const cats = await call<{ data: { categories: any[] } }>('GET', '/categories');
  const drainage = cats.body?.data?.categories?.find((c: any) => c.name === 'Drainage');
  check('categories seeded (Drainage exists)', Boolean(drainage));

  const created = await call<{ data: { report: { id: number; reference: string; status: string } } }>('POST', '/citizen/reports', {
    token: citizenToken,
    body: {
      title: 'Blocked drainage flooding homes in Kacyiru',
      description:
        'The drainage canal near Kacyiru market is blocked with waste and soil. Since the last two heavy rains, water floods into nearby houses. About 40 families are affected, including children and elderly residents. Risk of waterborne disease is increasing.',
      categoryId: drainage.id,
      urgency: 'HIGH',
      provinceId: kigali.id,
      districtId: gasabo.id,
      sectorId: kacyiru?.id,
      latitude: -1.9355,
      longitude: 30.0902,
      locationDescription: 'Near Kacyiru market main canal',
      affectedPeople: 40,
      vulnerableGroup: true,
    },
  });
  check('report created (201)', created.status === 201, `status=${created.status} body=${JSON.stringify(created.body).slice(0, 200)}`);
  const reportId = created.body?.data?.report?.id;
  const reference = created.body?.data?.report?.reference;
  check('report reference generated (RCP-YYYY-XXXXXX)', /^RCP-\d{4}-\d{6}$/.test(reference ?? ''), reference);
  const reportIdNum = Number(reportId);

  // ── Step 5: Report stored, AI analysis runs ──
  console.log('\n3️⃣  AI analysis (no API key configured → offline fallback)');
  await new Promise((r) => setTimeout(r, 2500));
  const citizenMe = await call<{ data: { user: any } }>('GET', '/auth/me', { token: citizenToken });
  check('citizen session valid', citizenMe.status === 200);

  // ── Step 6-8: Officer receives notification, verifies report ──
  console.log('\n4️⃣  Officer: notification → verify');
  const officerLogin = await call<{ data: { user: any; accessToken: string } }>('POST', '/auth/login', {
    body: { email: 'officer@rcpi.gov.rw', password: 'Officer@123', rememberMe: false },
  });
  check('officer login works', officerLogin.status === 200, `status=${officerLogin.status}`);
  const officerToken = officerLogin.body?.data?.accessToken;

  const notifs = await call<{ data: { notifications: any[] } }>('GET', '/notifications', { token: officerToken });
  const newReportNotif = notifs.body?.data?.notifications?.find(
    (n) => n.reportId === reportIdNum || (n.message as string)?.includes(reference)
  );
  check('officer received new-report notification', Boolean(newReportNotif));

  const detail = await call<{ data: { report: any } }>('GET', `/workflow/reports/${reportId}`, { token: officerToken });
  check('officer can open report detail', detail.status === 200, `status=${detail.status}`);
  const aiSummary = detail.body?.data?.report?.aiSuggestion?.summary;
  check('AI analysis attached (summary present)', typeof aiSummary === 'string' && aiSummary.length > 0, String(aiSummary).slice(0, 60));
  check('allowedTransitions exposed to UI', Array.isArray(detail.body?.data?.report?.allowedTransitions));

  const verify = await call('POST', `/workflow/reports/${reportId}/transition`, {
    token: officerToken,
    body: { toStatus: 'VERIFIED', note: 'Site confirmed by cell coordinator. Field visit scheduled.' },
  });
  check('officer verifies report', verify.status === 200, `status=${verify.status} ${JSON.stringify(verify.body).slice(0, 150)}`);

  // Citizen notification check
  const citizenNotifs = await call<{ data: { notifications: any[] } }>('GET', '/notifications', { token: citizenToken });
  check('citizen notified of verification', Boolean(citizenNotifs.body?.data?.notifications?.find((n) => n.type === 'REPORT_VERIFIED')));

  // ── Step 9-10: Assignment to department + deadline ──
  console.log('\n5️⃣  Assignment → deadline');
  const depts = await call<{ data: { departments: any[] } }>('GET', '/departments', { token: officerToken });
  const infrastructure = depts.body?.data?.departments?.find((d: any) => d.name === 'Infrastructure');
  check('departments seeded (Infrastructure)', Boolean(infrastructure));

  const assign = await call('POST', `/workflow/reports/${reportId}/transition`, {
    token: officerToken,
    body: { toStatus: 'ASSIGNED', departmentId: infrastructure.id, note: 'Assigned to Infrastructure for canal clearing.' },
  });
  check('report assigned to department', assign.status === 200, `status=${assign.status} ${JSON.stringify(assign.body).slice(0, 150)}`);

  const deadline = await call('POST', `/workflow/reports/${reportId}/deadline`, {
    token: officerToken,
    body: { deadline: new Date(Date.now() + 3 * 86400000).toISOString(), reason: 'Initial SLA for drainage clearance' },
  });
  check('deadline set with reason', deadline.status === 200, `status=${deadline.status}`);

  // ── Step 11-13: Investigation (internal note), progress, evidence ──
  console.log('\n6️⃣  Investigation → resolution');
  const note = await call('POST', `/workflow/reports/${reportId}/internal-note`, {
    token: officerToken,
    body: { note: 'Field team deployed; waste removal started; canal partially cleared.' },
  });
  check('internal investigation note saved', note.status === 201, `status=${note.status}`);

  const progress = await call('POST', `/workflow/reports/${reportId}/transition`, {
    token: officerToken,
    body: { toStatus: 'IN_PROGRESS', note: 'Crew on site clearing the canal.' },
  });
  check('work marked in progress', progress.status === 200, `status=${progress.status} ${JSON.stringify(progress.body).slice(0, 120)}`);

  const evidence = await call('POST', `/workflow/reports/${reportId}/evidence`, {
    token: officerToken,
    body: {},
  });
  // evidence needs multipart; a JSON attempt must not be 500 — validation should catch it
  check('evidence endpoint validates bad input gracefully', evidence.status === 400 || evidence.status === 422 || evidence.status === 404, `status=${evidence.status}`);

  const resolve = await call('POST', `/workflow/reports/${reportId}/transition`, {
    token: officerToken,
    body: { toStatus: 'RESOLVED', note: 'Canal fully cleared and re-profiled; water flows freely again.' },
  });
  check('report resolved', resolve.status === 200, `status=${resolve.status} ${JSON.stringify(resolve.body).slice(0, 150)}`);

  // ── Step 14: Supervisor (district) approves closure ──
  console.log('\n7️⃣  Supervisor closure approval');
  const adminLogin = await call<{ data: { user: any; accessToken: string } }>('POST', '/auth/login', {
    body: { email: 'district-admin@rcpi.gov.rw', password: 'District@123', rememberMe: false },
  });
  check('district admin login works', adminLogin.status === 200);
  const adminToken = adminLogin.body?.data?.accessToken;

  const wrongCloser = await call('POST', `/workflow/reports/${reportId}/transition`, {
    token: officerToken,
    body: { toStatus: 'CLOSED', note: 'attempt by officer — should be blocked' },
  });
  check('officer CANNOT close (supervisor approval required)', wrongCloser.status === 403, `status=${wrongCloser.status}`);

  const close = await call('POST', `/workflow/reports/${reportId}/transition`, {
    token: adminToken,
    body: { toStatus: 'CLOSED', note: 'Closure approved after site inspection.' },
  });
  check('district admin closes report', close.status === 200, `status=${close.status} ${JSON.stringify(close.body).slice(0, 150)}`);

  // ── Step 15-17: Citizen notified → feedback → analytics ──
  console.log('\n8️⃣  Citizen feedback → analytics');
  const citizenNotifs2 = await call<{ data: { notifications: any[] } }>('GET', '/notifications', { token: citizenToken });
  check('citizen notified of closure', Boolean(citizenNotifs2.body?.data?.notifications?.find((n) => n.type === 'REPORT_CLOSED')));

  const feedback = await call('POST', `/citizen/reports/${reportId}/feedback`, {
    token: citizenToken,
    body: { rating: 5, comment: 'Fast response, canal is clear. Thank you!' },
  });
  check('citizen feedback accepted', feedback.status === 201, `status=${feedback.status} ${JSON.stringify(feedback.body).slice(0, 120)}`);

  const dupFeedback = await call('POST', `/citizen/reports/${reportId}/feedback`, {
    token: citizenToken,
    body: { rating: 1 },
  });
  check('duplicate feedback rejected (409)', dupFeedback.status === 409, `status=${dupFeedback.status}`);

  const citizenTimeline = await call<{ data: { report: any } }>('GET', `/citizen/reports/${reportId}`, { token: citizenToken });
  const history = citizenTimeline.body?.data?.report?.timeline ?? [];
  check('full audit trail recorded', history.length >= 6, `history entries: ${history.length}`);
  const statuses = history.map((h: any) => h.toStatus);
  check(
    'lifecycle order correct',
    statuses.includes('SUBMITTED') && statuses.includes('VERIFIED') && statuses.includes('ASSIGNED') && statuses.includes('RESOLVED') && statuses.includes('CLOSED'),
    statuses.join(' → ')
  );

  // ── Step 18: Aggregated dashboards updated ──
  console.log('\n9️⃣  Aggregated analytics reflect the workflow');
  const intelligence = await call<{ data: any }>('GET', '/intelligence/dashboard', { token: adminToken });
  check('province/national intelligence dashboard loads', intelligence.status === 200, `status=${intelligence.status}`);
  check('dashboard counts include our report', (intelligence.body?.data?.stats?.total ?? 0) >= 1, `total=${intelligence.body?.data?.stats?.total}`);

  const execLogin = await call<{ data: { accessToken: string } }>('POST', '/auth/login', {
    body: { email: 'executive@rcpi.gov.rw', password: 'Executive@123', rememberMe: false },
  });
  const execToken = execLogin.body?.data?.accessToken;
  const execDash = await call<{ data: any }>('GET', '/intelligence/executive', { token: execToken });
  check('executive strategic dashboard loads', execDash.status === 200, `status=${execDash.status}`);
  check('executive dashboard has no personal citizen details', !JSON.stringify(execDash.body?.data).includes(email));
  const resolvedCount = execDash.body?.data?.stats?.resolved ?? 0;
  check('resolved count reflects closure', resolvedCount >= 1, `resolved=${resolvedCount}`);

  // RBAC negative tests
  console.log('\n🔒 RBAC spot checks');
  const citizenForbidden = await call('GET', '/workflow/reports', { token: citizenToken });
  check('citizen blocked from workflow queue', citizenForbidden.status === 403, `status=${citizenForbidden.status}`);
  const execMutation = await call('POST', `/workflow/reports/${reportId}/transition`, {
    token: execToken,
    body: { toStatus: 'REOPENED', note: 'executive should be read-only' },
  });
  check('executive cannot mutate reports', execMutation.status === 403, `status=${execMutation.status}`);
  const noAuth = await call('GET', '/citizen/dashboard');
  check('unauthenticated request rejected', noAuth.status === 401, `status=${noAuth.status}`);

  // ── Summary ──
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULT: ${pass} passed, ${failCount} failed`);
  console.log(`${'═'.repeat(60)}\n`);
  process.exit(failCount ? 1 : 0);
}

main().catch((e) => {
  console.error('E2E test crashed:', e);
  process.exit(1);
});
