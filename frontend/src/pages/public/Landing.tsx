import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { citizenApi } from '../../lib/api';
import type { CommunityAlert, CommunityInsights } from '../../types';
import RwandaFlagLogo from '../../components/RwandaFlagLogo';
import RwandaFooterMap from '../../components/RwandaFooterMap';
import { t } from '../../translations';

const SEVERITY_STYLE: Record<string, string> = {
  INFO: 'border-blue-200 bg-blue-50 text-blue-800',
  WARNING: 'border-amber-200 bg-amber-50 text-amber-800',
  CRITICAL: 'border-red-200 bg-red-50 text-red-800',
};

export default function Landing() {
  const { user } = useAuth();

  // Live, privacy-safe public aggregates — no login required.
  const [insights, setInsights] = useState<CommunityInsights | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);
  const [alerts, setAlerts] = useState<CommunityAlert[]>([]);

  useEffect(() => {
    citizenApi.insights().then(setInsights).catch(() => setStatsFailed(true));
    citizenApi.alerts().then((r) => setAlerts(r.alerts.slice(0, 3))).catch(() => {});
  }, []);

  const resolutionRate = insights && insights.stats.totalReports > 0
    ? Math.round((insights.stats.resolvedReports / insights.stats.totalReports) * 100)
    : null;
  const maxCategoryCount = insights ? Math.max(1, ...insights.mostReported.map((c) => c.count)) : 1;

  const features = [
    { icon: 'fa-file-pen', title: t('landing.f1Title'), text: t('landing.f1Text') },
    { icon: 'fa-robot', title: t('landing.f2Title'), text: t('landing.f2Text') },
    { icon: 'fa-map-location-dot', title: t('landing.f3Title'), text: t('landing.f3Text') },
    { icon: 'fa-traffic-light', title: t('landing.f4Title'), text: t('landing.f4Text') },
    { icon: 'fa-rotate', title: t('landing.f5Title'), text: t('landing.f5Text') },
    { icon: 'fa-chart-column', title: t('landing.f6Title'), text: t('landing.f6Text') },
    { icon: 'fa-bell', title: t('landing.f7Title'), text: t('landing.f7Text') },
    { icon: 'fa-shield-halved', title: t('landing.f8Title'), text: t('landing.f8Text') },
  ];

  const roles = [
    [t('landing.role1Title'), t('landing.role1Text')],
    [t('landing.role2Title'), t('landing.role2Text')],
    [t('landing.role3Title'), t('landing.role3Text')],
    [t('landing.role4Title'), t('landing.role4Text')],
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="gov-strip" />

      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-3">
            <RwandaFlagLogo className="border-2 border-rwanda-blue bg-rwanda-blue/5" size={44} />
            <div>
              <div className="text-sm font-black uppercase tracking-[0.12em] text-rwanda-green">{t('nav.systemName')}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{t('landing.rwandaPublicService')}</div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/track" className="btn-outline">{t('landing.ctaTrack')}</Link>
            {user ? (
              <Link to="/dashboard" className="btn-primary">{t('nav.portal')}</Link>
            ) : (
              <>
                <Link to="/login" className="btn-outline">{t('landing.ctaLogin')}</Link>
                <Link to="/register" className="btn-primary">{t('auth.createAccount')}</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-12">
        <section className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <span className="gov-badge">{t('landing.badge')}</span>
            <h1 className="mt-6 max-w-xl text-4xl font-black leading-tight text-slate-900 sm:text-5xl">
              {t('landing.heroTitle2').split('community priorities')[0] && t('landing.heroTitle2')}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">{t('landing.heroText2')}</p>

            {!user && (
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/register" className="btn-primary px-6 py-3 text-base">{t('landing.registerCitizen')}</Link>
                <Link to="/login" className="btn-outline px-6 py-3 text-base">{t('landing.govLogin')}</Link>
                <Link to="/track" className="btn-outline px-6 py-3 text-base"><i className="fa-solid fa-magnifying-glass-location" aria-hidden="true" /> {t('landing.ctaTrack')}</Link>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rwanda-green" /> {t('landing.pillNational')}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rwanda-blue" /> {t('landing.pillDistrict')}
              </div>
            </div>
          </div>

          <div className="gov-card overflow-hidden border-rwanda-blue/20 shadow-xl shadow-slate-200/60">
            <div className="h-2 bg-rwanda-blue" />
            <div className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('landing.serviceDashboard')}</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">{t('landing.nationalOverview')}</h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{t('landing.active')}</span>
              </div>

              <div className="space-y-4">
                {[
                  [t('landing.svc1Title'), t('landing.svc1Text'), '24/7'],
                  [t('landing.svc2Title'), t('landing.svc2Text'), t('landing.pillDistrict')],
                  [t('landing.svc3Title'), t('landing.svc3Text'), t('landing.live')],
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
                <div className="flex items-center justify-between"><p className="text-sm text-blue-100">{t('landing.sharedPicture')}</p><span className="rounded-full bg-rwanda-yellow px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-900">{t('landing.live')}</span></div>
                <p className="mt-3 text-3xl font-black">{t('landing.reportAction')}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-300">{t('landing.evidenceWorkflowInsight')}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t('landing.platformFeatures')}</p>
              <h2 className="mt-2 text-3xl font-black text-slate-900">{t('landing.builtForDelivery')}</h2>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="gov-card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-primary/20 bg-brand-primary/5 text-xl text-brand-primary">
                  <i className={`fa-solid ${f.icon}`} aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Live community pulse — public, privacy-safe aggregates from the API */}
        <section className="mt-16">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t('landing.pulse')}</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">{t('landing.pulseTitle')}</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">{t('landing.pulseSub')}</p>
          </div>

          {insights ? (
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { icon: 'fa-clipboard-list', label: t('landing.stat1Label'), value: insights.stats.totalReports, note: t('landing.stat1Note') },
                  { icon: 'fa-circle-check', label: t('landing.stat2Label'), value: insights.stats.resolvedReports, note: resolutionRate != null ? `${resolutionRate}% ${t('landing.stat2Label')}` : t('landing.noPublicReports') },
                  { icon: 'fa-screwdriver-wrench', label: t('landing.stat3Label'), value: insights.stats.inProgressReports, note: t('landing.stat3Note') },
                  { icon: 'fa-magnifying-glass', label: t('landing.stat4Label'), value: insights.stats.underReviewReports, note: t('landing.stat4Note') },
                ].map((s) => (
                  <div key={s.label} className="gov-card p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-primary/20 bg-brand-primary/5 text-brand-primary">
                      <i className={`fa-solid ${s.icon}`} aria-hidden="true" />
                    </div>
                    <p className="mt-4 text-3xl font-black text-slate-900">{s.value.toLocaleString()}</p>
                    <p className="text-sm font-semibold text-slate-700">{s.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{s.note}</p>
                  </div>
                ))}
              </div>

              <div className="gov-card p-6">
                <h3 className="font-bold text-slate-900">{t('landing.mostReportedCats')}</h3>
                <p className="mt-1 text-xs text-slate-500">{t('landing.mostReportedSub')}</p>
                {insights.mostReported.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-400">{t('landing.noPublicReports')}</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {insights.mostReported.map((c) => (
                      <li key={c.name}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700">{c.icon ? `${c.icon} ` : ''}{c.name}</span>
                          <span className="font-bold text-slate-900">{c.count}</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-slate-100">
                          <div className="h-2 rounded-full bg-rwanda-blue" style={{ width: `${Math.max(6, Math.round((c.count / maxCategoryCount) * 100))}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <Link to="/register" className="btn-primary mt-6 inline-flex">{t('landing.ctaReport')}</Link>
              </div>
            </div>
          ) : statsFailed ? (
            <div className="gov-card p-6 text-sm text-slate-500">{t('landing.statsUnavailable')}</div>
          ) : (
            <div className="gov-card p-6 text-sm text-slate-500">{t('landing.statsLoading')}</div>
          )}

          {alerts.length > 0 && (
            <div className="mt-4 space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-4 py-3 text-sm ${SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.INFO}`}>
                  <i className="fa-solid fa-bullhorn" aria-hidden="true" />
                  <span className="text-xs font-black uppercase tracking-[0.12em]">{t(`alert.${a.severity}`)}</span>
                  <span className="font-semibold">{a.title}</span>
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl bg-slate-900 p-7 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rwanda-yellow">{t('landing.designedForRwanda')}</p>
            <h2 className="mt-3 text-3xl font-black">{t('landing.onePlatform')}</h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">{t('landing.onePlatformText')}</p>
            <Link to="/register" className="mt-6 inline-flex btn-primary">{t('landing.startReporting')}</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map(([title, text]) => <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1.25fr_0.8fr_0.9fr_1.35fr]">
          <div><div className="flex items-center gap-3"><RwandaFlagLogo className="border border-white/20 bg-white/10" size={38} /><div><p className="text-xs font-black uppercase tracking-[0.14em] text-white">R-CPI</p><p className="text-xs text-slate-400">Rwanda Community Problem Intelligence</p></div></div><p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">{t('landing.footerTagline')}</p><div className="mt-5 flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full bg-rwanda-green" /> {t('landing.digitalPublicService')}</div></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-rwanda-yellow">{t('landing.quickLinks')}</p><div className="mt-3 space-y-2 text-sm"><Link className="block hover:text-white" to="/register">{t('landing.citizenReporting')}</Link><Link className="block hover:text-white" to="/track">{t('landing.ctaTrack')}</Link><Link className="block hover:text-white" to="/login">{t('landing.govAccess')}</Link><Link className="block hover:text-white" to="/community">{t('community.insights')}</Link><Link className="block hover:text-white" to="/map">{t('community.map')}</Link></div></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-rwanda-yellow">{t('landing.support')}</p><div className="mt-3 space-y-2 text-sm"><Link className="block hover:text-white" to="/help">{t('landing.helpCentre')}</Link><Link className="block hover:text-white" to="/login">{t('landing.secureSignIn')}</Link><span className="block text-slate-400">{t('landing.roleBased')}</span><span className="block text-slate-400">{t('landing.auditReady')}</span><span className="block text-slate-400">Kinyarwanda · English · Français</span></div></div>
          <RwandaFooterMap />
        </div>
        <div className="border-t border-white/10"><div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-4 py-4 text-xs text-slate-500"><span>{t('landing.footerBuilt')}</span><span>{t('landing.footerAccess')}</span></div></div>
      </footer>
    </div>
  );
}
