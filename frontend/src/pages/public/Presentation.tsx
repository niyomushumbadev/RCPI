import { useState } from 'react';
import { Link } from 'react-router-dom';

type Audience = 'general' | 'citizens' | 'officers' | 'district' | 'national' | 'technical' | 'investors' | 'students' | 'functionality';

const AUDIENCES: Array<{ id: Audience; label: string; icon: string; focus: string }> = [
  { id: 'general', label: 'General / mixed', icon: '🌍', focus: 'Problem → benefits → how it works' },
  { id: 'citizens', label: 'Citizens', icon: '🙋', focus: 'How to report and track' },
  { id: 'officers', label: 'Officers', icon: '🏢', focus: 'Daily case work' },
  { id: 'district', label: 'District admins', icon: '📊', focus: 'Performance and planning' },
  { id: 'national', label: 'National gov', icon: '🏛️', focus: 'Strategy and policy' },
  { id: 'technical', label: 'Technical', icon: '💻', focus: 'Architecture and security' },
  { id: 'investors', label: 'Investors', icon: '💼', focus: 'Market, model, growth' },
  { id: 'students', label: 'Students', icon: '🎓', focus: 'Learning and innovation' },
  { id: 'functionality', label: 'By functionality', icon: '🧩', focus: 'Feature-by-feature tour' },
];

const SLIDES: Record<Audience, Array<{ title: string; points: string[] }>> = {
  general: [
    { title: 'R-CPI — Rwanda Community Problem Intelligence', points: ['Turning community problems into intelligent action.', 'Citizens report; AI + GIS + workflow turn reports into government action.'] },
    { title: 'The problem we solve', points: ['Damaged roads, flooding, blocked drainage, waste, broken streetlights, water problems.', 'Reports get lost, go to the wrong office, repeat, and never inform planning.'] },
    { title: 'Our solution', points: ['One system: report → AI analysis → map → priority → officer action → citizen updates → analytics.'] },
    { title: 'How the system works', points: ['Citizen reports → AI analyzes → location mapped → priority calculated → officer verifies → department acts → citizen updated → analytics.'] },
    { title: 'Main value', points: ['Citizens: easy tracking. Officers: organized work. Leaders: data for planning.'] },
    { title: 'What makes R-CPI different', points: ['Not only complaints: AI + GIS + priority/risk + workflow + analytics + audit.'] },
  ],
  citizens: [
    { title: 'What is R-CPI for you?', points: ['Report problems affecting your community from your phone.'] },
    { title: 'Problems you can report', points: ['Broken roads, flooding, waste, streetlights, water, damaged facilities, environment.'] },
    { title: 'How to report', points: ['Create account → describe problem → add location → upload photo → submit → track progress.'] },
    { title: 'What happens after?', points: ['Government receives → reviews → assigns department → acts → you get updates + give feedback.'] },
  ],
  officers: [
    { title: 'Your challenge', points: ['Too many reports, duplicates, incomplete details, missed deadlines.'] },
    { title: 'One dashboard', points: ['Assigned reports, verification, deadlines, evidence, status, citizen messages, resolution.'] },
    { title: 'AI assistance (advisory only)', points: ['Summaries, category/severity suggestions, duplicates, drafts. Officers decide.'] },
    { title: 'Workflow', points: ['Receive → verify → act → update status → upload evidence → resolve or escalate.'] },
  ],
  district: [
    { title: 'District challenges', points: ['Which problems grow? Which sectors struggle? What is overdue? Where to send resources?'] },
    { title: 'District dashboard', points: ['Reports by sector, critical cases, department load, resolution rates, hotspots.'] },
    { title: 'Example', points: ['Flooding rises in 3 sectors → inspect drainage → assign departments → monitor progress.'] },
  ],
  national: [
    { title: 'National challenge', points: ['Recurring infrastructure problems, regional gaps, service performance, risks, resource needs.'] },
    { title: 'National intelligence', points: ['Trends, cross-district comparison, hotspots, recurring problems — aggregated, privacy-safe.'] },
    { title: 'Reactive → proactive', points: ['Policy planning, resource allocation, maintenance, program evaluation.'] },
  ],
  technical: [
    { title: 'Architecture', points: ['React → Node/Express API → RBAC → services → Prisma/MySQL → OpenAI → GIS → analytics.'] },
    { title: 'Backend', points: ['REST, JWT rotation, zod validation, rate limits, audit logs, secure uploads.'] },
    { title: 'AI integration', points: ['Frontend → backend → OpenAI JSON → validation → DB → human review. Offline fallback keeps workflow alive.'] },
    { title: 'Security & scale', points: ['RBAC + geo scoping, hashing, indexes, pagination, health checks, graceful shutdown.'] },
  ],
  investors: [
    { title: 'Opportunity', points: ['Communities and institutions need reported problems connected to effective action.'] },
    { title: 'Product', points: ['AI-powered civic intelligence: reporting + AI + GIS + workflow + analytics.'] },
    { title: 'Market', points: ['Rwanda districts, Kigali City, agencies, partners → East Africa, smart-city programs.'] },
    { title: 'Revenue', points: ['Subscriptions, implementation, licensing, hosting, integrations, training, support.'] },
  ],
  students: [
    { title: 'Why this project?', points: ['Real community problems + modern tech + social impact.'] },
    { title: 'Technologies', points: ['React, TypeScript, Node, Express, MySQL/Prisma, OpenAI API, Leaflet, JWT, Tailwind.'] },
    { title: 'Learning outcomes', points: ['Frontend, backend, DB design, auth, GIS, AI integration, security, UX.'] },
    { title: 'Innovation', points: ['AI inside a Rwanda-specific workflow: reports → geography → priority → analytics.'] },
  ],
  functionality: [
    { title: 'Auth & reporting', points: ['Citizen self-register; staff provisioned; JWT rotation; reset flow; tracking number RCP-YYYY-XXXXXX.'] },
    { title: 'AI analysis', points: ['Classification, summary, severity, advisory duplicates, translation rw/en/fr, briefing, drafts.'] },
    { title: 'GIS mapping', points: ['Leaflet + OpenStreetMap, markers, filters, hotspots; no private data on public maps.'] },
    { title: 'Priority & workflow', points: ['Transparent LOW/MEDIUM/HIGH/CRITICAL with reasons; verify → assign → deadline → resolve → closure → feedback/reopen.'] },    { title: 'Notifications & analytics', points: ['In-app notifications; dashboards per level; CSV export; audit trail.'] },
  ],
};

export default function Presentation() {
  const [audience, setAudience] = useState<Audience>('general');
  const [slide, setSlide] = useState(0);
  const slides = SLIDES[audience];
  const current = slides[Math.min(slide, slides.length - 1)];

  return (
    <div className="space-y-6">
      <div className="gov-card p-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-rwanda-blue">R-CPI · Rwanda Community Problem Intelligence</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">Presentation for every audience</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Turning community problems into intelligent action. Start with the problem and benefits, then go deeper only when the audience needs it.
          Story to tell: blocked drainage — one citizen report → AI triage → map → priority → officer action → citizen update → district planning.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {AUDIENCES.map((a) => (
            <button key={a.id} onClick={() => { setAudience(a.id); setSlide(0); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${audience === a.id ? 'border-rwanda-blue bg-rwanda-blue text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-rwanda-blue/40'}`}>
              {a.icon} {a.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Focus: {AUDIENCES.find((a) => a.id === audience)?.focus}</p>
      </div>

      <div className="gov-card p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Slide {Math.min(slide + 1, slides.length)} / {slides.length}</p>
          <div className="flex gap-2">
            <button className="btn-outline !px-3 !py-1.5 !text-xs" disabled={slide === 0} onClick={() => setSlide((s) => Math.max(0, s - 1))}>Prev</button>
            <button className="btn-outline !px-3 !py-1.5 !text-xs" disabled={slide >= slides.length - 1} onClick={() => setSlide((s) => Math.min(slides.length - 1, s + 1))}>Next</button>
          </div>
        </div>
        <h2 className="mt-3 text-2xl font-black text-slate-900">{current.title}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">{current.points.map((p) => <li key={p}>{p}</li>)}</ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {slides.map((s, i) => (
            <button key={s.title} onClick={() => setSlide(i)} className={`h-2.5 rounded-full ${i === Math.min(slide, slides.length - 1) ? 'w-8 bg-rwanda-blue' : 'w-2.5 bg-slate-200'}`} aria-label={`Go to slide ${i + 1}`} />
          ))}
        </div>
      </div>

      <div className="gov-card p-5 text-sm text-slate-600">
        <strong className="text-slate-900">Universal opening:</strong> Good morning. Today I present R-CPI — Rwanda Community Problem Intelligence —
        connecting citizens and government through intelligent reporting, mapping, priority analysis, workflow and analytics.
        <div className="mt-3 flex flex-wrap gap-2"><Link to="/" className="btn-outline !text-xs">Home</Link><Link to="/citizen/report/create" className="btn-primary !text-xs">See live reporting</Link></div>
      </div>
    </div>
  );
}

