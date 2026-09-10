import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RwandaFlagLogo from '../components/RwandaFlagLogo';

export default function Landing() {
  const { user } = useAuth();

  const features = [
    { icon: '📝', title: 'Citizen reporting', text: 'Fast and secure reporting of community issues across districts and sectors.' },
    { icon: '🤖', title: 'AI intelligence', text: 'Automatic classification, image analysis, duplication checks, severity scoring, and confidence-based recommendations.' },
    { icon: '🏛️', title: 'Government workflow', text: 'Structured review, assignment and accountability through public service channels.' },
    { icon: '🗺️', title: 'District visibility', text: 'Monitor priority needs and service delivery across Rwanda with clear oversight.' },
    { icon: '🔔', title: 'Transparent updates', text: 'Receive status updates and feedback from responsible institutions in real time.' },
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

          <div className="gov-card overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-rwanda-blue via-rwanda-yellow to-rwanda-green" />
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

              <div className="mt-5 rounded-2xl border border-rwanda-green/15 bg-rwanda-green/5 p-4">
                <p className="text-sm text-slate-600">Trusted integrity</p>
                <p className="mt-1 text-3xl font-black text-rwanda-green">99.9%</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">Secure access availability</p>
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

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
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
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
        Rwanda Community Problem Intelligence Platform · Public service transparency and accountability.
      </footer>
    </div>
  );
}
