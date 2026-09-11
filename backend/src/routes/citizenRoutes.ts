import { Router } from 'express';
import * as citizen from '../controllers/citizenController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Authenticate all endpoints; citizen-owned data/actions are guarded individually.
router.use(authenticate);
const citizenOnly = requireRole('CITIZEN');
const authenticatedRoles = requireRole('CITIZEN', 'OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST');

// Dashboard & profile
router.get('/dashboard', citizenOnly, citizen.getDashboard);
router.get('/profile', citizenOnly, citizen.getProfile);
router.put('/profile', citizenOnly, citizen.updateProfile);

// Reports
router.get('/reports', citizenOnly, citizen.getReports);
router.post('/reports', citizenOnly, citizen.createReport);
router.get('/reports/:id', citizenOnly, citizen.getReportDetails);
router.get('/reports/:id/timeline', citizenOnly, citizen.getReportTimeline);
router.get('/reports/:id/messages', citizenOnly, citizen.getMessages);
router.post('/reports/:id/messages', citizenOnly, citizen.sendMessage);
router.post('/reports/:id/feedback', citizenOnly, citizen.submitFeedback);
router.post('/reports/:id/reopen', citizenOnly, citizen.requestReopen);

// Activity
router.get('/activity', citizenOnly, citizen.getActivity);

// GIS: map & nearby (Task 5)
router.get('/map/problems', authenticatedRoles, citizen.getMapProblems);
router.get('/problems/nearby', authenticatedRoles, citizen.getNearbyProblems);

// Community (Task 8 approved aggregates)
router.get('/community/insights', authenticatedRoles, citizen.getCommunityInsights);
router.get('/community/alerts', authenticatedRoles, citizen.getCommunityAlerts);

export default router;
