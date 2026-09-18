import dotenv from 'dotenv';
dotenv.config();

function parseFrontendUrls(): string[] {
  const raw = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

const isProduction = nodeEnv === 'production';

// In production the same server may be reached from the apex domain and the
// www subdomain, and Vercel preview URLs rotate — all are supplied as a
// comma-separated list in FRONTEND_URL.
const allowedOrigins = parseFrontendUrls();
if (isProduction && allowedOrigins.length === 0) {
  // Fail loudly instead of silently blocking every browser request.
  console.warn('[env] FRONTEND_URL is empty in production — CORS will reject browser requests.');
}

export const env = {
  nodeEnv,
  isDev: nodeEnv !== 'production',
  isVercel: process.env.VERCEL === '1',
  port: parseInt(process.env.PORT ?? '5000', 10),
  frontendUrl: allowedOrigins[0] ?? 'http://localhost:5173',
  /** All trusted frontend origins (comma-separated FRONTEND_URL in production). */
  frontendUrls: allowedOrigins,
  /** CORS origin check: allow any of the trusted origins; false otherwise. */
  isAllowedOrigin: (origin: string | undefined): boolean => {
    if (!origin) return true; // curl / server-to-server
    return allowedOrigins.includes(origin.replace(/\/$/, ''));
  },
  aiServiceUrl: process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:8000',
  aiServiceToken: process.env.AI_SERVICE_TOKEN ?? '',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret',
    accessExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN ?? '15m',
    refreshTokenDays: parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS ?? '7', 10),
  },

  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),

  lockout: {
    maxFailedAttempts: parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS ?? '5', 10),
    accountLockMinutes: parseInt(process.env.ACCOUNT_LOCK_MINUTES ?? '30', 10),
  },

  rateLimit: {
    apiMax: parseInt(process.env.API_RATE_LIMIT_MAX ?? '300', 10),
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? '20', 10),
  },
};

