import { ConnectionConfig } from '../../types';
import { ConnectionClient } from '../connection';

type AnyPool = {
  connect(): Promise<unknown>;
  end(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount: number }>;
};

type AnyPoolClient = {
  release(): void;
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount: number }>;
};

export class PostgresClient implements ConnectionClient {
  private connected: boolean = false;
  private config: ConnectionConfig;
  private client: AnyPoolClient | null = null;
  private static pool: AnyPool | null = null;
  private static poolConfig: ConnectionConfig | null = null;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  private async getPool(): Promise<AnyPool> {
    if (PostgresClient.pool && PostgresClient.poolConfig === this.config) {
      return PostgresClient.pool;
    }

    try {
      const pg = await import('pg');
      const { Pool } = pg;
      
      PostgresClient.pool = new Pool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        ...(this.config.options || {})
      }) as unknown as AnyPool;
      
      PostgresClient.poolConfig = this.config;
      return PostgresClient.pool;
    } catch (error) {
      throw new Error(
        `Failed to load 'pg' package. Please install it: npm install pg`
      );
    }
  }

  async connect(): Promise<void> {
    const pool = await this.getPool();
    this.client = (await pool.connect()) as AnyPoolClient;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.release();
      this.client = null;
    }
    this.connected = false;
  }

  async validate(): Promise<boolean> {
    if (!this.connected || !this.client) {
      return false;
    }

    try {
      const validationQuery = (this.config.options?.validationQuery as string) || 'SELECT 1';
      await this.client.query(validationQuery);
      return true;
    } catch {
      return false;
    }
  }

  async query(sql: string, params?: unknown[]): Promise<unknown> {
    if (!this.connected || !this.client) {
      throw new Error('Connection is not connected');
    }

    const result = await this.client.query(sql, params);
    return {
      sql,
      params,
      rows: result.rows,
      rowCount: result.rowCount,
      affectedRows: result.rowCount,
      insertId: null
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  static async shutdownPool(): Promise<void> {
    if (PostgresClient.pool) {
      await PostgresClient.pool.end();
      PostgresClient.pool = null;
      PostgresClient.poolConfig = null;
    }
  }
}
