import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Vulnerability } from './entities/Vulnerability';
import { Batch } from './entities/Batch';
import { StatusLog } from './entities/StatusLog';
import { Assignment } from './entities/Assignment';
import { UpgradeTask } from './entities/UpgradeTask';
import { DelayRequest } from './entities/DelayRequest';
import { RiskItem } from './entities/RiskItem';

const isTest = process.env.NODE_ENV === 'test';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: isTest ? ':memory:' : './vulnerability.db',
  synchronize: true,
  logging: false,
  entities: [
    Vulnerability,
    Batch,
    StatusLog,
    Assignment,
    UpgradeTask,
    DelayRequest,
    RiskItem
  ],
  migrations: [],
  subscribers: []
});

export async function initializeDatabase(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  return AppDataSource;
}

export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}
