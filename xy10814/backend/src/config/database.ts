import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Contract } from '../entities/Contract';
import { ResponseScene } from '../entities/ResponseScene';
import { ExceptionTemplate } from '../entities/ExceptionTemplate';
import { ReplayHistory } from '../entities/ReplayHistory';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: './database.sqlite',
  synchronize: true,
  logging: false,
  entities: [Contract, ResponseScene, ExceptionTemplate, ReplayHistory],
  migrations: [],
  subscribers: [],
});
