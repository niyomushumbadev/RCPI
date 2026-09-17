import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, geoApi, metaApi } from '../../lib/api';
import type { Category, CommunityAlert, Department, District, Province } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ErrorBox, PageHeader } from '../../components/ui';
import { t } from '../../translations';

export default function AdminManagement() {
  const { user } = useAuth();
  const isSystemAdmin = user?.role === 'SYSTEM_ADMIN';
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
  // Alert lifecycle management (CRUD beyond the create form).
  const [alerts, setAlerts] = useState<CommunityAlert[]>([]);
  const [editingAlert, setEditingAlert] = useState<{ id: number; title: string; message: string } | null>(null);

  async function load() {
    try {
      const [cats, deps, geo, permissions, alertList] = await Promise.all([metaApi.categories(false), metaApi.departments(true), geoApi.provinces(), adminApi.permissions().catch(() => null), adminApi.allAlerts()]);
      setCategories(cats.categories); setDepartments(deps.departments); setProvinces(geo.provinces);
      setAlerts(alertList.alerts);
      if (permissions) {
        setPermissionData(permissions);
        if (selectedRoleId === null && permissions.roles[0]) { setSelectedRoleId(permissions.roles[0].id); setSelectedPermissions(permissions.roles[0].permissions); }
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('common.error')); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (provinceId) geoApi.districts(Number(provinceId)).then((r) => setDistricts(r.districts)).catch(() => {}); else setDistricts([]); }, [provinceId]);
  useEffect(() => { const role = permissionData?.roles.find((item) => item.id === selectedRoleId); if (role) setSelectedPermissions(role.permissions); }, [permissionData, selectedRoleId]);

  async function submit(action: () => Promise<unknown>, success: string) {
    setError(''); setMessage('');
    try { await action(); setMessage(success); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : t('common.error')); }
  }

  function confirmDelete(label: string, action: () => Promise<unknown>) {
    if (window.confirm(t('common.confirmDelete'))) void submit(action, `${t('common.delete')}: ${label}`);
  }

  function toggleActive(kind: 'category' | 'department', id: number, isActive: boolean) {
    const action = kind === 'category'
      ? () => adminApi.updateCategory(id, { isActive })
      : () => adminApi.updateDepartment(id, { isActive });
    void submit(action, `${kind === 'category' ? 'Category' : 'Department'} ${isActive ? 'activated' : 'deactivated'}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.managementTitle')} subtitle={t('admin.managementSubtitle')} actions={<div className="flex gap-2"><Link to="/admin" className="btn-outline">{t('nav.administration')}</Link><Link to="/admin/users" className="btn-outline">{t('nav.manageUsers')}</Link></div>} />
      {message && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</div>}
      {error && <ErrorBox message={error} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <form className="gov-card space-y-3 p-5" onSubmit={(event) => { event.preventDefault(); void submit(() => adminApi.createCategory(category), t('admin.addCategory')); }}><h2 className="font-bold text-slate-900">{t('admin.categories')}</h2><input className="input" placeholder={t('admin.categoryName')} value={category.name} onChange={(e) => setCategory({ ...category, name: e.target.value })} required /><div className="grid grid-cols-2 gap-2"><input className="input" placeholder="Kinyarwanda" value={category.nameRw} onChange={(e) => setCategory({ ...category, nameRw: e.target.value })} /><input className="input" placeholder="French" value={category.nameFr} onChange={(e) => setCategory({ ...category, nameFr: e.target.value })} /></div><div className="flex gap-2"><input className="input" placeholder="Icon" value={category.icon} onChange={(e) => setCategory({ ...category, icon: e.target.value })} /><input className="input" type="color" value={category.color} onChange={(e) => setCategory({ ...category, color: e.target.value })} /></div><button className="btn-primary">{t('admin.addCategory')}</button><div className="border-t border-slate-100 pt-3 text-xs text-slate-500">{categories.map((item) => (
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

        <form className="gov-card space-y-3 p-5" onSubmit={(event) => { event.preventDefault(); void submit(() => adminApi.createDepartment(department), 'Department created'); }}><h2 className="font-bold text-slate-900">{t('admin.departments')}</h2><input className="input" placeholder={t('admin.departmentName')} value={department.name} onChange={(e) => setDepartment({ ...department, name: e.target.value })} required /><input className="input" type="email" placeholder={t('auth.email')} value={department.email} onChange={(e) => setDepartment({ ...department, email: e.target.value })} /><input className="input" placeholder={t('auth.phone')} value={department.phone} onChange={(e) => setDepartment({ ...department, phone: e.target.value })} /><button className="btn-primary">{t('admin.addDepartment')}</button><div className="border-t border-slate-100 pt-3 text-xs text-slate-500">{departments.map((item) => (
          <div className="flex items-center justify-between gap-1 py-1" key={item.id}>
            {editingDepartment?.id === item.id ? (
              <>
                <input className="input !py-1 text-xs" value={editingDepartment.name} autoFocus onChange={(e) => setEditingDepartment({ ...editingDepartment, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') void submit(() => adminApi.updateDepartment(item.id, { name: editingDepartment.name.trim() }), t('common.save')); if (e.key === 'Escape') setEditingDepartment(null); }} />
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
                  <button className="text-slate-400 hover:text-brand-primary" aria-label={t('common.edit')} onClick={() => setEditingDepartment({ id: item.id, name: item.name })}><i className="fa-solid fa-pen" aria-hidden="true" /></button>
                  <button className="text-slate-400 hover:text-red-600" aria-label={t('common.delete')} onClick={() => confirmDelete(t('admin.departments'), () => adminApi.deleteDepartment(item.id))}><i className="fa-solid fa-trash-can" aria-hidden="true" /></button>
                </span>
              </>
            )}
          </div>
        ))}</div></form>

        <form className="gov-card space-y-3 p-5" onSubmit={(event) => { event.preventDefault(); void submit(() => adminApi.createAlert({ title: alert.title, message: alert.message, severity: alert.severity, category: alert.category || undefined, districtId: alert.districtId ? Number(alert.districtId) : undefined }), 'Alert published'); }}><h2 className="font-bold text-slate-900">{t('admin.alerts')}</h2><p className="text-xs text-slate-500">{t('admin.manageAlertsHint')}</p><input className="input" placeholder={t('admin.alertTitle')} value={alert.title} onChange={(e) => setAlert({ ...alert, title: e.target.value })} required /><textarea className="input min-h-24" placeholder="Message" value={alert.message} onChange={(e) => setAlert({ ...alert, message: e.target.value })} required /><select className="input" value={alert.severity} onChange={(e) => setAlert({ ...alert, severity: e.target.value })}><option>INFO</option><option>WARNING</option><option>CRITICAL</option></select><input className="input" placeholder="Category (optional)" value={alert.category} onChange={(e) => setAlert({ ...alert, category: e.target.value })} /><select className="input" value={provinceId} onChange={(e) => { setProvinceId(e.target.value); setAlert({ ...alert, districtId: '' }); }}><option value="">{t('admin.alertTarget')}</option>{provinces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="input" value={alert.districtId} disabled={!provinceId} onChange={(e) => setAlert({ ...alert, districtId: e.target.value })}><option value="">{t('admin.alertTargetDistrict')}</option>{districts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="btn-primary">{t('admin.publishAlert')}</button></form>
      </div>

      {/* Alert lifecycle management — edit, toggle, delete existing alerts */}
      <section className="gov-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">{t('admin.manageAlerts')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('admin.manageAlertsHint')}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{alerts.length} {t('common.total')}</span>
        </div>
        {alerts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">{t('admin.noAlerts')}</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                {editingAlert?.id === a.id ? (
                  <div className="min-w-0 flex-1 space-y-2">
                    <input className="input" value={editingAlert.title} onChange={(e) => setEditingAlert({ ...editingAlert, title: e.target.value })} aria-label={t('admin.alertTitle')} />
                    <textarea className="input min-h-16" value={editingAlert.message} onChange={(e) => setEditingAlert({ ...editingAlert, message: e.target.value })} aria-label={t('admin.alertMessage')} />
                    <div className="flex gap-2">
                      <button type="button" className="btn-primary !py-1.5 text-xs" onClick={() => void submit(() => adminApi.updateAlert(a.id, { title: editingAlert.title.trim(), message: editingAlert.message.trim() }), t('common.save')).then(() => setEditingAlert(null))}>{t('common.save')}</button>
                      <button type="button" className="btn-outline !py-1.5 text-xs" onClick={() => setEditingAlert(null)}>{t('common.cancel')}</button>
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800"><i className="fa-solid fa-bullhorn text-slate-400" aria-hidden="true" />{a.title}<span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${a.severity === 'CRITICAL' ? 'bg-red-50 text-red-700' : a.severity === 'WARNING' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{a.severity}</span></p>
                    <p className="mt-0.5 text-xs text-slate-500">{a.message}</p>
                  </div>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${a.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                    title={a.isActive ? t('admin.deactivate') : t('admin.activate')}
                    onClick={() => void submit(() => adminApi.updateAlert(a.id, { isActive: !a.isActive }), `Alert ${a.isActive ? 'retired' : 're-activated'}`)}
                  >
                    {a.isActive ? 'Active' : 'Retired'}
                  </button>
                  <button className="text-slate-400 hover:text-brand-primary" aria-label={t('common.edit')} onClick={() => setEditingAlert({ id: a.id, title: a.title, message: a.message })}><i className="fa-solid fa-pen" aria-hidden="true" /></button>
                  <button className="text-slate-400 hover:text-red-600" aria-label={t('common.delete')} onClick={() => confirmDelete(t('admin.alerts'), () => adminApi.deleteAlert(a.id))}><i className="fa-solid fa-trash-can" aria-hidden="true" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {permissionData && isSystemAdmin && (
        <section className="gov-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">{t('admin.rolePermissions')}</h2><p className="mt-1 text-sm text-slate-500">{t('admin.rolePermissionsHint')}</p></div><select className="input !w-56" value={selectedRoleId ?? ''} onChange={(event) => setSelectedRoleId(Number(event.target.value))}>{permissionData.roles.map((role) => <option key={role.id} value={role.id}>{role.name.replace(/_/g, ' ')}</option>)}</select></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{permissionData.permissions.map((permission) => <label key={permission.code} className="flex gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={selectedPermissions.includes(permission.code)} onChange={(event) => setSelectedPermissions((current) => event.target.checked ? [...current, permission.code] : current.filter((code) => code !== permission.code))} /><span><span className="block text-sm font-semibold text-slate-800">{permission.name}</span><span className="block text-xs text-slate-500">{permission.description ?? permission.code}</span></span></label>)}</div>
          <button className="btn-primary mt-4" onClick={() => selectedRoleId && void submit(() => adminApi.setRolePermissions(selectedRoleId, selectedPermissions), t('admin.saveRolePermissions'))}>{t('admin.saveRolePermissions')}</button>
        </section>
      )}
    </div>
  );
}