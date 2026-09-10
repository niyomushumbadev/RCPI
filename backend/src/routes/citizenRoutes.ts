import { Router } from 'express';
import * as citizen from '../controllers/citizenController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// All citizen routes require authentication + CITIZEN role
router.use(authenticate, requireRole('CITIZEN'));

// Dashboard & profile
router.get('/dashboard', citizen.getDashboard);
router.get('/profile', citizen.getProfile);
router.put('/profile', citizen.updateProfile);

// Reports
router.get('/reports', citizen.getReports);
router.post('/reports', citizen.createReport);
router.get('/reports/:id', citizen.getReportDetails);
router.get('/reports/:id/timeline', citizen.getReportTimeline);
router.get('/reports/:id/messages', citizen.getMessages);
router.post('/reports/:id/messages', citizen.sendMessage);
router.post('/reports/:id/feedback', citizen.submitFeedback);
router.post('/reports/:id/reopen', citizen.requestReopen);

// Activity
router.get('/activity', citizen.getActivity);

// GIS: map & nearby (Task 5)
router.get('/map/problems', citizen.getMapProblems);
router.get('/problems/nearby', citizen.getNearbyProblems);

// Community (Task 8 approved aggregates)
router.get('/community/insights', citizen.getCommunityInsights);
router.get('/community/alerts', citizen.getCommunityAlerts);

export default router;
