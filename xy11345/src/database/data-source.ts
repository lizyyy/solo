import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: process.env.DB_PATH || './data/qc_system.db',
  synchronize: true,
  logging: process.env.NODE_ENV === 'development',
  entities: [path.join(__dirname, '../models/*.{ts,js}')],
  migrations: [path.join(__dirname, '../migrations/*.{ts,js}')],
  subscribers: [path.join(__dirname, '../subscribers/*.{ts,js}')],
});
