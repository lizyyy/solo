import { DatabaseConfig } from '../types';

export abstract class DatabaseEngine {
  protected config: DatabaseConfig;
  constructor(config: DatabaseConfig) {
    this.config = config;
  }
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract executeQuery(sql: string): Promise<{ rows: any[]; affectedRows: number }>;
  abstract beginTransaction(): Promise<void>;
  abstract commitTransaction(): Promise<void>;
  abstract rollbackTransaction(): Promise<void>;
}
