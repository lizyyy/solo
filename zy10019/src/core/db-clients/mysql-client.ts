import { ConnectionConfig } from '../../types';
import { ConnectionClient } from '../connection';

interface MySQLPoolConnection {
  release(): void;
  query(
    sql: string,
    params?: unknown[],
    callback?: (error: Error | null, results: unknown, fields: unknown) => void
  ): void;
}

interface MySQLPool {
  getConnection(callback: (error: Error | null, connection: MySQLPoolConnection) => void): void;
  end(callback?: (error: Error | null) => void): void;
  query(
    sql: string,
    params?: unknown[],
    callback?: (error: Error | null, results: unknown, fields: unknown) => void
  ): void;
}

export class MySQLClient implements ConnectionClient {
  private connected: boolean = false;
  private config: ConnectionConfig;
  private connection: MySQLPoolConnection | null = null;
  private static pool: MySQLPool | null = null;
  private static poolConfig: ConnectionConfig | null = null;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  private async getPool(): Promise<MySQLPool> {
    if (MySQLClient.pool && MySQLClient.poolConfig === this.config) {
      return MySQLClient.pool;
    }

    try {
      const mysql2 = await import('mysql2/promise');
      const { createPool } = mysql2;
      
      MySQLClient.pool = createPool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ...(this.config.options || {})
      }) as unknown as MySQLPool;
      
      MySQLClient.poolConfig = this.config;
      return MySQLClient.pool;
    } catch (error) {
      throw new Error(
        `Failed to load 'mysql2' package. Please install it: npm install mysql2`
      );
    }
  }

  private promisifyGetConnection(pool: MySQLPool): Promise<MySQLPoolConnection> {
    return new Promise((resolve, reject) => {
      pool.getConnection((error, connection) => {
        if (error) reject(error);
        else resolve(connection);
      });
    });
  }

  private promisifyQuery(
    conn: MySQLPoolConnection,
    sql: string,
    params?: unknown[]
  ): Promise<{ results: unknown; fields: unknown }> {
    return new Promise((resolve, reject) => {
      conn.query(sql, params, (error, results, fields) => {
        if (error) reject(error);
        else resolve({ results, fields });
      });
    });
  }

  async connect(): Promise<void> {
    const pool = await this.getPool();
    this.connection = await this.promisifyGetConnection(pool);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      this.connection.release();
      this.connection = null;
    }
    this.connected = false;
  }

  async validate(): Promise<boolean> {
    if (!this.connected || !this.connection) {
      return false;
    }

    try {
      const validationQuery = this.config.options?.validationQuery as string || 'SELECT 1';
      await this.promisifyQuery(this.connection, validationQuery);
      return true;
    } catch {
      return false;
    }
  }

  async query(sql: string, params?: unknown[]): Promise<unknown> {
    if (!this.connected || !this.connection) {
      throw new Error('Connection is not connected');
    }

    const { results } = await this.promisifyQuery(this.connection, sql, params);
    const resultArray = Array.isArray(results) ? results : [];
    const firstResult = resultArray[0] as Record<string, unknown>;
    
    return {
      sql,
      params,
      rows: resultArray,
      affectedRows: firstResult?.affectedRows as number || 0,
      insertId: firstResult?.insertId || null
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  static async shutdownPool(): Promise<void> {
    if (MySQLClient.pool) {
      await new Promise<void>((resolve, reject) => {
        MySQLClient.pool!.end((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      MySQLClient.pool = null;
      MySQLClient.poolConfig = null;
    }
  }
}
