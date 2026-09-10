import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import ForbiddenPage from './pages/Forbidden';
import CitizenDashboard from './pages/citizen/CitizenDashboard';
import CreateReport from './pages/citizen/CreateReport';
import MyReports from './pages/citizen/MyReports';
import ReportDetail from './pages/citizen/ReportDetails';
import Profile from './pages/citizen/Profile';
import Notifications from './pages/citizen/Notifications';
import HelpPage from './pages/citizen/Help';
import Community from './pages/Community';
import CommunityMap from './pages/CommunityMap';
import WorkflowDashboard from './pages/WorkflowDashboard';
import WorkflowReports from './pages/WorkflowReports';
import WorkflowReportDetail from './pages/WorkflowReportDetail';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminAuditLogs from './pages/AdminAuditLogs';
import type { Role } from './types';

const GOV_ROLES: Role[] = ['OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'];
const ADMIN_ROLES: Role[] = ['DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'];

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/register" element={<Register />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/auth/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />

          {/* Authenticated app shell */}
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<RequireAuth roles={['CITIZEN']}><CitizenDashboard /></RequireAuth>} />
            <Route path="/citizen/dashboard" element={<RequireAuth roles={['CITIZEN']}><CitizenDashboard /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth roles={['CITIZEN']}><Profile /></RequireAuth>} />
            <Route path="/citizen/profile" element={<RequireAuth roles={['CITIZEN']}><Profile /></RequireAuth>} />

            {/* Citizen */}
            <Route path="/reports/new" element={<RequireAuth roles={['CITIZEN']}><CreateReport /></RequireAuth>} />
            <Route path="/citizen/report/create" element={<RequireAuth roles={['CITIZEN']}><CreateReport /></RequireAuth>} />
            <Route path="/my-reports" element={<RequireAuth roles={['CITIZEN']}><MyReports /></RequireAuth>} />
            <Route path="/citizen/reports" element={<RequireAuth roles={['CITIZEN']}><MyReports /></RequireAuth>} />
            <Route path="/reports/:id" element={<RequireAuth roles={['CITIZEN']}><ReportDetail /></RequireAuth>} />
            <Route path="/citizen/reports/:id" element={<RequireAuth roles={['CITIZEN']}><ReportDetail /></RequireAuth>} />
            <Route path="/citizen/help" element={<RequireAuth roles={['CITIZEN']}><HelpPage /></RequireAuth>} />

            {/* Community & GIS (all authenticated roles; map and community are read-only public pages) */}
            <Route path="/map" element={<RequireAuth roles={['CITIZEN', 'OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN']}><CommunityMap /></RequireAuth>} />
            <Route path="/community" element={<RequireAuth roles={['CITIZEN', 'OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN']}><Community /></RequireAuth>} />
            <Route path="/notifications" element={<RequireAuth roles={['CITIZEN']}><Notifications /></RequireAuth>} />
            <Route path="/citizen/notifications" element={<RequireAuth roles={['CITIZEN']}><Notifications /></RequireAuth>} />

            {/* Government workflow */}
            <Route path="/workflow" element={<RequireAuth roles={GOV_ROLES}><WorkflowDashboard /></RequireAuth>} />
            <Route path="/workflow/reports" element={<RequireAuth roles={GOV_ROLES}><WorkflowReports /></RequireAuth>} />
            <Route path="/workflow/reports/:id" element={<RequireAuth roles={GOV_ROLES}><WorkflowReportDetail /></RequireAuth>} />
            <Route path="/workflow/:id" element={<RequireAuth roles={GOV_ROLES}><WorkflowReportDetail /></RequireAuth>} />

            {/* Admin */}
            <Route path="/admin" element={<RequireAuth roles={ADMIN_ROLES}><AdminDashboard /></RequireAuth>} />
            <Route path="/admin/users" element={<RequireAuth roles={ADMIN_ROLES}><AdminUsers /></RequireAuth>} />
            <Route path="/admin/audit-logs" element={<RequireAuth roles={ADMIN_ROLES}><AdminAuditLogs /></RequireAuth>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
