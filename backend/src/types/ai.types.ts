export type AIJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRYING';

export interface AIServiceRequest {
  reportId: number;
  title: string;
  description: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  district: string;
  evidence: Array<{ fileName: string; mimeType: string; sizeBytes: number }>;
}

export interface AIServiceResponse {
  language?: string;
  overallConfidence?: number;
  classification: { category: string; confidence: number; secondaryCategories?: string[] };
  severity: { level: string; score: number; confidence: number };
  duplicate: { possible: boolean; similarity: number; matchedReportId?: number | null };
  similarity?: { related: boolean; score: number };
  spamRisk: { level: string; score: number };
  risk?: { level: string; confidence: number };
  trend?: { direction: string; changePercent?: number };
  explanation?: string;
  imageAnalysis?: { detectedObjects: string[]; category?: string; confidence?: number; quality?: string; usable?: boolean };
  recommendations?: Array<{ priority: string; department?: string; recommendation: string }>;
}