import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

let prisma: PrismaClient | null = null;

export const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });

    prisma.$on('error', (e) => {
      logger.error('Prisma error', { message: e.message, target: e.target });
    });

    prisma.$on('warn', (e) => {
      logger.warn('Prisma warning', { message: e.message, target: e.target });
    });
  }
  return prisma;
};

export const prisma = getPrismaClient();

export const transaction = async <T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> => {
  return prisma.$transaction(fn, {
    isolationLevel: 'Serializable',
    maxWait: 5000,
    timeout: 10000,
  });
};