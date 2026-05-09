import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  log: {
    level: process.env.LOG_LEVEL || 'info'
  },
  refund: {
    maxRetries: 3,
    retryDelayMinutes: 15,
    refundNoPrefix: 'REF'
  },
  permissions: {
    admin: ['ADMIN'],
    manager: ['ADMIN', 'MANAGER'],
    operator: ['ADMIN', 'MANAGER', 'OPERATOR'],
    viewer: ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER']
  }
} as const;

export type Config = typeof config;
