import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';

// Public pages (no auth)
import Landing from './pages/public/Landing';
import Presentation from './pages/public/Presentation';
import ForbiddenPage from './pages/public/Forbidden';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VerifyEmail from './pages/auth/VerifyEmail';

// Level 1 — Citizen
import CitizenDashboard from './pages/citizen/CitizenDashboard';
import CreateReport from './pages/citizen/CreateReport';
import MyReports from './pages/citizen/MyReports';
import ReportDetail from './pages/citizen/ReportDetails';
import Profile from './pages/citizen/Profile';
import Notifications from './pages/citizen/Notifications';
import HelpPage from './pages/citizen/Help';
import AIAssistant from './pages/citizen/AIAssistant';

// Community (shared, public-safe)
import Community from './pages/community/Community';
import CommunityMap from './pages/community/CommunityMap';

// Levels 2-7 — Government workflow
import WorkflowDashboard from './pages/workflow/WorkflowDashboard';
import WorkflowReports from './pages/workflow/WorkflowReports';
import WorkflowReportDetail from './pages/workflow/WorkflowReportDetail';

// Intelligence & decision support (levels 5-8)
import GovernmentIntelligence from './pages/intelligence/GovernmentIntelligence';
import GovernmentAIDashboard from './pages/intelligence/GovernmentAIDashboard';
import AIReportAnalysis from './pages/intelligence/AIReportAnalysis';
import ExecutiveDashboard from './pages/intelligence/ExecutiveDashboard';

// Administration (levels 4-7 + system admin)
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAuditLogs from './pages/admin/AdminAuditLogs';
import AdminManagement from './pages/admin/AdminManagement';

import type { Role } from './types';

const GOV_ROLES: Role[] = ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST', 'EXECUTIVE'];
const ADMIN_ROLES: Role[] = ['DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'];
const AUTHENTICATED_ROLES: Role[] = ['CITIZEN', ...GOV_ROLES];
const EXEC_ROLES: Role[] = ['NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'ANALYST'];

function DashboardEntry() {
  const { user } = useAuth();

  // Level 1: citizen portal
  if (user?.role === 'CITIZEN') return <Navigate to="/citizen/dashboard" replace />;
  // Level 8: executive strategic dashboard
  if (user?.role === 'EXECUTIVE') return <Navigate to="/executive" replace />;
  // Levels 2-3 + analyst: workflow operations
  if (user?.role === 'CELL_OFFICER' || user?.role === 'SECTOR_OFFICER' || user?.role === 'OFFICER' || user?.role === 'ANALYST') return <Navigate to="/workflow" replace />;
  // Levels 4-7: administration + workflow
  return <Navigate to="/admin" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public ── */}
          <Route path="/" element={<Landing />} />
          <Route path="/presentation" element={<Presentation />} />
          <Route path="/forbidden" element={<RequireAuth roles={AUTHENTICATED_ROLES}><ForbiddenPage /></RequireAuth>} />

          {/* ── Auth ── */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/register" element={<Register />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/auth/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* ── Authenticated app shell ── */}
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<DashboardEntry />} />

            {/* Level 1 — Citizen portal */}
            <Route path="/citizen/dashboard" element={<RequireAuth roles={['CITIZEN']}><CitizenDashboard /></RequireAuth>} />
            <Route path="/citizen/report" element={<RequireAuth roles={['CITIZEN']}><CreateReport /></RequireAuth>} />
            <Route path="/citizen/report/create" element={<RequireAuth roles={['CITIZEN']}><CreateReport /></RequireAuth>} />
            <Route path="/citizen/reports" element={<RequireAuth roles={['CITIZEN']}><MyReports /></RequireAuth>} />
            <Route path="/citizen/reports/:id" element={<RequireAuth roles={['CITIZEN']}><ReportDetail /></RequireAuth>} />
            <Route path="/citizen/profile" element={<RequireAuth roles={['CITIZEN']}><Profile /></RequireAuth>} />
            <Route path="/citizen/settings" element={<RequireAuth roles={['CITIZEN']}><Profile /></RequireAuth>} />
            <Route path="/citizen/assistant" element={<RequireAuth roles={['CITIZEN']}><AIAssistant /></RequireAuth>} />
            <Route path="/citizen/help" element={<RequireAuth roles={['CITIZEN']}><HelpPage /></RequireAuth>} />
            <Route path="/citizen/map" element={<RequireAuth roles={['CITIZEN']}><CommunityMap /></RequireAuth>} />
            <Route path="/citizen/nearby" element={<RequireAuth roles={['CITIZEN']}><CommunityMap /></RequireAuth>} />
            <Route path="/citizen/community-insights" element={<RequireAuth roles={['CITIZEN']}><Community /></RequireAuth>} />
            <Route path="/citizen/alerts" element={<RequireAuth roles={['CITIZEN']}><Community /></RequireAuth>} />

            {/* Shared — notifications & community for every authenticated role */}
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/citizen/notifications" element={<Notifications />} />
            <Route path="/map" element={<CommunityMap />} />
            <Route path="/community" element={<Community />} />

            {/* Levels 2-7 — Government workflow */}
            <Route path="/workflow" element={<RequireAuth roles={GOV_ROLES}><WorkflowDashboard /></RequireAuth>} />
            <Route path="/workflow/reports" element={<RequireAuth roles={GOV_ROLES}><WorkflowReports /></RequireAuth>} />
            <Route path="/workflow/reports/:id" element={<RequireAuth roles={GOV_ROLES}><WorkflowReportDetail /></RequireAuth>} />
            <Route path="/workflow/:id" element={<RequireAuth roles={GOV_ROLES}><WorkflowReportDetail /></RequireAuth>} />

            {/* Levels 5-8 — Intelligence & decision support */}
            <Route path="/government/intelligence" element={<RequireAuth roles={GOV_ROLES}><GovernmentIntelligence /></RequireAuth>} />
            <Route path="/government/ai" element={<RequireAuth roles={GOV_ROLES}><GovernmentAIDashboard /></RequireAuth>} />
            <Route path="/ai/reports/:id" element={<RequireAuth roles={GOV_ROLES}><AIReportAnalysis /></RequireAuth>} />
            <Route path="/executive" element={<RequireAuth roles={EXEC_ROLES}><ExecutiveDashboard /></RequireAuth>} />

            {/* Levels 4-7 — Administration */}
            <Route path="/admin" element={<RequireAuth roles={ADMIN_ROLES}><AdminDashboard /></RequireAuth>} />
            <Route path="/admin/dashboard" element={<RequireAuth roles={ADMIN_ROLES}><AdminDashboard /></RequireAuth>} />
            <Route path="/admin/users" element={<RequireAuth roles={ADMIN_ROLES}><AdminUsers /></RequireAuth>} />
            <Route path="/admin/audit-logs" element={<RequireAuth roles={ADMIN_ROLES}><AdminAuditLogs /></RequireAuth>} />
            <Route path="/admin/management" element={<RequireAuth roles={['NATIONAL_ADMIN', 'SYSTEM_ADMIN']}><AdminManagement /></RequireAuth>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
