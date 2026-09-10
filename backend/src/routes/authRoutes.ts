import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import * as auth from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Stricter rate limit on auth endpoints (Task 10 §33)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

router.post('/register', authLimiter, auth.register);
router.post('/login', authLimiter, auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout', auth.logout);
router.get('/me', authenticate, auth.me);
router.put('/password', authenticate, auth.changePassword);

export default router;
