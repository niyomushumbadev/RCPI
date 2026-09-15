// ─────────────────────────────────────────────────────────────
// Priority & risk engine (master spec §10) — transparent scoring.
// Factors: urgency/severity, affected people, vulnerable group,
// public-facility importance (department), duration unresolved,
// repeated nearby reports, environmental/health keywords, geo spread.
// Output: LOW | MEDIUM | HIGH | CRITICAL + human-readable reasons.
// ─────────────────────────────────────────────────────────────

export interface PriorityInput {
  urgency: string;
  severity?: string | null;
  affectedPeople?: number | null;
  vulnerableGroup?: boolean;
  departmentName?: string | null;
  categoryName?: string | null;
  title?: string;
  description?: string;
  createdAt: Date;
  status: string;
  hasLocation: boolean;
  nearbySimilarCount?: number;
}

export interface PriorityResult {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasons: string[];
}

const FACILITY_KEYWORDS = ['school', 'hospital', 'clinic', 'health', 'water', 'market', 'road', 'bridge'];
const RISK_KEYWORDS = ['flood', 'disease', 'cholera', 'contaminat', 'collapse', 'fire', 'unsafe', 'danger', 'injury', 'death', 'sewage'];

export function calculatePriority(input: PriorityInput): PriorityResult {
  const reasons: string[] = [];
  let score = 0;

  const urgency = (input.urgency ?? 'MEDIUM').toUpperCase();
  if (urgency === 'HIGH') {
    score += 28;
    reasons.push('Citizen marked urgency as HIGH (+28)');
  } else if (urgency === 'MEDIUM') {
    score += 16;
    reasons.push('Citizen marked urgency as MEDIUM (+16)');
  } else {
    score += 7;
    reasons.push('Citizen marked urgency as LOW (+7)');
  }

  const severity = (input.severity ?? '').toUpperCase();
  if (severity === 'CRITICAL') {
    score += 22;
    reasons.push('AI/officer severity is CRITICAL (+22)');
  } else if (severity === 'HIGH') {
    score += 14;
    reasons.push('AI/officer severity is HIGH (+14)');
  } else if (severity === 'MEDIUM') {
    score += 7;
    reasons.push('AI/officer severity is MEDIUM (+7)');
  }

  const affected = Number(input.affectedPeople ?? 0);
  if (affected >= 200) {
    score += 16;
    reasons.push(`${affected} people affected (+16)`);
  } else if (affected >= 50) {
    score += 11;
    reasons.push(`${affected} people affected (+11)`);
  } else if (affected >= 10) {
    score += 6;
    reasons.push(`${affected} people affected (+6)`);
  } else if (affected > 0) {
    score += 3;
    reasons.push(`${affected} people affected (+3)`);
  }

  if (input.vulnerableGroup) {
    score += 8;
    reasons.push('Vulnerable group involved (+8)');
  }

  const text = `${input.title ?? ''} ${input.description ?? ''} ${input.categoryName ?? ''}`.toLowerCase();
  if (FACILITY_KEYWORDS.some((k) => text.includes(k))) {
    score += 6;
    reasons.push('Important public facility or service mentioned (+6)');
  }
  const riskHits = RISK_KEYWORDS.filter((k) => text.includes(k));
  if (riskHits.length > 0) {
    score += Math.min(10, 4 + riskHits.length * 2);
    reasons.push(`Public-health/environmental risk keywords: ${riskHits.slice(0, 3).join(', ')} (+${Math.min(10, 4 + riskHits.length * 2)})`);
  }

  const ageDays = Math.max(0, Math.floor((Date.now() - input.createdAt.getTime()) / 86_400_000));
  const agePoints = Math.min(12, ageDays >= 30 ? 12 : ageDays >= 14 ? 9 : ageDays >= 7 ? 6 : ageDays >= 3 ? 4 : ageDays >= 1 ? 2 : 0);
  if (agePoints > 0) {
    score += agePoints;
    reasons.push(`Unresolved for ~${ageDays} day(s) (+${agePoints})`);
  }

  const similar = Number(input.nearbySimilarCount ?? 0);
  if (similar >= 5) {
    score += 10;
    reasons.push(`${similar} similar nearby reports — recurring hotspot (+10)`);
  } else if (similar >= 2) {
    score += 6;
    reasons.push(`${similar} similar nearby reports (+6)`);
  } else if (similar === 1) {
    score += 3;
    reasons.push('1 similar nearby report (+3)');
  }

  if (input.hasLocation) {
    score += 4;
    reasons.push('Precise location provided (+4)');
  }

  const open = !['RESOLVED', 'CLOSED', 'ARCHIVED', 'REJECTED'].includes((input.status ?? '').toUpperCase());
  if (open) {
    score += 5;
    reasons.push('Still open — needs action (+5)');
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const level = finalScore >= 75 ? 'CRITICAL' : finalScore >= 50 ? 'HIGH' : finalScore >= 25 ? 'MEDIUM' : 'LOW';
  return { score: finalScore, level, reasons };
}
