import { PrismaClient } from '@prisma/client';
import { isProduction } from './env';

let prisma: PrismaClient;

declare global {
  var __prisma: PrismaClient | undefined;
}

if (isProduction) {
  prisma = new PrismaClient({
    log: ['error'],
  });
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }
  prisma = global.__prisma;
}

export { prisma };
