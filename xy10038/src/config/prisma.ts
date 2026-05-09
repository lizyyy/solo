import { PrismaClient } from '@prisma/client';
import { config } from './index';
import logger from './logger';

const prisma = new PrismaClient({
  log: config.nodeEnv === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error']
});

prisma.$on('query' as never, (e: any) => {
  if (config.nodeEnv === 'development') {
    logger.debug(`Query: ${e.query}`);
  }
});

export default prisma;
