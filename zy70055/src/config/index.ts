import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const APP_CONFIG = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
};

export const SUSPEND_THRESHOLDS = {
  REFUND_RATIO: 0.1,
  CHARGEBACK_RATIO: 0.05,
  FEE_TOLERANCE: 0.001,
  MIN_AMOUNT_TO_CHECK: 100,
};
