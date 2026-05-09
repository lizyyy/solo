import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import {
  Bin,
  Vehicle,
  BinEvent,
  Dispatch,
  Route,
  Receipt,
  DailyStat,
  IdempotentRecord,
  BackgroundJob,
} from '../entities';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: path.join(process.cwd(), 'data', 'waste.db'),
  synchronize: true,
  logging: false,
  entities: [
    Bin,
    Vehicle,
    BinEvent,
    Dispatch,
    Route,
    Receipt,
    DailyStat,
    IdempotentRecord,
    BackgroundJob,
  ],
  migrations: [],
  subscribers: [],
});

export async function initDatabase(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    console.log('数据库连接成功');
  }
}
