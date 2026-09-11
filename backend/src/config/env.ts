import dotenv from 'dotenv';
dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isDev: (process.env.NODE_ENV ?? 'development') !== 'production',
  port: parseInt(process.env.PORT ?? '5000', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  aiServiceUrl: process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:8000',
  aiServiceToken: process.env.AI_SERVICE_TOKEN ?? '',

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
