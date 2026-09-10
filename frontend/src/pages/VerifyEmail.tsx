import { Link } from 'react-router-dom';

export default function VerifyEmail() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="gov-strip" />
      <div className="mx-auto flex min-h-[calc(100vh-8px)] max-w-xl items-center justify-center px-4 py-10">
        <div className="gov-shell w-full p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">✅</div>
          <h1 className="text-3xl font-black text-slate-900">Email verified</h1>
          <p className="mt-3 text-sm text-slate-600">
            Your account has been successfully verified. You can now continue to the secure R-CPI portal.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/login" className="btn-primary">Go to login</Link>
            <Link to="/" className="btn-outline">Back home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
