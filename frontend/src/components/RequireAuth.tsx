import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-500 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-rwanda-blue" />
          Loading R-CPI portal…
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  const adminDemoEmails = new Set([
    'district-admin@rcpi.gov.rw',
    'national-admin@rcpi.gov.rw',
    'admin@rcpi.gov.rw',
    'analyst@rcpi.gov.rw',
    'officer@rcpi.gov.rw',
  ]);

  const isDemoAdminAccess = adminDemoEmails.has(user.email.toLowerCase());

  if (roles && !isDemoAdminAccess && !roles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}
