import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { aiApi, citizenApi } from '../../lib/api';
import type { AIAnalysis, ReportListItem } from '../../types';
import { t } from '../../translations';
import { PageHeader, Spinner, ErrorBox } from '../../components/ui';

interface ChatItem { id: number; from: 'citizen' | 'assistant'; text: string }

function answerSystemQuestion(question: string) {
  const text = question.toLowerCase();
  const language = getLanguage();
  if (language === 'rw') {
    if (text.includes('rapor') || text.includes('ikibazo')) return 'Kanda kuri “Report a Problem” wandike umutwe, ibisobanuro, icyiciro n’aho ikibazo kiri. Ushobora kongeraho ifoto cyangwa GPS.';
    if (text.includes('status') || text.includes('kurikir')) return 'Jya kuri “My Reports” uhitemo raporo kugira ngo urebe uko ihagaze, amateka yayo n’ubutumwa bw’abayobozi.';
    if (text.includes('ikarita') || text.includes('map')) return 'Community Map yerekana ibibazo byemejwe bifite GPS. Ushobora no gushaka ibibazo biri hafi yawe.';
    if (text.includes('konti') || text.includes('profile')) return 'Jya kuri Profile guhindura amazina, telefoni, aho utuye, ururimi cyangwa ijambo ry’ibanga.';
  }
  if (language === 'fr') {
    if (text.includes('report') || text.includes('probl')) return 'Ouvrez « Signaler un problème », ajoutez le titre, la description, la catégorie et le lieu. Vous pouvez joindre une photo ou le GPS.';
    if (text.includes('status') || text.includes('suivre')) return 'Ouvrez « Mes signalements » pour suivre le statut, l’historique et les messages liés à votre signalement.';
    if (text.includes('carte') || text.includes('map')) return 'La carte communautaire montre les problèmes vérifiés avec des coordonnées GPS et les problèmes proches de vous.';
  }
  if (text.includes('report') || text.includes('problem') || text.includes('issue')) return 'Open Report a Problem, describe what happened, choose a category, add the location, and submit. You can attach evidence and use GPS.';
  if (text.includes('status') || text.includes('track') || text.includes('progress')) return 'Open My Reports to see status, timeline, official updates, messages, AI analysis and feedback options.';
  if (text.includes('map') || text.includes('near')) return 'Open Community Map to view verified public problems, use your location, and inspect nearby issues.';
  if (text.includes('ai') || text.includes('assistant')) return 'I can explain reporting, report status, maps, notifications, profile settings, evidence, privacy and feedback. Ask me in Kinyarwanda, English or French.';
  if (text.includes('password') || text.includes('profile') || text.includes('account')) return 'Open Profile to update your personal details and change your password. Never share your password in a report or message.';
  if (text.includes('notification') || text.includes('alert')) return 'Open Notifications to read report updates and community alerts. You can mark individual messages or all messages as read.';
  if (text.includes('privacy') || text.includes('anonymous')) return 'You can submit a report anonymously. Access is role-controlled, and government actions are recorded in the audit trail.';
  return 'I can help with reporting a problem, tracking status, maps, notifications, profile settings, evidence, privacy, feedback and AI analysis. What would you like to know?';
}

function getHeuristicSummary(text: string) {
  const value = text.toLowerCase();
  const matches = [
    { category: 'Drainage', score: value.includes('drain') || value.includes('flood') || value.includes('sewer') ? 1 : 0, severity: 'HIGH' },
    { category: 'Road', score: value.includes('road') || value.includes('pothole') || value.includes('bridge') ? 1 : 0, severity: 'MEDIUM' },
    { category: 'Waste', score: value.includes('garbage') || value.includes('rubbish') || value.includes('dump') ? 1 : 0, severity: 'MEDIUM' },
    { category: 'Water', score: value.includes('water') || value.includes('pipe') || value.includes('tap') ? 1 : 0, severity: 'HIGH' },
    { category: 'Electricity', score: value.includes('electric') || value.includes('power') || value.includes('transformer') ? 1 : 0, severity: 'HIGH' },
  ];
  const best = matches.sort((a, b) => b.score - a.score)[0] ?? { category: 'General infrastructure', severity: 'MEDIUM' };
  const confidence = Math.min(96, 58 + (best.score * 20) + (value.length > 80 ? 10 : 0));

  return {
    category: best.category,
    severity: value.includes('danger') || value.includes('urgent') || value.includes('unsafe') ? 'HIGH' : best.severity,
    confidence: Math.round(confidence),
    summary: `This report is most likely related to ${best.category.toLowerCase()} and should be reviewed with ${best.severity.toLowerCase()} urgency.`,
  };
}

export default function AIAssistant() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState<ChatItem[]>([{ id: 1, from: 'assistant', text: t('citizen.aiAssistantSubtitle') }]);

  useEffect(() => {
    citizenApi.reports()
      .then(({ reports: items }) => {
        setReports(items.slice(0, 5));
        setSelectedId(items[0]?.id ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('common.error')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let isActive = true;
    aiApi.getReportAnalysis(selectedId)
      .then((result) => {
        if (isActive) setAnalysis(result.analysis);
      })
      .catch(() => {
        if (isActive) setAnalysis(null);
      });
    return () => { isActive = false; };
  }, [selectedId]);

  const selectedReport = useMemo(() => reports.find((report) => report.id === selectedId) ?? reports[0] ?? null, [reports, selectedId]);
  const heuristicSummary = useMemo(
    () => selectedReport ? getHeuristicSummary(`${selectedReport.title} ${selectedReport.categoryName} ${selectedReport.reference}`) : null,
    [selectedReport]
  );

  function askAssistant(event: React.FormEvent) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt) return;
    setChat((items) => [...items, { id: Date.now(), from: 'citizen', text: prompt }, { id: Date.now() + 1, from: 'assistant', text: answerSystemQuestion(prompt) }]);
    setQuestion('');
  }

  if (loading) return <Spinner label={t('common.loading')} />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t('citizen.aiAssistantTitle')}
        subtitle={t('citizen.aiAssistantSubtitle')}
      />

      {error && <ErrorBox message={error} />}

      <section className="card mb-6 p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">{t('citizen.aiAssistantTitle')}</h2><p className="mt-1 text-sm text-slate-500">{t('citizen.aiAssistantSubtitle')}</p></div><span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">RW · EN · FR</span></div>
        <div className="mt-4 max-h-56 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3">{chat.map((item) => <div key={item.id} className={`flex ${item.from === 'citizen' ? 'justify-end' : 'justify-start'}`}><p className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${item.from === 'citizen' ? 'bg-rwanda-blue text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{item.text}</p></div>)}</div>
        <form className="mt-3 flex gap-2" onSubmit={askAssistant}><input className="input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t('citizen.messagePlaceholder')} aria-label={t('citizen.aiAssistantTitle')} /><button className="btn-primary" disabled={!question.trim()}>{t('common.send')}</button></form>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
        <aside className="card p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">{t('citizen.recentReports')}</h2>
          <div className="space-y-2">
            {reports.length === 0 ? (
              <p className="text-sm text-slate-500">No reports available to review yet.</p>
            ) : (
              reports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  className={`w-full rounded-xl border p-3 text-left transition ${selectedId === report.id ? 'border-rwanda-blue bg-rwanda-blue/5' : 'border-slate-200 hover:bg-slate-50'}`}
                  onClick={() => setSelectedId(report.id)}
                >
                  <p className="font-semibold text-slate-800">{report.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{report.reference} · {report.categoryName}</p>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="space-y-4">
          {selectedReport && (
            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Selected report</p>
                  <h3 className="mt-2 text-xl font-bold text-slate-900">{selectedReport.title}</h3>
                </div>
                <Link to={`/reports/${selectedReport.id}`} className="btn-outline text-sm">Open report</Link>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-sky-50 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-sky-600">Likely category</p>
                  <p className="mt-2 font-bold text-slate-900">{analysis?.predictions.find((p) => p.predictionType === 'CATEGORY')?.predictionValue ?? heuristicSummary?.category ?? 'Pending'}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-amber-600">Severity</p>
                  <p className="mt-2 font-bold text-slate-900">{analysis?.predictions.find((p) => p.predictionType === 'SEVERITY')?.predictionValue ?? heuristicSummary?.severity ?? 'Pending'}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-emerald-600">Confidence</p>
                  <p className="mt-2 font-bold text-slate-900">{analysis ? `${Math.round((analysis.overallConfidence ?? 0) * 100)}%` : `${heuristicSummary?.confidence ?? 0}%`}</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
                <p className="font-semibold">AI summary</p>
                <p className="mt-2">{analysis?.explanation ?? heuristicSummary?.summary ?? 'AI analysis is still being processed for this report.'}</p>
              </div>

              {analysis?.recommendations.length ? (
                <div className="mt-4">
                  <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400">Recommendations</h4>
                  <ul className="mt-3 space-y-2">
                    {analysis.recommendations.slice(0, 3).map((item, index) => (
                      <li key={`${item.department ?? 'department'}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">{item.priority}</span>
                        {item.department ? ` · ${item.department}` : ''}
                        <p className="mt-1">{item.recommendation}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}