import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CriticalValueRecord } from '../models/CriticalValueRecord';
import { AuditLog } from '../models/AuditLog';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: './critical_value.db',
  synchronize: true,
  logging: false,
  entities: [CriticalValueRecord, AuditLog],
  migrations: [],
  subscribers: [],
});
