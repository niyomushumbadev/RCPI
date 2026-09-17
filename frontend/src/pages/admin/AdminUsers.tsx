import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, geoApi } from '../../lib/api';
import type { AdminUser, District, Province } from '../../types';
import { PageHeader, Spinner, ErrorBox, EmptyState, Pagination } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../lib/format';

// Every assignable role: staff created here sign in with the temporary
// password and land on the dashboard that matches their role.
const ROLES = [
  'CITIZEN',
  'CELL_OFFICER',
  'SECTOR_OFFICER',
  'OFFICER',
  'DISTRICT_ADMIN',
  'PROVINCE_ADMIN',
  'CITY_ADMIN',
  'NATIONAL_ADMIN',
  'EXECUTIVE',
  'ANALYST',
  'SYSTEM_ADMIN',
];

const ROLE_BADGE: Record<string, string> = {
  CITIZEN: 'bg-slate-100 text-slate-600',
  CELL_OFFICER: 'bg-cyan-100 text-cyan-800',
  SECTOR_OFFICER: 'bg-cyan-100 text-cyan-800',
  OFFICER: 'bg-sky-100 text-sky-800',
  DISTRICT_ADMIN: 'bg-indigo-100 text-indigo-800',
  PROVINCE_ADMIN: 'bg-violet-100 text-violet-800',
  CITY_ADMIN: 'bg-fuchsia-100 text-fuchsia-800',
  NATIONAL_ADMIN: 'bg-purple-100 text-purple-800',
  EXECUTIVE: 'bg-amber-100 text-amber-800',
  SYSTEM_ADMIN: 'bg-red-100 text-red-800',
  ANALYST: 'bg-teal-100 text-teal-800',
};

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const isSystemAdmin = currentUser?.role === 'SYSTEM_ADMIN';
  const [params, setParams] = useState<URLSearchParams>(new URLSearchParams());
  const page = parseInt(params.get('page') ?? '1', 10);
  const role = params.get('role') ?? 'ALL';
  const q = params.get('q') ?? '';

  const [data, setData] = useState<{ users: AdminUser[]; pagination: { page: number; totalPages: number; total: number } } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Create-user form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', roleName: 'OFFICER' });
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [createError, setCreateError] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  // Show the sign-in credentials once after creation so the admin can hand
  // them to the new user (the password is never displayed again).
  const [createdUser, setCreatedUser] = useState<{ firstName: string; lastName: string; email: string; password: string; role: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    adminApi
      .users(page, role !== 'ALL' ? role : undefined, q || undefined)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load users'))
      .finally(() => setLoading(false));
  }, [page, role, q]);

  useEffect(() => {
    geoApi.provinces().then((r) => setProvinces(r.provinces)).catch(() => {});
  }, []);

  useEffect(() => {
    if (provinceId) geoApi.districts(Number(provinceId)).then((r) => setDistricts(r.districts)).catch(() => {});
    else setDistricts([]);
  }, [provinceId]);

  function update(next: { page?: number; role?: string; q?: string }) {
    const nextParams = new URLSearchParams(params);
    if (next.page !== undefined) nextParams.set('page', String(next.page));
    if (next.role !== undefined) {
      nextParams.set('role', next.role);
      nextParams.delete('page');
    }
    if (next.q !== undefined) {
      nextParams.set('q', next.q);
      nextParams.delete('page');
    }
    setParams(nextParams);
  }

  async function toggleStatus(u: AdminUser) {
    try {
      await adminApi.setUserStatus(u.id, !u.isActive);
      setData((d) =>
        d ? { ...d, users: d.users.map((x) => (x.id === u.id ? { ...x, isActive: !x.isActive } : x)) } : d
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change user status');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreateBusy(true);
    try {
      await adminApi.createUser({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        roleName: form.roleName,
        provinceId: provinceId ? Number(provinceId) : undefined,
        districtId: districtId ? Number(districtId) : undefined,
      });
      setCreatedUser({ firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password, role: form.roleName });
      setShowCreate(false);
      setForm({ firstName: '', lastName: '', email: '', phone: '', password: '', roleName: 'OFFICER' });
      // reload list
      setLoading(true);
      adminApi.users(page, role !== 'ALL' ? role : undefined, q || undefined).then(setData).finally(() => setLoading(false));
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create user');
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleDelete(u: AdminUser) {
    if (!window.confirm(`Permanently delete ${u.firstName} ${u.lastName} (${u.email})? They will no longer be able to sign in. This cannot be undone.`)) return;
    try {
      await adminApi.deleteUser(u.id);
      setData((d) => (d ? { ...d, users: d.users.filter((x) => x.id !== u.id), pagination: { ...d.pagination, total: d.pagination.total - 1 } } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete user');
    }
  }

  return (
    <div className="space-y-6">
      <div className="gov-card p-6">
        <PageHeader
          title="User management"
          subtitle={data ? `${data.pagination.total} users` : undefined}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link to="/" className="btn-outline text-sm">Home</Link>
              <Link to="/dashboard" className="btn-outline text-sm">Dashboard</Link>
              <button className="btn-primary text-sm" onClick={() => setShowCreate((v) => !v)}>{showCreate ? 'Close' : '+ Create staff user'}</button>
            </div>
          }
        />
      </div>

      {error && <ErrorBox message={error} />}

      {/* Sign-in credentials shown once, right after the account is created. */}
      {createdUser && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold"><i className="fa-solid fa-circle-check" aria-hidden="true" /> User created — share these sign-in credentials</p>
              <div className="mt-2 space-y-1 font-mono text-xs">
                <p>{createdUser.firstName} {createdUser.lastName} · {createdUser.role.replace(/_/g, ' ')} </p>
                <p>Email: <span className="font-bold">{createdUser.email}</span></p>
                <p>Temporary password: <span className="font-bold">{createdUser.password}</span></p>
              </div>
              <p className="mt-2 text-xs">They can now sign in on the login page with this email and password and will land on their role's dashboard.</p>
            </div>
            <button type="button" className="btn-outline !py-1 text-xs" onClick={() => setCreatedUser(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="gov-card mb-6 space-y-4 p-6">
          <h2 className="text-lg font-bold text-slate-900">Create staff user</h2>
          {createError && <ErrorBox message={createError} />}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">First name *</label>
              <input className="input" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Last name *</label>
              <input className="input" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Role *</label>
              <select className="input" value={form.roleName} onChange={(e) => setForm((f) => ({ ...f, roleName: e.target.value }))}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">Temporary password *</label>
              <input type="password" className="input" minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Province</label>
              <select className="input" value={provinceId} onChange={(e) => { setProvinceId(e.target.value); setDistrictId(''); }}>
                <option value="">—</option>
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">District</label>
              <select className="input" value={districtId} disabled={!provinceId} onChange={(e) => setDistrictId(e.target.value)}>
                <option value="">—</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn-primary" disabled={createBusy}>{createBusy ? 'Creating…' : 'Create user'}</button>
        </form>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className="input w-48" value={role} onChange={(e) => update({ role: e.target.value })}>
          <option value="ALL">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <input
          className="input w-72"
          placeholder="Search name or email…"
          value={q}
          onChange={(e) => update({ q: e.target.value })}
        />
      </div>

      {loading && <Spinner />}

      {!loading && !error && data && data.users.length === 0 && (
        <EmptyState icon="fa-users" title="No users found" hint="Adjust the filters or create a new staff user." />
      )}

      {!loading && !error && data && data.users.length > 0 && (
        <div className="gov-card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-slate-400">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <select className={`badge border-0 ${ROLE_BADGE[u.role] ?? 'bg-slate-100 text-slate-600'}`} value={u.role} onChange={async (event) => { try { await adminApi.setUserRole(u.id, event.target.value); setData((d) => d ? { ...d, users: d.users.map((item) => item.id === u.id ? { ...item, role: event.target.value as AdminUser['role'] } : item) } : d); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update user role'); } }}>
                      {ROLES.map((roleName) => <option key={roleName} value={roleName}>{roleName.replace(/_/g, ' ')}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {[u.district, u.province].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                      {u.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        className={u.isActive ? 'btn-danger !px-3 !py-1 text-xs' : 'btn-success !px-3 !py-1 text-xs'}
                        onClick={() => toggleStatus(u)}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      {isSystemAdmin && (
                        <button
                          className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          title={u.id === currentUser?.id ? 'You cannot delete your own account' : 'Permanently delete this user'}
                          disabled={u.id === currentUser?.id}
                          onClick={() => handleDelete(u)}
                        >
                          <i className="fa-solid fa-trash-can" aria-hidden="true" /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && data && (
        <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={(p) => update({ page: p })} />
      )}
    </div>
  );
}
