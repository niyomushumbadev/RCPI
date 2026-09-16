import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { aiApi } from '../../lib/api';
import type { AIAnalysis, AIJob } from '../../types';
import { useAuth } from '../../context/AuthContext';

const confidence = (value: number | null) => value === null ? 'Unavailable' : `${Math.round(value * 100)}% confidence`;

export default function AIReportAnalysis() {
  const { id } = useParams();
  const reportId = Number(id);
  const { user } = useAuth();
  // Only government staff may retry analyses or confirm review (backend enforces too).
  const canAct = !!user && user.role !== 'CITIZEN';
  const [job, setJob] = useState<AIJob | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const result = await aiApi.getReportAnalysis(reportId);
      setJob(result.job);
      setAnalysis(result.analysis);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load AI analysis');
    }
  }

  useEffect(() => {
    void load();
  }, [reportId]);

  useEffect(() => {
    if (!job || !['PENDING', 'PROCESSING', 'RETRYING'].includes(job.status)) return;
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [job?.status, reportId]);

  const prediction = (type: string) => analysis?.predictions.find((item) => item.predictionType === type);
  const category = prediction('CATEGORY');
  const severity = prediction('SEVERITY');
  const spam = prediction('SPAM_RISK');
  const risk = prediction('RISK');

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="gov-badge">AI decision support</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Report intelligence</h1>
          <p className="mt-1 text-sm text-slate-500">AI predictions are advisory and remain subject to authorised human review.</p>
        </div>
        <Link className="btn-outline" to={`/reports/${reportId}`}>Back to report</Link>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {job && job.status !== 'COMPLETED' && (
        <section className="gov-card p-6">
          <h2 className="text-lg font-semibold text-slate-900">AI analysis {job.status.toLowerCase()}</h2>
          <p className="mt-2 text-sm text-slate-600">The report is available while the intelligence service processes its text, location and evidence.</p>
          {job.status === 'FAILED' && <p className="mt-3 text-sm text-red-700">{job.errorMessage ?? 'Analysis failed.'}</p>}
          {['PENDING', 'PROCESSING', 'RETRYING', 'FAILED'].includes(job.status) && canAct && (
            <button className="btn-outline mt-4" onClick={() => void aiApi.retryReportAnalysis(reportId).then(() => void load())}>Retry analysis</button>
          )}
        </section>
      )}
      {analysis && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            {[['Classification', category?.predictionValue, category?.confidenceScore], ['AI-predicted severity', severity?.predictionValue, severity?.confidenceScore], ['Potential spam risk', spam?.predictionValue, spam?.confidenceScore], ['AI risk prediction', risk?.predictionValue, risk?.confidenceScore]].map(([label, value, score]) => (
              <article className="gov-card p-5" key={String(label)}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                <p className="mt-3 text-xl font-bold text-slate-900">{value ?? 'Unavailable'}</p>
                <p className="mt-1 text-sm text-slate-500">{confidence(typeof score === 'number' ? score : null)}</p>
              </article>
            ))}
          </section>
          <section className="grid gap-6 lg:grid-cols-2">
            <article className="gov-card p-6">
              <h2 className="text-lg font-semibold text-slate-900">Possible duplicates</h2>
              {analysis.duplicateMatches.length ? analysis.duplicateMatches.map((match) => <p className="mt-3 text-sm text-slate-700" key={match.matchedReportId}>Report #{match.matchedReportId}: {Math.round(match.similarityScore * 100)}% similarity</p>) : <p className="mt-3 text-sm text-slate-500">No possible duplicate was returned.</p>}
            </article>
            <article className="gov-card p-6">
              <h2 className="text-lg font-semibold text-slate-900">AI recommendations</h2>
              {analysis.recommendations.length ? analysis.recommendations.map((item, index) => <div className="mt-3" key={`${item.recommendation}-${index}`}><p className="text-sm font-semibold text-slate-800">{item.priority}{item.department ? ` - ${item.department}` : ''}</p><p className="text-sm text-slate-600">{item.recommendation}</p></div>) : <p className="mt-3 text-sm text-slate-500">No recommendation was returned.</p>}
            </article>
          </section>
          {analysis.explanation && <section className="gov-panel p-6"><h2 className="text-lg font-semibold text-slate-900">Why this result?</h2><p className="mt-2 text-sm leading-6 text-slate-700">{analysis.explanation}</p><p className="mt-2 text-xs text-slate-500">Model: heuristic/OpenAI (see backend logs) · human review required before any official decision. {canAct && <button className="font-semibold text-rwanda-blue underline" onClick={() => void aiApi.reviewAnalysis(reportId).then(() => void load())}>Mark as reviewed</button>}</p></section>}
        </>
      )}
    </main>
  );
}