import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Customer } from '../entities/Customer';
import { PersonInCharge } from '../entities/PersonInCharge';
import { VisitSchedule } from '../entities/VisitSchedule';
import { DelayRecord } from '../entities/DelayRecord';
import { VisitReport } from '../entities/VisitReport';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: './database/customer_visit.db',
  synchronize: true,
  logging: process.env.NODE_ENV === 'development',
  entities: [Customer, PersonInCharge, VisitSchedule, DelayRecord, VisitReport],
  migrations: [],
  subscribers: [],
});
