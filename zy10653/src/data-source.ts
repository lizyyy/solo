import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { TranscodeTask } from './entities/TranscodeTask';
import { RetryHistory } from './entities/RetryHistory';
import { RowValidation } from './entities/RowValidation';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: './transcode_service.db',
  synchronize: true,
  logging: false,
  entities: [TranscodeTask, RetryHistory, RowValidation],
  migrations: [],
  subscribers: [],
});
