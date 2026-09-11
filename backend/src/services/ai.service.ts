import { prisma } from '../config/db';
import { env } from '../config/env';
import type { AIServiceRequest, AIServiceResponse } from '../types/ai.types';

export async function enqueueAIAnalysis(reportId: number) {
  const job = await prisma.aIJob.create({ data: { reportId } });
  setImmediate(() => processAIJob(job.id).catch(() => undefined));
  return job;
}

async function processAIJob(jobId: number) {
  const job = await prisma.aIJob.update({
    where: { id: jobId },
    data: { status: 'PROCESSING', attempts: { increment: 1 }, startedAt: new Date() },
    include: { report: { include: { category: true, district: true, evidence: true } } },
  });

  try {
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

    await prisma.$transaction(async (tx) => {
      const analysis = await tx.aIAnalysis.create({
        data: {
          reportId: job.report.id,
          jobId,
          language: result.language,
          overallConfidence: result.overallConfidence ?? result.classification.confidence,
          explanation: result.explanation,
          imageQuality: result.imageAnalysis?.quality,
          imageUsable: result.imageAnalysis?.usable,
          predictions: {
            create: [
              { predictionType: 'CATEGORY', predictionValue: result.classification.category, confidenceScore: result.classification.confidence, modelVersion: 'classification-v1' },
              { predictionType: 'SEVERITY', predictionValue: result.severity.level, confidenceScore: result.severity.confidence, modelVersion: 'severity-v1' },
              { predictionType: 'SPAM_RISK', predictionValue: result.spamRisk.level, confidenceScore: 1 - result.spamRisk.score, modelVersion: 'spam-v1' },
              ...(result.risk ? [{ predictionType: 'RISK', predictionValue: result.risk.level, confidenceScore: result.risk.confidence, modelVersion: 'risk-v1' }] : []),
            ],
          },
          recommendations: result.recommendations ? { create: result.recommendations } : undefined,
          auditLogs: { create: { event: 'AI_PREDICTION_CREATED', detail: 'Analysis completed by the internal AI service' } },
        },
      });
      if (result.duplicate.possible && result.duplicate.matchedReportId) {
        await tx.aIDuplicateMatch.create({ data: { analysisId: analysis.id, reportId: job.report.id, matchedReportId: result.duplicate.matchedReportId, similarityScore: result.duplicate.similarity, matchType: 'POSSIBLE_DUPLICATE' } });
      }
      await tx.report.update({ where: { id: job.report.id }, data: { aiCategory: result.classification.category, aiConfidence: result.classification.confidence, aiPriorityScore: result.severity.score, aiSummary: result.explanation } });
      await tx.aIJob.update({ where: { id: jobId }, data: { status: 'COMPLETED', completedAt: new Date() } });
    });
  } catch (error) {
    await prisma.aIJob.update({ where: { id: jobId }, data: { status: 'FAILED', errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'AI processing failed' } });
  }
}

export async function getAIAnalysis(reportId: number) {
  return prisma.aIAnalysis.findFirst({ where: { reportId }, orderBy: { createdAt: 'desc' }, include: { predictions: true, duplicateMatches: true, recommendations: true, job: true } });
}

export async function getAIJob(reportId: number) {
  return prisma.aIJob.findFirst({ where: { reportId }, orderBy: { createdAt: 'desc' } });
}