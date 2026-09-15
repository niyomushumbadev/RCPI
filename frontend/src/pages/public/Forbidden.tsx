import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ForbiddenPage() {
  const { user } = useAuth();
  const home = user?.role === 'CITIZEN' ? '/citizen/dashboard' : ['OFFICER', 'ANALYST'].includes(user?.role ?? '') ? '/workflow' : '/admin';
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="gov-strip" />
      <div className="mx-auto flex min-h-[calc(100vh-8px)] max-w-xl items-center justify-center px-4 py-10">
        <div className="gov-shell w-full p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">🚫</div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">403 forbidden</p>
          <h1 className="mt-3 text-3xl font-black text-slate-900">Access denied</h1>
          <p className="mt-3 text-sm text-slate-600">
            Your account is signed in as <strong>{user?.role?.replace(/_/g, ' ') ?? 'an authenticated user'}</strong>. This section requires a different role.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to={home} className="btn-primary">Return to dashboard</Link>
            <Link to="/login" className="btn-outline">Login with another account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
