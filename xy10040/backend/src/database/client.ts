import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  max: config.database.pool.max,
  min: config.database.pool.min,
  idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
  connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', { error: err.message });
  process.exit(-1);
});

pool.on('connect', () => {
  logger.info('Database connected successfully');
});

export const db = {
  pool,

  async query<T = unknown>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await pool.query<T>(text, params);
      const duration = Date.now() - start;
      if (duration > 100) {
        logger.warn('Slow query detected', { duration, query: text.substring(0, 100) });
      }
      return result;
    } catch (error) {
      logger.error('Query failed', { error: (error as Error).message, query: text.substring(0, 100) });
      throw error;
    }
  },

  async getClient(): Promise<PoolClient> {
    return pool.connect();
  },

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    isolationLevel: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE' = 'READ COMMITTED'
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};

export type DatabaseClient = PoolClient;
