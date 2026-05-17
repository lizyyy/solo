import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Tenant } from './entities/Tenant';
import { Package } from './entities/Package';
import { OverchargeRecord } from './entities/OverchargeRecord';
import { Appeal } from './entities/Appeal';
import { AppealHistory } from './entities/AppealHistory';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: process.env.DB_PATH || './database.sqlite',
  synchronize: true,
  logging: false,
  entities: [Tenant, Package, OverchargeRecord, Appeal, AppealHistory],
  migrations: [],
  subscribers: [],
});
