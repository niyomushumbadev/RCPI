import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, geoApi, metaApi } from '../../lib/api';
import type { Category, Department, District, Province } from '../../types';
import { ErrorBox, PageHeader } from '../../components/ui';

export default function AdminManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [provinceId, setProvinceId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [category, setCategory] = useState({ name: '', nameRw: '', nameFr: '', icon: 'fa-thumbtack', color: '#1D4ED8' });
  const [department, setDepartment] = useState({ name: '', nameRw: '', nameFr: '', email: '', phone: '' });
  const [alert, setAlert] = useState({ title: '', message: '', severity: 'INFO', category: '', districtId: '' });
  // Inline edit state: which category/department row is being renamed.
  const [editingCategory, setEditingCategory] = useState<{ id: number; name: string } | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<{ id: number; name: string } | null>(null);
  const [permissionData, setPermissionData] = useState<{ permissions: Array<{ id: number; code: string; name: string; description: string | null }>; roles: Array<{ id: number; name: string; description: string | null; permissions: string[] }> } | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  async function load() {
    try {
      const [cats, deps, geo, permissions] = await Promise.all([metaApi.categories(false), metaApi.departments(true), geoApi.provinces(), adminApi.permissions()]);
      setCategories(cats.categories); setDepartments(deps.departments); setProvinces(geo.provinces);
      setPermissionData(permissions);
      if (selectedRoleId === null && permissions.roles[0]) { setSelectedRoleId(permissions.roles[0].id); setSelectedPermissions(permissions.roles[0].permissions); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to load administration data'); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (provinceId) geoApi.districts(Number(provinceId)).then((r) => setDistricts(r.districts)).catch(() => {}); else setDistricts([]); }, [provinceId]);
  useEffect(() => { const role = permissionData?.roles.find((item) => item.id === selectedRoleId); if (role) setSelectedPermissions(role.permissions); }, [permissionData, selectedRoleId]);

  async function submit(action: () => Promise<unknown>, success: string) {
    setError(''); setMessage('');
    try { await action(); setMessage(success); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save changes'); }
  }

  function confirmDelete(label: string, action: () => Promise<unknown>) {
    if (window.confirm(`Delete this ${label}? This cannot be undone.`)) void submit(action, `${label} deleted`);
  }

  function toggleActive(kind: 'category' | 'department', id: number, isActive: boolean) {
    const action = kind === 'category'
      ? () => adminApi.updateCategory(id, { isActive })
      : () => adminApi.updateDepartment(id, { isActive });
    void submit(action, `${kind === 'category' ? 'Category' : 'Department'} ${isActive ? 'activated' : 'deactivated'}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Administration management" subtitle="Manage categories, departments, geographic targeting and public alerts." actions={<div className="flex gap-2"><Link to="/admin" className="btn-outline">Administration</Link><Link to="/admin/users" className="btn-outline">Users</Link></div>} />
      {message && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</div>}
      {error && <ErrorBox message={error} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <form className="gov-card space-y-3 p-5" onSubmit={(event) => { event.preventDefault(); void submit(() => adminApi.createCategory(category), 'Category created'); }}><h2 className="font-bold text-slate-900">Problem categories</h2><input className="input" placeholder="Category name" value={category.name} onChange={(e) => setCategory({ ...category, name: e.target.value })} required /><div className="grid grid-cols-2 gap-2"><input className="input" placeholder="Kinyarwanda" value={category.nameRw} onChange={(e) => setCategory({ ...category, nameRw: e.target.value })} /><input className="input" placeholder="French" value={category.nameFr} onChange={(e) => setCategory({ ...category, nameFr: e.target.value })} /></div><div className="flex gap-2"><input className="input" placeholder="Icon" value={category.icon} onChange={(e) => setCategory({ ...category, icon: e.target.value })} /><input className="input" type="color" value={category.color} onChange={(e) => setCategory({ ...category, color: e.target.value })} /></div><button className="btn-primary">Add category</button><div className="border-t border-slate-100 pt-3 text-xs text-slate-500">{categories.map((item) => (
          <div className="flex items-center justify-between gap-1 py-1" key={item.id}>
            {editingCategory?.id === item.id ? (
              <>
                <input className="input !py-1 text-xs" value={editingCategory.name} autoFocus onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') void submit(() => adminApi.updateCategory(item.id, { name: editingCategory.name.trim() }), 'Category updated'); if (e.key === 'Escape') setEditingCategory(null); }} />
                <button className="text-emerald-600 hover:text-emerald-800" aria-label="Save name" onClick={() => void submit(() => adminApi.updateCategory(item.id, { name: editingCategory.name.trim() }), 'Category updated')}><i className="fa-solid fa-check" aria-hidden="true" /></button>
                <button className="text-slate-400 hover:text-slate-600" aria-label="Cancel" onClick={() => setEditingCategory(null)}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
              </>
            ) : (
              <>
                <span className="min-w-0 truncate">{item.icon} {item.name}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                    title={item.isActive ? 'Click to deactivate' : 'Click to activate'}
                    onClick={() => toggleActive('category', item.id, !item.isActive)}
                  >
                    {item.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button className="text-slate-400 hover:text-brand-primary" aria-label="Rename category" onClick={() => setEditingCategory({ id: item.id, name: item.name })}><i className="fa-solid fa-pen" aria-hidden="true" /></button>
                  <button className="text-slate-400 hover:text-red-600" aria-label="Delete category" onClick={() => confirmDelete('Category', () => adminApi.deleteCategory(item.id))}><i className="fa-solid fa-trash-can" aria-hidden="true" /></button>
                </span>
              </>
            )}
          </div>
        ))}</div></form>

        <form className="gov-card space-y-3 p-5" onSubmit={(event) => { event.preventDefault(); void submit(() => adminApi.createDepartment(department), 'Department created'); }}><h2 className="font-bold text-slate-900">Departments</h2><input className="input" placeholder="Department name" value={department.name} onChange={(e) => setDepartment({ ...department, name: e.target.value })} required /><input className="input" type="email" placeholder="Email" value={department.email} onChange={(e) => setDepartment({ ...department, email: e.target.value })} /><input className="input" placeholder="Phone" value={department.phone} onChange={(e) => setDepartment({ ...department, phone: e.target.value })} /><button className="btn-primary">Add department</button><div className="border-t border-slate-100 pt-3 text-xs text-slate-500">{departments.map((item) => (
          <div className="flex items-center justify-between gap-1 py-1" key={item.id}>
            {editingDepartment?.id === item.id ? (
              <>
                <input className="input !py-1 text-xs" value={editingDepartment.name} autoFocus onChange={(e) => setEditingDepartment({ ...editingDepartment, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') void submit(() => adminApi.updateDepartment(item.id, { name: editingDepartment.name.trim() }), 'Department updated'); if (e.key === 'Escape') setEditingDepartment(null); }} />
                <button className="text-emerald-600 hover:text-emerald-800" aria-label="Save name" onClick={() => void submit(() => adminApi.updateDepartment(item.id, { name: editingDepartment.name.trim() }), 'Department updated')}><i className="fa-solid fa-check" aria-hidden="true" /></button>
                <button className="text-slate-400 hover:text-slate-600" aria-label="Cancel" onClick={() => setEditingDepartment(null)}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
              </>
            ) : (
              <>
                <span className="min-w-0 truncate">{item.name} {item.phone ? `· ${item.phone}` : ''}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                    title={item.isActive ? 'Click to deactivate' : 'Click to activate'}
                    onClick={() => toggleActive('department', item.id, !item.isActive)}
                  >
                    {item.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button className="text-slate-400 hover:text-brand-primary" aria-label="Rename department" onClick={() => setEditingDepartment({ id: item.id, name: item.name })}><i className="fa-solid fa-pen" aria-hidden="true" /></button>
                  <button className="text-slate-400 hover:text-red-600" aria-label="Delete department" onClick={() => confirmDelete('Department', () => adminApi.deleteDepartment(item.id))}><i className="fa-solid fa-trash-can" aria-hidden="true" /></button>
                </span>
              </>
            )}
          </div>
        ))}</div></form>

        <form className="gov-card space-y-3 p-5" onSubmit={(event) => { event.preventDefault(); void submit(() => adminApi.createAlert({ title: alert.title, message: alert.message, severity: alert.severity, category: alert.category || undefined, districtId: alert.districtId ? Number(alert.districtId) : undefined }), 'Alert published'); }}><h2 className="font-bold text-slate-900">Community alert</h2><input className="input" placeholder="Alert title" value={alert.title} onChange={(e) => setAlert({ ...alert, title: e.target.value })} required /><textarea className="input min-h-24" placeholder="Message" value={alert.message} onChange={(e) => setAlert({ ...alert, message: e.target.value })} required /><select className="input" value={alert.severity} onChange={(e) => setAlert({ ...alert, severity: e.target.value })}><option>INFO</option><option>WARNING</option><option>CRITICAL</option></select><input className="input" placeholder="Category (optional)" value={alert.category} onChange={(e) => setAlert({ ...alert, category: e.target.value })} /><select className="input" value={provinceId} onChange={(e) => { setProvinceId(e.target.value); setAlert({ ...alert, districtId: '' }); }}><option value="">Target province</option>{provinces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="input" value={alert.districtId} disabled={!provinceId} onChange={(e) => setAlert({ ...alert, districtId: e.target.value })}><option value="">Target district</option>{districts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="btn-primary">Publish alert</button></form>
      </div>

      {permissionData && (
        <section className="gov-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">Role permissions</h2><p className="mt-1 text-sm text-slate-500">System admins can delegate capabilities by role. These grants are recorded in the audit log.</p></div><select className="input !w-56" value={selectedRoleId ?? ''} onChange={(event) => setSelectedRoleId(Number(event.target.value))}>{permissionData.roles.map((role) => <option key={role.id} value={role.id}>{role.name.replace(/_/g, ' ')}</option>)}</select></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{permissionData.permissions.map((permission) => <label key={permission.code} className="flex gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={selectedPermissions.includes(permission.code)} onChange={(event) => setSelectedPermissions((current) => event.target.checked ? [...current, permission.code] : current.filter((code) => code !== permission.code))} /><span><span className="block text-sm font-semibold text-slate-800">{permission.name}</span><span className="block text-xs text-slate-500">{permission.description ?? permission.code}</span></span></label>)}</div>
          <button className="btn-primary mt-4" onClick={() => selectedRoleId && void submit(() => adminApi.setRolePermissions(selectedRoleId, selectedPermissions), 'Role permissions updated')}>Save role permissions</button>
        </section>
      )}
    </div>
  );
}