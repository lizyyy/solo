import { DatabaseConfig } from '../types';
import { DatabaseEngine } from './database';
import { MySqlEngine } from './mysql';

export function createDatabaseEngine(config: DatabaseConfig): DatabaseEngine {
  switch (config.type) {
    case 'mysql':
      return new MySqlEngine(config);
    case 'postgresql':
      throw new Error('PostgreSQL not implemented yet');
    default:
      throw new Error(`Unsupported database type: ${(config as any).type}`);
  }
}
