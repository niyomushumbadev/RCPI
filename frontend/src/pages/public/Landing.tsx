import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import RwandaFlagLogo from '../../components/RwandaFlagLogo';
import RwandaFooterMap from '../../components/RwandaFooterMap';

export default function Landing() {
  const { user } = useAuth();

  const features = [
    { icon: '📝', title: 'Citizen reporting', text: 'Submit a problem with description, location, GPS coordinates and supporting evidence.' },
    { icon: '🤖', title: 'AI decision support', text: 'Classification, severity, risk, similarity and recommendations help teams review consistently.' },
    { icon: '🗺️', title: 'Rwanda GIS intelligence', text: 'Explore mapped reports with risk markers, location hierarchy, filters and geographic statistics.' },
    { icon: '🚦', title: 'Priority and risk', text: 'Combine urgency, age, unresolved status, location and AI signals into an explainable priority score.' },
    { icon: '🔄', title: 'Government workflow', text: 'Move reports from submission through verification, assignment, action, resolution and reopening.' },
    { icon: '📊', title: 'Analytics and predictions', text: 'Compare categories and districts, monitor resolution performance and spot emerging patterns.' },
    { icon: '🔔', title: 'Alerts and notifications', text: 'Keep citizens and public-service teams informed about reports, deadlines, risks and alerts.' },
    { icon: '🛡️', title: 'Accountability by design', text: 'Role-based access, secure evidence, audit logs and controlled communication protect every action.' },
  ];

  const roles = [
    ['Citizens', 'Report local problems, follow progress, communicate with authorities and give feedback.'],
    ['Officers', 'Review, verify, assign, investigate and resolve reports in an operational queue.'],
    ['Analysts', 'Study trends, geographic patterns, risk signals and performance indicators.'],
    ['Administrators', 'Manage users, roles, departments, categories, alerts, oversight and system governance.'],
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="gov-strip" />

      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-3">
            <RwandaFlagLogo className="border-2 border-rwanda-blue bg-rwanda-blue/5" size={44} />
            <div>
              <div className="text-sm font-black uppercase tracking-[0.12em] text-rwanda-green">Rwanda Community Problem Intelligence</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Rwanda Public Service</div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-outline">Log in</Link>
            <Link to="/register" className="btn-primary">Create account</Link>
            {user && (
              <Link to="/dashboard" className="btn-primary">Open portal</Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-12">
        <section className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <span className="gov-badge">Government digital public service</span>
            <h1 className="mt-6 max-w-xl text-4xl font-black leading-tight text-slate-900 sm:text-5xl">
              Public accountability for Rwanda’s <span className="text-rwanda-blue">community priorities</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              R-CPI helps citizens, officers and administrators collaborate securely to report, review and resolve local service challenges across the country.
            </p>

            {!user && (
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/register" className="btn-primary px-6 py-3 text-base">Register as citizen</Link>
                <Link to="/login" className="btn-outline px-6 py-3 text-base">Government login</Link>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rwanda-green" /> National service access
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rwanda-blue" /> District oversight
              </div>
            </div>
          </div>

          <div className="gov-card overflow-hidden border-rwanda-blue/20 shadow-xl shadow-slate-200/60">
            <div className="h-2 bg-rwanda-blue" />
            <div className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Service dashboard</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">National overview</h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Active</span>
              </div>

              <div className="space-y-4">
                {[
                  ['Citizen registration', 'Secure onboarding', '24/7'],
                  ['Officer approval', 'Verified access', 'Priority'],
                  ['District review', 'Workflow tracking', 'Live'],
                ].map(([title, text, state]) => (
                  <div key={title} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div>
                      <p className="font-semibold text-slate-800">{title}</p>
                      <p className="text-xs text-slate-500">{text}</p>
                    </div>
                    <span className="rounded-full border border-rwanda-blue/20 bg-rwanda-blue/5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-rwanda-blue">
                      {state}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-rwanda-blue/15 bg-slate-900 p-4 text-white">
                <div className="flex items-center justify-between"><p className="text-sm text-blue-100">One shared service picture</p><span className="rounded-full bg-rwanda-yellow px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-900">Live</span></div>
                <p className="mt-3 text-3xl font-black">Report → action</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-300">Evidence, workflow, insight</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Platform features</p>
              <h2 className="mt-2 text-3xl font-black text-slate-900">Built for public service delivery</h2>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="gov-card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-rwanda-blue/20 bg-rwanda-blue/5 text-2xl">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl bg-slate-900 p-7 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rwanda-yellow">Designed for Rwanda</p>
            <h2 className="mt-3 text-3xl font-black">One platform. Every responsible role.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">R-CPI brings citizens, districts and national teams into one accountable service loop, with the right information visible to the right people.</p>
            <Link to={user ? '/dashboard' : '/register'} className="mt-6 inline-flex btn-primary">{user ? 'Open your portal' : 'Start reporting'}</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map(([title, text]) => <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1.25fr_0.8fr_0.9fr_1.35fr]">
          <div><div className="flex items-center gap-3"><RwandaFlagLogo className="border border-white/20 bg-white/10" size={38} /><div><p className="text-xs font-black uppercase tracking-[0.14em] text-white">R-CPI</p><p className="text-xs text-slate-400">Rwanda Community Problem Intelligence</p></div></div><p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">A secure public-service platform for reporting, reviewing and resolving community problems with evidence and accountability.</p><div className="mt-5 flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full bg-rwanda-green" /> Digital public service · Kigali, Rwanda</div></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-rwanda-yellow">Quick links</p><div className="mt-3 space-y-2 text-sm"><Link className="block hover:text-white" to="/register">Citizen reporting</Link><Link className="block hover:text-white" to="/login">Government access</Link><Link className="block hover:text-white" to="/community">Community insights</Link><Link className="block hover:text-white" to="/map">Community map</Link></div></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-rwanda-yellow">Support</p><div className="mt-3 space-y-2 text-sm"><Link className="block hover:text-white" to="/citizen/help">Help centre</Link><Link className="block hover:text-white" to="/login">Secure sign in</Link><span className="block text-slate-400">Role-based access</span><span className="block text-slate-400">Audit-ready actions</span><span className="block text-slate-400">Kinyarwanda · English · Français</span></div></div>
          <RwandaFooterMap />
        </div>
        <div className="border-t border-white/10"><div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-4 py-4 text-xs text-slate-500"><span>Built for transparent community problem resolution.</span><span>Rwanda public service digital access</span></div></div>
      </footer>
    </div>
  );
}
