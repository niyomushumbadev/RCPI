import type {
  ApiEnvelope,
  AuthPayload,
  User,
  Province,
  District,
  Sector,
  Cell,
  Category,
  Department,
  Pagination,
  ReportListItem,
  CitizenDashboard,
  ReportDetail,
  ChatMessage,
  Notification,
  MapProblem,
  NearbyProblem,
  CommunityInsights,
  CommunityAlert,
  WorkflowReport,
  WorkflowReportDetail,
  WorkflowStats,
  AdminDashboard,
  AdminUser,
  AuditLog,
  TimelineEntry,
  AIAnalysis,
  AIJob,
  IntelligenceDashboard,
  IntelligenceSearchResult,
} from '../types';

// ─────────────────────────────────────────────────────────────
// API client for R-CPI backend
//
// - Access token is kept in memory and attached as Bearer.
// - Refresh token lives in an httpOnly cookie managed by the API.
// - On 401, the client transparently refreshes once and retries.
// ─────────────────────────────────────────────────────────────

const BASE = '/api/v1';
const ACCESS_TOKEN_KEY = 'rcpi_access_token';

let accessToken: string | null = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
const listeners = new Set<(token: string | null) => void>();

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
    else localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
  listeners.forEach((fn) => fn(token));
}

export function onAuthChange(fn: (token: string | null) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export class ApiError extends Error {
  /** HTTP status of the response, or 0 when the request failed at the network level. */
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return false;
        const body = (await res.json()) as ApiEnvelope<{ accessToken: string }>;
        if (body.success && body.data?.accessToken) {
          setAccessToken(body.data.accessToken);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true } = options;

  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
      else if (v === undefined) continue;
    }
  }

  const headers: Record<string, string> = {};
  const isMultipart = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isMultipart) headers['Content-Type'] = 'application/json';
  const requestAccessToken = accessToken;
  if (auth && requestAccessToken) headers.Authorization = `Bearer ${requestAccessToken}`;

  const doFetch = () =>
    fetch(url.toString(), {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? (isMultipart ? body as FormData : JSON.stringify(body)) : undefined,
    });

  let res: Response;
  try {
    res = await doFetch();
  } catch {
    // fetch only rejects for network-level failures: server down, offline, DNS, CORS
    throw new ApiError('Cannot reach the server. Make sure the API is running and your connection is up.', 0);
  }

  // Transparent refresh-and-retry on expired access token
  if (res.status === 401 && auth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.Authorization = `Bearer ${accessToken}`;
      try {
        res = await doFetch();
      } catch {
        throw new ApiError('Lost connection to the server. Please try again.', 0);
      }
    }
  }

  let json: ApiEnvelope<T>;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // The response body was not JSON — typically an HTML error page from the
    // Vite dev proxy (or nginx) when the API is down or misrouted.
    const hint =
      res.status >= 500
        ? 'The R-CPI API is temporarily unavailable. Please start the backend server and refresh the page.'
        : res.status === 404
          ? 'API endpoint not found. The backend may be out of date or not running.'
          : 'The server returned an unexpected (non-JSON) response.';
    throw new ApiError(`${hint} (HTTP ${res.status})`, res.status);
  }

  if (!res.ok || !json.success) {
    // 401 after refresh attempt = session truly over
    if (res.status === 401 && auth && accessToken === requestAccessToken) {
      setAccessToken(null);
    }
    const fallback =
      res.status === 401
        ? 'Your session has expired. Please log in again.'
        : res.status === 403
          ? 'You do not have permission to do that.'
          : res.status >= 500
            ? 'The R-CPI API is currently unavailable. Please start the backend server and refresh the page.'
            : 'Request failed';
    // On unauthenticated endpoints (login/register) the server's own message
    // is user-facing ("Invalid email or password", "Account locked") — show it
    // instead of the generic expired-session text.
    const message = !auth && json.message ? json.message : res.status === 401 ? fallback : (json.message ?? fallback);
    throw new ApiError(message, res.status);
  }
  return json.data as T;
}

// ─── Auth ───

export const authApi = {
  register: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
    preferredLanguage?: string;
    provinceId?: number;
    districtId?: number;
    sectorId?: number;
  }) => request<AuthPayload>('/auth/register', { method: 'POST', body: payload, auth: false }),

  login: (email: string, password: string, rememberMe: boolean) =>
    request<AuthPayload>('/auth/login', { method: 'POST', body: { email, password, rememberMe }, auth: false }),

  logout: () => request<null>('/auth/logout', { method: 'POST', auth: false }),

  forgotPassword: (email: string) =>
    request<{ resetToken?: string }>('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),

  resetPassword: (token: string, newPassword: string) =>
    request<null>('/auth/reset-password', { method: 'POST', body: { token, newPassword }, auth: false }),

  me: () => request<{ user: User }>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<null>('/auth/password', { method: 'PUT', body: { currentPassword, newPassword } }),
};

// ─── Geo / categories / departments (public reads) ───

export const geoApi = {
  provinces: () => request<{ provinces: Province[] }>('/geo/provinces', { auth: false }),
  districts: (provinceId?: number) =>
    request<{ districts: District[] }>('/geo/districts', { query: { provinceId }, auth: false }),
  sectors: (districtId?: number) =>
    request<{ sectors: Sector[] }>('/geo/sectors', { query: { districtId }, auth: false }),
  cells: (sectorId?: number) => request<{ cells: Cell[] }>('/geo/cells', { query: { sectorId }, auth: false }),
};

export const metaApi = {
  categories: (activeOnly = true) =>
    request<{ categories: Category[] }>('/categories', { query: { activeOnly: activeOnly ? undefined : 'false' }, auth: false }),
  departments: (all = false) => request<{ departments: Department[] }>('/departments', { query: { all: all ? 'true' : undefined } }),
};

export const aiApi = {
  getReportAnalysis: (reportId: number) =>
    request<{ job: AIJob | null; analysis: AIAnalysis | null }>(`/ai/reports/${reportId}`),
  retryReportAnalysis: (reportId: number) =>
    request<{ job: AIJob }>(`/ai/reports/${reportId}/retry`, { method: 'POST' }),
  reviewAnalysis: (reportId: number) =>
    request<{ reviewed: boolean }>(`/ai/reports/${reportId}/review`, { method: 'POST' }),
  priority: (reportId: number) =>
    request<{ priority: import('../types').PriorityInfo }>(`/ai/reports/${reportId}/priority`),
  setPriority: (reportId: number, priority: string, reason: string) =>
    request<{ priority: string; reason: string | null }>(`/ai/reports/${reportId}/priority`, { method: 'PUT', body: { priority, reason } }),
  assist: (payload: { task: string; text: string; targetLanguage?: string; reportId?: number }) =>
    request<{ task: string; result: string; model: string; confidence: number; reviewed: boolean; hint: string }>('/ai/assist', { method: 'POST', body: payload }),
};

// ─── Notifications ───

export const notificationApi = {
  list: (page = 1) =>
    request<{ notifications: Notification[]; unreadCount: number; pagination: Pagination }>('/notifications', { query: { page } }),
  markRead: (id: number) => request<null>(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead: () => request<null>('/notifications/read-all', { method: 'PUT' }),
  delete: (id: number) => request<null>(`/notifications/${id}`, { method: 'DELETE' }),
};

// ─── Citizen ───

export const citizenApi = {
  dashboard: () => request<CitizenDashboard>('/citizen/dashboard'),

  /** Query endpoint: server-side filters (status, category, district, dates, search) + sort. */
  queryReports: (query: Record<string, string | number | undefined>) =>
    request<{ reports: ReportListItem[]; pagination: Pagination }>('/reports/query', { query }),

  /** Real DB-backed statistics used by dashboards and exports. */
  statistics: () =>
    request<{
      total: number;
      byStatus: Array<{ status: string; count: number }>;
      byCategory: Array<{ categoryId: number; categoryName: string | null; count: number }>;
      byDistrict: Array<{ districtId: number; districtName: string | null; count: number }>;
      rejected: number;
      verified: number;
      reopened: number;
      avgResolutionHours: number | null;
    }>('/reports/statistics'),

  profile: () =>
    request<{
      profile: {
        id: number;
        firstName: string;
        lastName: string;
        email: string;
        phone: string | null;
        preferredLanguage: string;
        province: string | null;
        district: string | null;
        sector: string | null;
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        createdAt: string;
      };
    }>('/citizen/profile'),

  updateProfile: (payload: {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    preferredLanguage?: string;
    provinceId?: number | null;
    districtId?: number | null;
    sectorId?: number | null;
  }) => request<null>('/citizen/profile', { method: 'PUT', body: payload }),

  reports: (status?: string, page = 1) =>
    request<{ reports: ReportListItem[]; pagination: Pagination }>('/citizen/reports', { query: { status, page } }),

  report: (id: number | string) => request<{ report: ReportDetail }>(`/citizen/reports/${id}`),

  timeline: (id: number | string) => request<{ timeline: TimelineEntry[] }>(`/citizen/reports/${id}/timeline`),

  messages: (id: number | string) => request<{ messages: ChatMessage[] }>(`/citizen/reports/${id}/messages`),

  sendMessage: (id: number | string, message: string) =>
    request<{ message: ChatMessage }>(`/citizen/reports/${id}/messages`, { method: 'POST', body: { message } }),

  feedback: (id: number | string, rating: number, comment?: string) =>
    request<null>(`/citizen/reports/${id}/feedback`, { method: 'POST', body: { rating, comment } }),

  reopen: (id: number | string, reason: string) =>
    request<null>(`/citizen/reports/${id}/reopen`, { method: 'POST', body: { reason } }),

  /** Citizen confirms the problem is actually solved (closes the loop). */
  confirmResolution: (id: number | string) =>
    request<{ confirmedAt: string }>(`/citizen/reports/${id}/confirm-resolution`, { method: 'POST' }),

  // Task 3 §13 — citizen edit of own eligible report (server enforces eligibility).
  updateReport: (id: number | string, payload: { title?: string; description?: string; sectorId?: number | null; cellId?: number | null; latitude?: number | null; longitude?: number | null; locationDescription?: string | null; affectedPeople?: number | null; vulnerableGroup?: boolean }) =>
    request<{ report: { id: number; reference: string; status: string } }>(`/citizen/reports/${id}`, { method: 'PUT', body: payload }),

  activity: () =>
    request<{ activity: Array<{ type: string; label: string; reference: string; at: string }> }>('/citizen/activity'),

  mapProblems: () => request<{ problems: MapProblem[] }>('/map/problems', { auth: false }),

  nearby: (lat: number, lng: number, radiusKm = 10) =>
    request<{ problems: NearbyProblem[] }>('/map/nearby', { query: { lat, lng, radiusKm }, auth: false }),

  insights: () => request<CommunityInsights>('/community/insights', { auth: false }),

  alerts: () => request<{ alerts: CommunityAlert[] }>('/alerts', { auth: false }),
};

export const evidenceApi = {
  upload: (reportId: number, file: File, evidenceType = 'CITIZEN_EVIDENCE', description?: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('evidenceType', evidenceType);
    if (description) form.append('description', description);
    return request<{ evidence: { id: number; fileName: string; mimeType: string; sizeBytes: number; uploadedAt: string } }>(`/reports/${reportId}/evidence`, { method: 'POST', body: form });
  },
  downloadUrl: (reportId: number, evidenceId: number) => `/api/v1/reports/${reportId}/evidence/${evidenceId}/download`,
  remove: (reportId: number, evidenceId: number) =>
    request<null>(`/reports/${reportId}/evidence/${evidenceId}`, { method: 'DELETE' }),
};

export interface CreateReportInput {
  title: string;
  description: string;
  categoryId: number;
  urgency: string;
  provinceId: number;
  districtId: number;
  sectorId?: number;
  cellId?: number;
  latitude?: number;
  longitude?: number;
  locationDescription?: string;
  isAnonymous?: boolean;
  affectedPeople?: number | null;
  vulnerableGroup?: boolean;
}

export const createReport = (input: CreateReportInput) =>
  request<{ report: { id: number; reference: string; title: string; status: string; createdAt: string } }>(
    '/citizen/reports',
    { method: 'POST', body: input }
  );

// Public report tracker — no auth; privacy-filtered payload from the API.
export interface PublicTrackedReport {
  id: number;
  reference: string;
  title: string;
  description: string;
  status: string;
  urgency: string;
  categoryName: string;
  categoryIcon: string | null;
  location: string;
  department: string | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  timeline: Array<{ toStatus: string; note: string | null; actorName: string | null; createdAt: string }>;
  updates: Array<{ message: string; createdAt: string }>;
}

export const trackApi = {
  lookup: (reference: string) =>
    request<{ report: PublicTrackedReport }>(`/reports/track/${encodeURIComponent(reference.trim())}`, { auth: false }),
};

// ─── Workflow (officer / government) ───

export const workflowApi = {
  stats: () => request<WorkflowStats>('/workflow/stats'),

  /** Assignable officers/admins for the review workbench. */
  staff: () =>
    request<{ staff: Array<{ id: number; name: string; email: string; role: string; district: string | null }> }>('/workflow/staff'),

  /** (Re)assign a report to a specific officer/admin with instructions, deadline and priority (spec §4). */
  assign: (id: number | string, officerId: number, note?: string, priority?: string, deadline?: string) =>
    request<{ report: { id: number; reference: string; assignedOfficerId: number; status?: string } }>(`/workflow/reports/${id}/assign`, {
      method: 'POST',
      body: { officerId, note, priority, deadline },
    }),

  reports: (status?: string, page = 1) =>
    request<{ reports: WorkflowReport[]; pagination: Pagination }>('/workflow/reports', { query: { status, page } }),

  /** Citizen-confirmed, CLOSED and archived reports — permanent audit record (spec §14). */
  archive: (q?: string, page = 1) =>
    request<{ reports: Array<{
      id: number; reference: string; title: string; status: string; categoryName: string; categoryIcon: string | null;
      district: string; department: string | null; citizenName: string; confirmedByName: string | null;
      confirmedAt: string | null; archivedAt: string | null; closedAt: string | null; resolvedAt: string | null;
      resolutionDescription: string | null; createdAt: string;
    }>; pagination: Pagination }>('/workflow/archive', { query: { q, page } }),

  report: (id: number | string) => request<{ report: WorkflowReportDetail }>(`/workflow/reports/${id}`),

  transition: (id: number | string, toStatus: string, note?: string, departmentId?: number) =>
    request<{ report: { id: number; reference: string; status: string } }>(`/workflow/reports/${id}/transition`, {
      method: 'POST',
      body: { toStatus, note, departmentId },
    }),

  /** "Assigned Reports" worklist for the signed-in administrator (spec §4, §12). */
  myAssignments: (status?: string) =>
    request<{ assignments: Array<{
      id: number; status: string; priority: string | null; deadline: string | null; instruction: string | null;
      assignedByName: string | null; assignedAt: string; acceptedAt: string | null; completedAt: string | null;
      report: { id: number; reference: string; title: string; status: string; urgency: string; priority: string | null; deadline: string | null; district: string | null; categoryName: string | null; categoryIcon: string | null } | null;
    }> }>('/workflow/assignments', { query: { status } }),

  postUpdate: (id: number | string, message: string) =>
    request<null>(`/workflow/reports/${id}/updates`, { method: 'POST', body: { message } }),

  replyMessage: (id: number | string, message: string) =>
    request<null>(`/workflow/reports/${id}/messages`, { method: 'POST', body: { message } }),

  setDeadline: (id: number | string, deadline: string, reason?: string) =>
    request<{ deadline: string }>(`/workflow/reports/${id}/deadline`, { method: 'POST', body: { deadline, reason } }),

  internalNote: (id: number | string, note: string) =>
    request<null>(`/workflow/reports/${id}/internal-note`, { method: 'POST', body: { note } }),

  linkRelated: (id: number | string, relatedReportId: number, relationType: string, note?: string) =>
    request<null>(`/workflow/reports/${id}/related`, { method: 'POST', body: { relatedReportId, relationType, note } }),

  // ── Resolution workflow (spec §4-§8) ──
  acceptAssignment: (id: number | string) =>
    request<{ assignment: { id: number; status: string; acceptedAt: string } }>(`/reports/${id}/accept-assignment`, { method: 'POST' }),

  startWork: (id: number | string) =>
    request<{ report: { id: number; reference: string; status: string } }>(`/reports/${id}/start`, { method: 'POST' }),

  resolveReport: (id: number | string, resolutionDescription: string) =>
    request<{ report: { id: number; reference: string; status: string; resolvedAt: string } }>(`/reports/${id}/resolve`, { method: 'POST', body: { resolutionDescription } }),

  confirmResolution: (id: number | string, rating?: number, comment?: string) =>
    request<{ confirmedAt: string; status: string; archived: boolean }>(`/reports/${id}/confirm`, { method: 'POST', body: { rating, comment } }),

  rejectResolution: (id: number | string, reason: string) =>
    request<{ status: string }>(`/reports/${id}/reject-resolution`, { method: 'POST', body: { reason } }),

  assignmentHistory: (id: number | string) =>
    request<{ assignments: Array<{
      id: number; assignedTo: { id: number; name: string } | null; departmentId: number | null; instruction: string | null;
      priority: string | null; deadline: string | null; status: string; assignedBy: string | null;
      assignedAt: string; acceptedAt: string | null; completedAt: string | null;
    }> }>(`/reports/${id}/assignment-history`),

  reopenRequests: () =>
    request<{ requests: Array<{ id: number; reportId: number; reason: string; status: string; actorName: string | null; createdAt: string; report: { id: number; reference: string; title: string; status: string } | null }> }>('/workflow/reopen-requests'),
  reviewReopenRequest: (id: number, decision: 'APPROVE' | 'DECLINE', note?: string) =>
    request<{ requestId: number; decision: string }>(`/workflow/reopen-requests/${id}/review`, { method: 'POST', body: { decision, note } }),
};

export const intelligenceApi = {
  dashboard: () => request<IntelligenceDashboard>('/intelligence/dashboard'),
  executive: () => request<import('../types').ExecutiveDashboard>('/intelligence/executive'),
  search: (query: { q?: string; status?: string; districtId?: number; categoryId?: number }) =>
    request<{ reports: IntelligenceSearchResult[] }>('/intelligence/reports/search', { query }),
};

// ─── Admin ───

export const adminApi = {
  dashboard: () => request<AdminDashboard>('/admin/dashboard'),

  users: (page = 1, role?: string, q?: string) =>
    request<{ users: AdminUser[]; pagination: Pagination }>('/admin/users', { query: { page, role, q } }),

  createUser: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
    roleName: string;
    provinceId?: number;
    districtId?: number;
  }) => request<{ user: { id: number; email: string; role: string } }>('/admin/users', { method: 'POST', body: payload }),

  setUserStatus: (id: number, isActive: boolean) =>
    request<null>(`/admin/users/${id}/status`, { method: 'PUT', body: { isActive } }),

  setUserRole: (id: number, roleName: string) =>
    request<{ user: { id: number; email: string; role: string } }>(`/admin/users/${id}/role`, { method: 'PUT', body: { roleName } }),

  /** SYSTEM_ADMIN only: permanently delete a user (blocked if the user has reports). */
  deleteUser: (id: number) => request<null>(`/admin/users/${id}`, { method: 'DELETE' }),

  permissions: () => request<{ permissions: Array<{ id: number; code: string; name: string; description: string | null }>; roles: Array<{ id: number; name: string; description: string | null; permissions: string[] }> }>('/admin/permissions'),

  setRolePermissions: (roleId: number, permissionCodes: string[]) =>
    request<{ role: string; permissionCodes: string[] }>(`/admin/roles/${roleId}/permissions`, { method: 'PUT', body: { permissionCodes } }),

  auditLogs: (page = 1, action?: string, resourceType?: string) =>
    request<{ logs: AuditLog[]; pagination: Pagination }>('/admin/audit-logs', { query: { page, action, resourceType } }),

  createCategory: (payload: { name: string; nameRw?: string; nameFr?: string; icon?: string; color?: string }) =>
    request<{ category: Category }>('/categories', { method: 'POST', body: payload }),

  updateCategory: (id: number, payload: { name?: string; isActive?: boolean }) =>
    request<{ category: Category }>(`/categories/${id}`, { method: 'PUT', body: payload }),

  deleteCategory: (id: number) =>
    request<null>(`/categories/${id}`, { method: 'DELETE' }),

  createDepartment: (payload: { name: string; nameRw?: string; nameFr?: string; email?: string; phone?: string }) =>
    request<{ department: Department }>('/departments', { method: 'POST', body: payload }),

  updateDepartment: (id: number, payload: { name?: string; nameRw?: string; nameFr?: string; email?: string; phone?: string; isActive?: boolean }) =>
    request<{ department: Department }>(`/departments/${id}`, { method: 'PUT', body: payload }),

  deleteDepartment: (id: number) =>
    request<null>(`/departments/${id}`, { method: 'DELETE' }),

  allAlerts: () => request<{ alerts: CommunityAlert[] }>('/alerts/manage'),

  createAlert: (payload: {
    title: string;
    message: string;
    severity: string;
    category?: string;
    provinceId?: number;
    districtId?: number;
    expiresAt?: string;
  }) => request<{ alert: CommunityAlert }>('/alerts', { method: 'POST', body: payload }),

  updateAlert: (id: number, payload: { title?: string; message?: string; severity?: string; category?: string | null; districtId?: number | null; expiresAt?: string | null; isActive?: boolean }) =>
    request<{ alert: CommunityAlert }>(`/alerts/${id}`, { method: 'PUT', body: payload }),

  deleteAlert: (id: number) =>
    request<null>(`/alerts/${id}`, { method: 'DELETE' }),

  settings: () => request<{ settings: Array<{ key: string; value: string }> }>('/admin/settings'),

  updateSettings: (settings: Record<string, string>) =>
    request<null>('/admin/settings', { method: 'PUT', body: { settings } }),
};
