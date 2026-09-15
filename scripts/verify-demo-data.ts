/**
 * Demo-data verification: confirms every dashboard, map and queue shows
 * the seeded demo reports. Run with the API on :5000:
 *   npx tsx scripts/verify-demo-data.ts
 */
const BASE = 'http://localhost:5000/api/v1';

let pass = 0;
let failCount = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failCount++;
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function call<T = any>(method: string, path: string, opts: { body?: unknown; token?: string } = {}): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = {};
  if (opts.body) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let body: any = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

async function login(email: string, password: string): Promise<string> {
  const res = await call<{ data: { accessToken: string } }>('POST', '/auth/login', { body: { email, password, rememberMe: false } });
  if (res.status !== 200) throw new Error(`login failed for ${email}: HTTP ${res.status}`);
  return res.body.data.accessToken;
}

async function main() {
  console.log('\n🧪 DEMO-DATA VERIFICATION (dashboards, maps, queues)\n');

  // 1) Public map (no auth) — privacy-filtered GIS data
  console.log('1️⃣  Public community map (unauthenticated)');
  const map = await call<{ data: { problems: any[] } }>('GET', '/map/problems');
  check('map endpoint reachable', map.status === 200);
  const problems = map.body?.data?.problems ?? [];
  check('map has public problems', problems.length >= 10, `${problems.length} mapped`);
  check('map points carry coordinates', problems.filter((p: any) => p.latitude != null && p.longitude != null).length >= 10);
  const districts = new Set(problems.map((p: any) => p.district));
  check('map covers multiple districts', districts.size >= 6, [...districts].slice(0, 8).join(', '));
  const noPii = !JSON.stringify(problems).includes('@rcpi.gov.rw');
  check('no citizen PII on public map', noPii);

  // 2) Community insights (public aggregates)
  console.log('\n2️⃣  Community insights (unauthenticated)');
  const insights = await call<{ data: any }>('GET', '/community/insights');
  check('insights endpoint reachable', insights.status === 200);
  check('most-reported categories present', (insights.body?.data?.mostReported ?? []).length >= 3, (insights.body?.data?.mostReported ?? []).slice(0, 3).map((c: any) => `${c.name}:${c.count}`).join(', '));
  check('recently resolved present', (insights.body?.data?.recentlyResolved ?? []).length >= 2);

  // 3) Citizen dashboard (own reports + notifications)
  console.log('\n3️⃣  Citizen dashboard');
  const citizenToken = await login('citizen@rcpi.gov.rw', 'Citizen@123');
  const citizenDash = await call<{ data: any }>('GET', '/citizen/dashboard', { token: citizenToken });
  check('citizen dashboard loads', citizenDash.status === 200);
  check('citizen has reports', (citizenDash.body?.data?.stats?.total ?? 0) >= 1, `total=${citizenDash.body?.data?.stats?.total}`);

  // 4) Officer workflow (queue + stats)
  console.log('\n4️⃣  Officer workflow');
  const officerToken = await login('officer@rcpi.gov.rw', 'Officer@123');
  const wfStats = await call<{ data: any }>('GET', '/workflow/stats', { token: officerToken });
  check('workflow stats load', wfStats.status === 200);
  check('stats show submitted queue', (wfStats.body?.data?.stats?.submitted ?? 0) >= 1, `submitted=${wfStats.body?.data?.stats?.submitted}`);
  check('stats show resolved count', (wfStats.body?.data?.stats?.resolved ?? 0) >= 2, `resolved=${wfStats.body?.data?.stats?.resolved}`);
  const wfReports = await call<{ data: any }>('GET', '/workflow/reports?status=ALL', { token: officerToken });
  // Officer is scoped to Gasabo by district — geographic RBAC means Gasabo's
  // reports only (not the whole country). 4 demo reports are in Gasabo.
  check('officer sees own-district queue (geo-scoped)', (wfReports.body?.data?.reports ?? []).length >= 4, `${wfReports.body?.data?.reports?.length ?? 0} Gasabo reports in page 1`);
  // The demo reopen case (Gitega, Nyarugenge) is outside the officer's district
  // — only a Nyarugenge/district+ role would see it. National admin sees all.
  const natToken = await login('national-admin@rcpi.gov.rw', 'National@123');
  const reopenedNat = await call<{ data: any }>('GET', '/workflow/reopen-requests', { token: natToken });
  check('reopen-request queue has the demo reopen case (national view)', (reopenedNat.body?.data?.requests ?? []).length >= 1, `${reopenedNat.body?.data?.requests?.length ?? 0} pending`);

  // 5) District admin dashboard
  console.log('\n5️⃣  District administration');
  const adminToken = await login('district-admin@rcpi.gov.rw', 'District@123');
  const adminDash = await call<{ data: any }>('GET', '/admin/dashboard', { token: adminToken });
  check('admin dashboard loads', adminDash.status === 200);
  check('admin sees report totals', (adminDash.body?.data?.stats?.totalReports ?? 0) >= 20, `totalReports=${adminDash.body?.data?.stats?.totalReports}`);
  check('admin sees user roster', (adminDash.body?.data?.stats?.totalUsers ?? 0) >= 15, `totalUsers=${adminDash.body?.data?.stats?.totalUsers}`);
  // District admin is scoped to Gasabo; the SYSTEM_ADMIN sees nationwide.
  const sysToken = await login('admin@rcpi.gov.rw', 'Admin@123');
  const stats = await call<{ data: any }>('GET', '/reports/statistics', { token: sysToken });
  check('statistics aggregates by status (nationwide)', (stats.body?.data?.byStatus ?? []).length >= 5, (stats.body?.data?.byStatus ?? []).slice(0, 4).map((s: any) => `${s.status}:${s.count}`).join(', '));
  check('statistics aggregates by category', (stats.body?.data?.byCategory ?? []).length >= 5);
  check('statistics aggregates by district', (stats.body?.data?.byDistrict ?? []).length >= 6);

  // 6) Province / national intelligence
  console.log('\n6️⃣  Intelligence & executive dashboards');
  const intel = await call<{ data: any }>('GET', '/intelligence/dashboard', { token: sysToken });
  check('GIS intelligence dashboard loads', intel.status === 200);
  check('map points on intelligence view (nationwide)', (intel.body?.data?.stats?.mapped ?? 0) >= 15, `mapped=${intel.body?.data?.stats?.mapped}`);
  check('hotspot categories ranked', (intel.body?.data?.byCategory ?? []).length >= 5);
  const execToken = await login('executive@rcpi.gov.rw', 'Executive@123');
  const exec = await call<{ data: any }>('GET', '/intelligence/executive', { token: execToken });
  check('executive dashboard loads', exec.status === 200);
  check('executive totals reflect demo data', (exec.body?.data?.stats?.total ?? 0) >= 20, `total=${exec.body?.data?.stats?.total}`);
  check('executive province comparison present', (exec.body?.data?.byProvince ?? []).length >= 4, (exec.body?.data?.byProvince ?? []).map((p: any) => p.label).slice(0, 5).join(', '));
  check('no citizen emails on executive view', !JSON.stringify(exec.body?.data).includes('@rcpi.gov.rw'));

  // 7) AI analysis present on advanced reports
  console.log('\n7️⃣  AI advisory fields on demo reports');
  const queue = wfReports.body?.data?.reports ?? [];
  const verifiedReport = queue.find((r: any) => ['VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(r.status));
  if (verifiedReport) {
    const ai = await call<{ data: any }>('GET', `/ai/reports/${verifiedReport.id}`, { token: officerToken });
    check('AI analysis retrievable for advanced report', ai.status === 200 && Boolean(ai.body?.data?.analysis), `report ${verifiedReport.reference}`);
  } else {
    check('advanced report available for AI check', false);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULT: ${pass} passed, ${failCount} failed`);
  console.log(`${'═'.repeat(60)}\n`);
  process.exit(failCount ? 1 : 0);
}

main().catch((e) => {
  console.error('Verification crashed:', e);
  process.exit(1);
});
