import { prisma } from '../config/db';
import { env } from '../config/env';
import type { AIServiceRequest, AIServiceResponse } from '../types/ai.types';

export async function enqueueAIAnalysis(reportId: number) {
  const job = await prisma.aIJob.create({ data: { reportId } });
  try {
    await prisma.report.update({ where: { id: reportId }, data: { status: 'AI_ANALYSIS' } });
  } catch {
    // status column is free-text; ignore if the row moved on
  }
  setImmediate(() => processAIJob(job.id).catch(() => undefined));
  return job;
}

function openaiAvailable(): boolean {
  return Boolean(env.openaiApiKey);
}

// ─────────────────────────────────────────────────────────────
// In-process heuristic fallback (always available, no network).
// Mirrors the external ai-service classifier so the workflow keeps
// producing advisory AI output when OpenAI is unconfigured/unreachable.
// Output is advisory only — officers make all official decisions.
// ─────────────────────────────────────────────────────────────
const HEURISTIC_KEYWORDS: Record<string, string[]> = {
  Drainage: ['drain', 'flood', 'canal', 'sewer', 'runoff', 'stormwater'],
  Roads: ['road', 'pothole', 'street', 'bridge', 'asphalt', 'tarmac'],
  Waste: ['garbage', 'waste', 'rubbish', 'trash', 'dump', 'litter'],
  Water: ['water supply', 'pipe', 'tap', 'well', 'borehole', 'clean water'],
  Electricity: ['electric', 'power', 'transformer', 'outage', 'blackout', 'street light'],
  Health: ['clinic', 'disease', 'cholera', 'malaria', 'health centre', 'sanitation'],
  Environment: ['deforest', 'erosion', 'pollution', 'wetland', 'tree'],
  Security: ['unsafe', 'crime', 'lighting dark', 'security', 'danger'],
};

function heuristicAnalyze(report: {
  title: string;
  description: string;
  category: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  hasEvidence: boolean;
}): AIServiceResponse {
  const text = `${report.title} ${report.description}`.toLowerCase();

  // 1) Keyword-based classification with confidence proportional to evidence.
  let bestCategory = report.category;
  let bestHits = 0;
  for (const [candidate, keywords] of Object.entries(HEURISTIC_KEYWORDS)) {
    const hits = keywords.filter((k) => text.includes(k)).length;
    if (hits > bestHits) {
      bestHits = hits;
      bestCategory = candidate;
    }
  }
  const classConfidence = Math.min(0.85, 0.45 + bestHits * 0.08);

  // 2) Severity from harm signals (affected people, health risk, vulnerable groups).
  const riskWords = ['flood', 'disease', 'cholera', 'contaminat', 'sewage', 'collapse', 'unsafe', 'danger', 'injury', 'death'];
  const riskHits = riskWords.filter((w) => text.includes(w)).length;
  const affectedMatch = text.match(/(\d+)\s*(families|people|households|residents)/);
  const affected = affectedMatch ? Number(affectedMatch[1]) : 0;
  let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
  let severityScore = 0.5;
  if (riskHits >= 2 || (affected >= 100 && riskHits >= 1)) {
    severity = 'CRITICAL';
    severityScore = 0.9;
  } else if (riskHits >= 1 || affected >= 40) {
    severity = 'HIGH';
    severityScore = 0.72;
  } else if (affected < 10 && riskHits === 0) {
    severity = 'LOW';
    severityScore = 0.3;
  }

  // 3) Transparent, factual summary — never invents facts.
  const parts = [
    `Reported in ${report.district}`,
    `category "${report.category}"`,
    severity !== 'MEDIUM' ? `assessed ${severity.toLowerCase()} severity` : 'standard severity',
  ];
  if (report.latitude !== null && report.longitude !== null) parts.push('GPS coordinates provided');
  if (report.hasEvidence) parts.push('photo/evidence attached');
  if (affected > 0) parts.push(`~${affected} people mentioned as affected`);
  if (riskHits > 0) parts.push(`risk keywords: ${riskWords.filter((w) => text.includes(w)).slice(0, 3).join(', ')}`);
  const summary = `Heuristic triage: ${parts.join('; ')}. Advisory only — officer verification required.`;

  return {
    language: /[Muhamantwe|Murakoze|ikibazo]/i.test(text) ? 'rw' : 'en',
    overallConfidence: classConfidence,
    classification: {
      category: bestCategory,
      confidence: classConfidence,
      secondaryCategories: Object.entries(HEURISTIC_KEYWORDS)
        .filter(([c, ks]) => c !== bestCategory && ks.some((k) => text.includes(k)))
        .map(([c]) => c)
        .slice(0, 3),
    },
    severity: { level: severity, score: severityScore, confidence: 0.55 },
    duplicate: { possible: false, similarity: 0, matchedReportId: null },
    spamRisk: { level: 'LOW_RISK', score: 0.05 },
    risk: { level: severity, confidence: 0.55 },
    explanation: summary,
    recommendations: [
      {
        priority: severity === 'CRITICAL' || severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
        recommendation: 'Verify on site, then assign to the responsible department (heuristic suggestion — human decision required).',
      },
    ],
  };
}

async function analyzeWithOpenAI(report: {
  id: number;
  title: string;
  description: string;
  category: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
}): Promise<AIServiceResponse | null> {
  if (!openaiAvailable()) return null;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.openaiApiKey}`,
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: env.openaiModel,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are an assistant for Rwanda community-problem triage. Return STRICT JSON only with keys: summary, category, subcategory, keywords, severity {level LOW|MEDIUM|HIGH|CRITICAL, score 0-1, confidence 0-1}, department, duplicate {possible boolean, similarity 0-1}, language rw|en|fr, confidence 0-1, briefing {facts, missing, questions, nextSteps}, translation {en, rw, fr}. Only recommendations, never final government decisions. Never invent facts.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              title: report.title,
              description: report.description,
              submittedCategory: report.category,
              district: report.district,
              latitude: report.latitude,
              longitude: report.longitude,
            }),
          },
        ],
      }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const severity = (parsed.severity ?? {}) as { level?: string; score?: number; confidence?: number };
    const duplicate = (parsed.duplicate ?? {}) as { possible?: boolean; similarity?: number };
    const level = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(severity.level)) ? String(severity.level) : 'MEDIUM';
    return {
      language: typeof parsed.language === 'string' ? parsed.language : 'en',
      overallConfidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.6,
      classification: {
        category: typeof parsed.category === 'string' ? parsed.category : report.category,
        confidence: typeof severity.confidence === 'number' ? severity.confidence : 0.6,
        secondaryCategories: Array.isArray(parsed.keywords) ? parsed.keywords.map(String).slice(0, 5) : [],
      },
      severity: {
        level,
        score: typeof severity.score === 'number' ? severity.score : 0.5,
        confidence: typeof severity.confidence === 'number' ? severity.confidence : 0.6,
      },
      duplicate: {
        possible: Boolean(duplicate.possible),
        similarity: typeof duplicate.similarity === 'number' ? duplicate.similarity : 0,
        matchedReportId: null,
      },
      spamRisk: { level: 'LOW_RISK', score: 0.05 },
      risk: { level, confidence: 0.6 },
      explanation: typeof parsed.summary === 'string' ? parsed.summary : 'OpenAI-assisted triage summary.',
      recommendations: [
        {
          priority: level === 'CRITICAL' || level === 'HIGH' ? 'HIGH' : 'MEDIUM',
          department: typeof parsed.department === 'string' ? parsed.department : undefined,
          recommendation: 'Human officer review required before any official decision.',
        },
      ],
    };
  } catch {
    return null;
  }
}

async function findPossibleDuplicate(reportId: number, title: string, districtId: number): Promise<{ id: number; score: number } | null> {
  const candidates = await prisma.report.findMany({
    where: { id: { not: reportId }, districtId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, title: true },
  });
  const words = (value: string) => new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const base = words(title);
  if (base.size === 0) return null;
  let best: { id: number; score: number } | null = null;
  for (const c of candidates) {
    const other = words(c.title);
    const overlap = [...base].filter((w) => other.has(w)).length;
    const score = overlap / Math.max(base.size, 1);
    if (score >= 0.4 && (!best || score > best.score)) best = { id: c.id, score };
  }
  return best;
}

async function processAIJob(jobId: number) {
  const job = await prisma.aIJob.update({
    where: { id: jobId },
    data: { status: 'PROCESSING', attempts: { increment: 1 }, startedAt: new Date() },
    include: { report: { include: { category: true, district: true, evidence: true } } },
  });

  // Local duplicate hint (DB-based, advisory only — never auto-rejects).
  // Computed up front so every analysis path (OpenAI, service, heuristic) can use it.
  const localDup = await findPossibleDuplicate(job.report.id, job.report.title, job.report.districtId);

  try {
    // 1) Preferred: official OpenAI API via backend only (key never reaches browser).
    const openai = await analyzeWithOpenAI({
      id: job.report.id,
      title: job.report.title,
      description: job.report.description,
      category: job.report.category.name,
      district: job.report.district.name,
      latitude: job.report.latitude ? Number(job.report.latitude) : null,
      longitude: job.report.longitude ? Number(job.report.longitude) : null,
    });
    if (openai) {
      if (localDup && !openai.duplicate.matchedReportId) {
        openai.duplicate = { possible: true, similarity: localDup.score, matchedReportId: localDup.id };
      }
      await persistAIResult(jobId, job.report.id, openai, env.openaiModel, 'OpenAI-assisted triage (human review required)');
      await prisma.report.update({
        where: { id: job.report.id },
        data: { status: 'PENDING_VERIFICATION', aiModel: env.openaiModel },
      });
      return;
    }

    // 2) Fallback: internal heuristic AI service (keeps workflow alive offline).
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (env.aiServiceToken) headers['X-AI-Service-Token'] = env.aiServiceToken;
    const response = await fetch(`${env.aiServiceUrl}/ai/analyze/report`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        reportId: job.report.id,
        title: job.report.title,
        description: job.report.description,
        category: job.report.category.name,
        latitude: job.report.latitude ? Number(job.report.latitude) : null,
        longitude: job.report.longitude ? Number(job.report.longitude) : null,
        district: job.report.district.name,
        evidence: job.report.evidence.map((item) => ({ fileName: item.fileName, mimeType: item.mimeType, sizeBytes: item.sizeBytes })),
      } satisfies AIServiceRequest),
    });
    if (!response.ok) throw new Error(`AI service returned HTTP ${response.status}`);
    const result = (await response.json()) as AIServiceResponse;
    if (localDup && !result.duplicate.matchedReportId) {
      result.duplicate = { possible: true, similarity: localDup.score, matchedReportId: localDup.id };
    }

    await persistAIResult(jobId, job.report.id, result, 'heuristic-v1', 'Analysis completed by the internal AI service');
    await prisma.report.update({ where: { id: job.report.id }, data: { status: 'PENDING_VERIFICATION', aiModel: 'heuristic-v1' } });
  } catch (error) {
    // 3) Final fallback: in-process heuristic analysis (no network needed).
    // Keeps the workflow alive with advisory output when OpenAI is not
    // configured and the external AI service is unreachable.
    try {
      const heuristic = heuristicAnalyze({
        title: job.report.title,
        description: job.report.description,
        category: job.report.category.name,
        district: job.report.district.name,
        latitude: job.report.latitude ? Number(job.report.latitude) : null,
        longitude: job.report.longitude ? Number(job.report.longitude) : null,
        hasEvidence: job.report.evidence.length > 0,
      });
      if (localDup && !heuristic.duplicate.matchedReportId) {
        heuristic.duplicate = { possible: true, similarity: localDup.score, matchedReportId: localDup.id };
      }
      await persistAIResult(jobId, job.report.id, heuristic, 'heuristic-local-v1', 'In-process heuristic analysis (offline fallback — human review required)');
      await prisma.report.update({ where: { id: job.report.id }, data: { status: 'PENDING_VERIFICATION', aiModel: 'heuristic-local-v1' } });
      return;
    } catch {
      // heuristic fallback failed too — record the original failure below
    }
    await prisma.aIJob.update({ where: { id: jobId }, data: { status: 'FAILED', errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'AI processing failed' } });
    // Workflow continues manually: leave report for officer verification.
    try {
      await prisma.report.update({ where: { id: job.report.id }, data: { status: 'PENDING_VERIFICATION' } });
    } catch {
      // ignore
    }
  }
}

async function persistAIResult(jobId: number, reportId: number, result: AIServiceResponse, model: string, auditDetail: string) {
  await prisma.$transaction(async (tx) => {
    const analysis = await tx.aIAnalysis.create({
      data: {
        reportId,
        jobId,
        language: result.language,
        overallConfidence: result.overallConfidence ?? result.classification.confidence,
        explanation: result.explanation,
        imageQuality: result.imageAnalysis?.quality,
        imageUsable: result.imageAnalysis?.usable,
        predictions: {
          create: [
            { predictionType: 'CATEGORY', predictionValue: result.classification.category, confidenceScore: result.classification.confidence, modelVersion: model },
            { predictionType: 'SEVERITY', predictionValue: result.severity.level, confidenceScore: result.severity.confidence, modelVersion: model },
            { predictionType: 'SPAM_RISK', predictionValue: result.spamRisk.level, confidenceScore: 1 - result.spamRisk.score, modelVersion: model },
            ...(result.risk ? [{ predictionType: 'RISK', predictionValue: result.risk.level, confidenceScore: result.risk.confidence, modelVersion: model }] : []),
          ],
        },
        recommendations: result.recommendations ? { create: result.recommendations } : undefined,
        auditLogs: { create: { event: 'AI_PREDICTION_CREATED', detail: auditDetail } },
      },
    });
    if (result.duplicate.possible && result.duplicate.matchedReportId) {
      await tx.aIDuplicateMatch.create({ data: { analysisId: analysis.id, reportId, matchedReportId: result.duplicate.matchedReportId, similarityScore: result.duplicate.similarity, matchType: 'POSSIBLE_DUPLICATE' } });
    }
    await tx.report.update({ where: { id: reportId }, data: { aiCategory: result.classification.category, aiConfidence: result.classification.confidence, aiPriorityScore: result.severity.score, aiSummary: result.explanation, aiModel: model } });
    await tx.aIJob.update({ where: { id: jobId }, data: { status: 'COMPLETED', completedAt: new Date() } });
  });
}

export async function getAIAnalysis(reportId: number) {
  return prisma.aIAnalysis.findFirst({ where: { reportId }, orderBy: { createdAt: 'desc' }, include: { predictions: true, duplicateMatches: true, recommendations: true, job: true } });
}

export async function getAIJob(reportId: number) {
  return prisma.aIJob.findFirst({ where: { reportId }, orderBy: { createdAt: 'desc' } });
}