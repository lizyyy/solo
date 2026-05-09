import { Sequelize } from 'sequelize';
import { config } from './environment';
import { logger } from './logger';
import path from 'path';
import fs from 'fs';

const databaseUrl = process.env.DATABASE_URL || config.databaseUrl;

if (!databaseUrl.includes(':memory:')) {
  const dataDir = path.dirname(databaseUrl.replace('sqlite:', ''));
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export const sequelize = new Sequelize(databaseUrl, {
  logging: (msg) => logger.debug(msg),
  define: {
    timestamps: true,
    paranoid: true
  }
});

export async function connectDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
    logger.info('数据库连接成功');
  } catch (error) {
    logger.error('数据库连接失败:', error);
    throw error;
  }
}

export async function syncDatabase(force: boolean = false): Promise<void> {
  await sequelize.sync({ force, alter: !force });
  logger.info('数据库同步完成');
}
