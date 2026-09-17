/**
 * R-CPI — 18-step end-to-end resolution workflow test (spec §16)
 * Runs against the LIVE API on http://localhost:5000 using native fetch.
 *
 *   1. Register citizen              10. Admin uploads evidence
 *   2. Citizen submits a report      11. Citizen notified
 *   3. Report in database            12. Citizen confirms
 *   4. Officer notified              13. Report CLOSED
 *   5. Officer assigns               14. Archived from active queues
 *   6. Admin notified                15. Preserved in history/audit
 *   7. Admin accepts assignment      16. Citizen rejects resolution (2nd report)
 *   8. Admin starts work             17. Report REOPENED
 *   9. Admin resolves                18. Officer/admin re-notified
 *
 * Usage: npx tsx tests/e2e-workflow.test.ts
 */
const BASE = process.env.API_URL ?? 'http://localhost:5000/api/v1';
const EMAIL_DOMAIN = `e2e-${Date.now()}@rcpi-e2e.test`;

let pass = 0;
let fail = 0;
function step(n: number | string, name: string, ok: boolean, extra = '') {
  if (ok) {
    pass++;
    console.log(`  ✓ Step ${n}: ${name}${extra ? ` — ${extra}` : ''}`);
  } else {
    fail++;
    console.error(`  ✗ Step ${n}: ${name} FAILED ${extra}`);
  }
}

interface ApiResult {
  status: number;
  body: any;
}

async function api(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {}
): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  try {
    const res = await fetch(`${BASE}${path}`, { method, headers, body });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, body: json };
  } catch (err) {
    return { status: 0, body: { success: false, message: String(err) } };
  }
}

/** 1x1 valid PNG for a real multipart evidence upload. */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function uploadEvidence(reportId: number, token: string): Promise<ApiResult> {
  const form = new FormData();
  form.append('file', new Blob([PNG_BYTES], { type: 'image/png' }), 'e2e-after-photo.png');
  form.append('evidenceType', 'RESOLUTION_EVIDENCE');
  form.append('description', 'E2E after-photo of repaired streetlight');
  try {
    const res = await fetch(`${BASE}/reports/${reportId}/evidence`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  } catch (err) {
    return { status: 0, body: { success: false, message: String(err) } };
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`\nR-CPI 18-step workflow E2E → ${BASE}\n`);

  // ── Step 1: Register citizen ──
  const email = `citizen-${EMAIL_DOMAIN}`;
  const reg = await api('POST', '/auth/register', {
    body: { firstName: 'E2E', lastName: 'Citizen', email, password: 'E2ePass@123', preferredLanguage: 'en' },
  });
  const citizenToken: string = reg.body?.data?.accessToken ?? '';
  step(1, 'Register citizen', reg.status === 201 && Boolean(citizenToken), email);

  // ── Step 2: Citizen submits a report ──
  // NOTE: the seeded demo staff (officer/admin) are scoped to Gasabo district,
  // so the report must be filed there for the geographic-authorization guards
  // to let them work on it.
  const cats = await api('GET', '/categories', {});
  const categoryId = cats.body?.data?.categories?.[0]?.id;
  const provs = await api('GET', '/geo/provinces', {});
  const kigali = provs.body?.data?.provinces?.find((p: any) => p.name === 'Kigali');
  const provinceId = kigali?.id;
  const dists = await api('GET', `/geo/districts?provinceId=${provinceId}`, {});
  const gasabo = dists.body?.data?.districts?.find((d: any) => d.name === 'Gasabo');
  const districtId = gasabo?.id;

  const rep = await api('POST', '/citizen/reports', {
    token: citizenToken,
    body: {
      title: 'E2E: Broken streetlight in the market',
      description: 'Streetlights near the central market have been dark for two weeks. Residents feel unsafe at night. About 50 families affected.',
      categoryId,
      urgency: 'HIGH',
      provinceId,
      districtId,
      latitude: -1.9441,
      longitude: 30.0619,
      locationDescription: 'E2E test location near market entrance',
    },
  });
  const reportId: number | undefined = rep.body?.data?.report?.id;
  const reference: string | undefined = rep.body?.data?.report?.reference;
  step(2, 'Citizen submits report', rep.status === 201 && Boolean(reportId), reference ?? rep.body?.message);

  // ── Step 3: Report persisted in the real database ──
  let detail = await api('GET', `/reports/${reportId}`, { token: citizenToken });
  const okStatus = ['SUBMITTED', 'AI_ANALYSIS', 'PENDING_VERIFICATION'].includes(detail.body?.data?.report?.status);
  step(3, 'Report persisted with real reference + status', detail.status === 200 && Boolean(detail.body?.data?.report?.reference) && okStatus, detail.body?.data?.report?.status);

  // Wait briefly for the async AI job to settle into PENDING_VERIFICATION.
  for (let i = 0; i < 10; i++) {
    detail = await api('GET', `/reports/${reportId}`, { token: citizenToken });
    if (detail.body?.data?.report?.status === 'PENDING_VERIFICATION') break;
    await sleep(500);
  }

  // ── Step 4: Officer notification ──
  const off = await api('POST', '/auth/login', {
    body: { email: 'officer@rcpi.gov.rw', password: 'Officer@123' },
  });
  const officerToken: string = off.body?.data?.accessToken ?? '';
  step('4a', 'Officer login (seeded demo officer)', off.status === 200 && Boolean(officerToken));

  const offNotifs = await api('GET', '/notifications', { token: officerToken });
  const officerNotified = offNotifs.body?.data?.notifications?.some(
    (x: any) => x.reportId === reportId && /assigned|received|new report|urgency|workflow queue|verify/i.test(`${x.message} ${x.title}`)
  );
  step('4b', 'Officer received in-app notification for the new report', officerNotified);

  // ── Officer review (spec §3): verify the report before assignment ──
  const verify = await api('POST', `/reports/${reportId}/transition`, {
    token: officerToken,
    body: { toStatus: 'VERIFIED', note: 'E2E: verified on site — genuine community problem.' },
  });
  step('4c', 'Officer verified the report (PENDING_VERIFICATION → VERIFIED)', verify.status === 200 && verify.body?.data?.report?.status === 'VERIFIED', verify.body?.message);

  // ── Step 5: Officer assigns an administrator (with deadline + priority) ──
  const staff = await api('GET', '/workflow/staff', { token: officerToken });
  const districtAdmin = staff.body?.data?.staff?.find((s: any) => s.role === 'DISTRICT_ADMIN') ?? staff.body?.data?.staff?.[0];
  step('5a', 'Assignable staff listed', Boolean(districtAdmin), districtAdmin?.name);

  const assign = await api('POST', `/workflow/reports/${reportId}/assign`, {
    token: officerToken,
    body: {
      officerId: districtAdmin.id,
      note: 'E2E: inspect the market lighting and restore all poles.',
      priority: 'HIGH',
      deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    },
  });
  const assignedStatus = assign.body?.data?.report?.status;
  step('5b', 'Assignment saved (officer + instructions + priority + deadline)', assign.status === 200 && Boolean(assign.body?.data?.report?.assignedOfficerId), `status=${assignedStatus} ${assign.body?.message ?? ''}`);

  // ── Step 6: Administrator receives notification ──
  const admLogin = await api('POST', '/auth/login', {
    body: { email: 'district-admin@rcpi.gov.rw', password: 'District@123' },
  });
  const adminToken: string = admLogin.body?.data?.accessToken ?? '';
  const admNotifs = await api('GET', '/notifications', { token: adminToken });
  const admNotified = admNotifs.body?.data?.notifications?.some(
    (x: any) => x.reportId === reportId && /assigned to you/i.test(`${x.title} ${x.message}`)
  );
  step(6, 'Administrator notified of assignment', admNotified);

  // ── Step 7: Administrator accepts the assignment ──
  const accept = await api('POST', `/reports/${reportId}/accept-assignment`, { token: adminToken });
  step(7, 'Assignment accepted', accept.status === 200 && accept.body?.data?.assignment?.status === 'ACCEPTED', accept.body?.message);

  // ── Step 8: Administrator starts work ──
  const start = await api('POST', `/reports/${reportId}/start`, { token: adminToken });
  step(8, 'Work started (IN_PROGRESS)', start.status === 200 && start.body?.data?.report?.status === 'IN_PROGRESS', start.body?.message);

  // ── Step 9: Administrator marks resolved with description ──
  const resolve = await api('POST', `/reports/${reportId}/resolve`, {
    token: adminToken,
    body: { resolutionDescription: 'E2E: Replaced the failed breaker and two LED heads. All poles verified working on site at 10:30.' },
  });
  step(9, 'Report resolved (RESOLVED / awaiting confirmation)', resolve.status === 200 && resolve.body?.data?.report?.status === 'RESOLVED', resolve.body?.message);

  // ── Step 10: Administrator uploads resolution evidence (real multipart) ──
  const evUp = await uploadEvidence(reportId!, adminToken);
  step(10, 'Resolution evidence uploaded', evUp.status === 201 && evUp.body?.success === true, `id=${evUp.body?.data?.evidence?.id} ${evUp.body?.message ?? ''}`);

  // ── Step 11: Citizen receives resolution notification ──
  const citNotifs = await api('GET', '/notifications', { token: citizenToken });
  const citNotified = citNotifs.body?.data?.notifications?.some(
    (x: any) => x.reportId === reportId && /resolved/i.test(`${x.title} ${x.message}`)
  );
  step(11, 'Citizen notified of resolution', citNotified);

  // ── Step 12: Citizen confirms with rating + feedback ──
  const confirm = await api('POST', `/reports/${reportId}/confirm`, {
    token: citizenToken,
    body: { rating: 5, comment: 'E2E: All lights working, thank you.' },
  });
  step(12, 'Citizen confirmed resolution (rating 5)', confirm.status === 200 && confirm.body?.data?.status === 'CLOSED', confirm.body?.message);

  // ── Step 13: Report CLOSED ──
  const closed = await api('GET', `/reports/${reportId}`, { token: citizenToken });
  step(13, 'Report status CLOSED + confirmed', closed.status === 200 && closed.body?.data?.report?.status === 'CLOSED');

  // Duplicate confirmation must be rejected (§15).
  const dupConfirm = await api('POST', `/reports/${reportId}/confirm`, { token: citizenToken, body: { rating: 5 } });
  step('13b', 'Duplicate confirmation blocked', dupConfirm.status === 409);

  // ── Step 14: Archived — out of active queues, in the archive ──
  const queue = await api('GET', '/workflow/reports?status=ALL', { token: officerToken });
  const inQueue = queue.body?.data?.reports?.some((r: any) => r.id === reportId);
  step('14a', 'Archived report removed from active queue', !inQueue);

  const archive = await api('GET', '/workflow/archive', { token: officerToken });
  const archived = archive.body?.data?.reports?.some((r: any) => r.id === reportId);
  step('14b', 'Archived report visible in Closed Archive', archived);

  // ── Step 15: History/audit preserved ──
  const hist = await api('GET', `/reports/${reportId}/history`, { token: citizenToken });
  const historySteps = hist.body?.data?.history?.length ?? 0;
  step(15, 'Status history preserved (audit trail)', hist.status === 200 && historySteps >= 5, `${historySteps} entries`);

  // ── Steps 16-18: rejection path on a second report ──
  const rep2 = await api('POST', '/citizen/reports', {
    token: citizenToken,
    body: {
      title: 'E2E: Overflowing garbage collection point',
      description: 'Waste collection point overflows weekly and litters the street. Around 30 households affected.',
      categoryId,
      urgency: 'MEDIUM',
      provinceId,
      districtId,
      locationDescription: 'E2E second test location',
    },
  });
  const report2Id: number | undefined = rep2.body?.data?.report?.id;
  const rep2Ref = rep2.body?.data?.report?.reference;
  // Wait for AI to move it to PENDING_VERIFICATION so it can be verified/assigned.
  for (let i = 0; i < 12; i++) {
    const d = await api('GET', `/reports/${report2Id}`, { token: citizenToken });
    if (d.body?.data?.report?.status === 'PENDING_VERIFICATION') break;
    await sleep(500);
  }
  const verify2 = await api('POST', `/reports/${report2Id}/transition`, {
    token: officerToken,
    body: { toStatus: 'VERIFIED', note: 'E2E: verified for reject-path test.' },
  });
  const assign2 = await api('POST', `/workflow/reports/${report2Id}/assign`, {
    token: officerToken,
    body: { officerId: districtAdmin.id, note: 'E2E reject-path assignment', priority: 'MEDIUM' },
  });
  const start2 = await api('POST', `/reports/${report2Id}/start`, { token: adminToken });
  const resolve2 = await api('POST', `/reports/${report2Id}/resolve`, {
    token: adminToken,
    body: { resolutionDescription: 'E2E: Bin emptied and collection schedule doubled.' },
  });
  step(16, 'Second report driven to RESOLVED (reject-path setup)', verify2.status === 200 && assign2.status === 200 && start2.status === 200 && resolve2.status === 200, `${rep2Ref} verify=${verify2.status} assign=${assign2.status} start=${start2.status} resolve=${resolve2.status} ${resolve2.body?.message ?? ''}`);

  const reject = await api('POST', `/reports/${report2Id}/reject-resolution`, {
    token: citizenToken,
    body: { reason: 'E2E: The garbage is still not collected on weekends.' },
  });
  step(17, 'Citizen rejects resolution → REOPENED', reject.status === 200 && reject.body?.data?.status === 'REOPENED', reject.body?.message);

  const admNotifs2 = await api('GET', '/notifications', { token: adminToken });
  const adminReNotified = admNotifs2.body?.data?.notifications?.some(
    (x: any) => x.reportId === report2Id && /reject|reopen/i.test(`${x.title} ${x.message}`)
  );
  const offNotifs2 = await api('GET', '/notifications', { token: officerToken });
  const officerReNotified = offNotifs2.body?.data?.notifications?.some(
    (x: any) => x.reportId === report2Id && /reject|reopen/i.test(`${x.title} ${x.message}`)
  );
  step(18, 'Officer/admin re-notified after rejection', adminReNotified || officerReNotified);

  console.log(`\n════════════════════════════════════`);
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  console.log(`════════════════════════════════════\n`);
  if (fail) process.exit(1);
}

main().catch((err) => {
  console.error('E2E crashed:', err);
  process.exit(1);
});
