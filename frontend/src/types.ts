// ─────────────────────────────────────────────────────────────
// Shared types mirroring the R-CPI API responses
// ─────────────────────────────────────────────────────────────

export type Role = 'CITIZEN' | 'OFFICER' | 'DISTRICT_ADMIN' | 'NATIONAL_ADMIN' | 'SYSTEM_ADMIN' | 'ANALYST';

export const REPORT_STATUSES = [
  'SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED',
  'ASSIGNED', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED',
  'REOPEN_REQUESTED', 'REOPENED',
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export type Urgency = 'LOW' | 'MEDIUM' | 'HIGH';

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  preferredLanguage: string;
  role: Role;
  provinceId: number | null;
  districtId: number | null;
  sectorId: number | null;
}

export interface AuthPayload {
  user: User;
  accessToken: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface AIAnalysis {
  id: number;
  reportId: number;
  language: string | null;
  overallConfidence: number | null;
  status: string;
  explanation: string | null;
  imageQuality: string | null;
  imageUsable: boolean | null;
  predictions: Array<{
    id: number;
    predictionType: string;
    predictionValue: string;
    confidenceScore: number | null;
    modelVersion: string;
  }>;
  duplicateMatches: Array<{ matchedReportId: number; similarityScore: number; matchType: string }>;
  recommendations: Array<{ priority: string; department: string | null; recommendation: string }>;
}

export interface AIJob {
  id: number;
  reportId: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRYING';
  attempts: number;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Province { id: number; name: string; code: string }
export interface District { id: number; provinceId: number; name: string; code: string; province?: { name: string } }
export interface Sector { id: number; districtId: number; name: string; code: string }
export interface Cell { id: number; sectorId: number; name: string; code: string }

export interface Category {
  id: number;
  name: string;
  nameRw: string | null;
  nameFr: string | null;
  icon: string | null;
  color: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface Department {
  id: number;
  name: string;
  nameRw: string | null;
  nameFr: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
}

export interface ReportListItem {
  id: number;
  reference: string;
  title: string;
  status: ReportStatus;
  urgency: Urgency;
  categoryName: string;
  categoryIcon: string | null;
  districtName: string;
  sectorName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CitizenDashboard {
  stats: {
    total: number;
    submitted: number;
    underReview: number;
    inProgress: number;
    resolved: number;
    rejected: number;
  };
  recentReports: Array<{
    id: number;
    reference: string;
    title: string;
    status: ReportStatus;
    categoryName: string;
    districtName: string;
    createdAt: string;
  }>;
  unreadNotifications: number;
  citizen: { firstName: string; lastName: string };
}

export interface TimelineEntry {
  id: number;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface ReportDetail {
  id: number;
  reference: string;
  title: string;
  description: string;
  status: ReportStatus;
  urgency: Urgency;
  categoryName: string;
  categoryIcon: string | null;
  location: {
    province: string;
    district: string;
    sector: string | null;
    cell: string | null;
    latitude: string | null;
    longitude: string | null;
    description: string | null;
  };
  evidence: Array<{ id: number; fileName: string; mimeType: string; sizeBytes: number }>;
  timeline: TimelineEntry[];
  updates: Array<{ id: number; message: string; authorName: string | null; createdAt: string }>;
  feedback: { rating: number; comment: string | null } | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface ChatMessage {
  id: number;
  reportId: number;
  senderId: number;
  senderRole: 'CITIZEN' | 'GOVERNMENT';
  message: string;
  createdAt: string;
}

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  reportId: number | null;
  isRead: boolean;
  createdAt: string;
}

export interface MapProblem {
  id: number;
  reference: string;
  title: string;
  status: ReportStatus;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  district: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
}

export interface NearbyProblem {
  id: number;
  reference: string;
  title: string;
  status: ReportStatus;
  categoryName: string;
  categoryIcon: string | null;
  district: string;
  distanceKm: number;
  createdAt: string;
}

export interface CommunityInsights {
  stats: { totalReports: number; resolvedReports: number; inProgressReports: number; underReviewReports: number };
  mostReported: Array<{ name: string; icon: string | null; count: number }>;
  recentlyResolved: Array<{
    id: number;
    reference: string;
    title: string;
    categoryName: string;
    categoryIcon: string | null;
    district: string;
    resolvedAt: string | null;
  }>;
}

export interface CommunityAlert {
  id: number;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  category: string | null;
  provinceId: number | null;
  districtId: number | null;
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
}

// ─── Workflow (officer) ───

export interface WorkflowReport {
  id: number;
  reference: string;
  title: string;
  description: string;
  status: ReportStatus;
  urgency: Urgency;
  categoryName: string;
  categoryIcon: string | null;
  district: string;
  sector: string | null;
  citizen: { firstName: string; lastName: string; email: string | null; phone: string | null };
  department: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowReportDetail {
  id: number;
  reference: string;
  title: string;
  description: string;
  status: ReportStatus;
  urgency: Urgency;
  isAnonymous: boolean;
  citizen: { id: number; firstName: string; lastName: string; email: string; phone: string | null } | null;
  categoryName: string;
  location: {
    province: string;
    district: string;
    sector: string | null;
    cell: string | null;
    latitude: string | null;
    longitude: string | null;
    description: string | null;
  };
  department: string | null;
  evidence: Array<{ id: number; fileName: string; mimeType: string; sizeBytes: number }>;
  timeline: TimelineEntry[];
  updates: Array<{ id: number; message: string; authorName: string | null; createdAt: string }>;
  messages: ChatMessage[];
  feedback: { rating: number; comment: string | null } | null;
  aiSuggestion: { category: string | null; confidence: string | null; summary: string | null };
  allowedTransitions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStats {
  stats: {
    total: number;
    submitted: number;
    underReview: number;
    assigned: number;
    inProgress: number;
    resolved: number;
    escalated: number;
  };
}

// ─── Admin ───

export interface AdminDashboard {
  stats: {
    totalUsers: number;
    totalCitizens: number;
    totalReports: number;
    pendingReports: number;
    resolvedReports: number;
    totalCategories: number;
    totalDepartments: number;
  };
  recentAudit: Array<{
    id: number;
    actorName: string | null;
    action: string;
    resourceType: string;
    resourceId: string | null;
    detail: string | null;
    createdAt: string;
  }>;
}

export interface IntelligenceDashboard {
  stats: { total: number; open: number; critical: number; resolved: number; mapped: number; resolutionRate: number; avgResolutionHours: number | null };
  byStatus: Array<{ label: string; count: number }>;
  byCategory: Array<{ label: string; count: number }>;
  byDistrict: Array<{ label: string; count: number }>;
  points: Array<{
    id: number; reference: string; title: string; status: string; category: string; categoryIcon: string | null; categoryColor: string | null;
    province: string; district: string; sector: string | null; latitude: number; longitude: number;
    priority: { score: number; status: string }; createdAt: string;
  }>;
  critical: Array<{ id: number; reference: string; title: string; category: string; district: string; status: string; priority: { score: number; status: string } }>;
  predictions: Array<{ subject: string; outlook: string; confidence: number; basis: string }>;
  recent: IntelligenceSearchResult[];
}

export interface IntelligenceSearchResult {
  id: number; reference: string; title: string; status: string; urgency: string; category: string; district: string;
  priority: { score: number; status: string }; createdAt: string; updatedAt: string;
}

export interface AdminUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: Role;
  province: string | null;
  district: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  actorId: number | null;
  actorName: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  detail: string | null;
  createdAt: string;
}

// ─── Geo helpers ───

export interface GeoOption { id: number; name: string }
