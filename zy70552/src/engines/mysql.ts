import mysql from 'mysql2/promise';
import { DatabaseEngine } from './database';
import { DatabaseConfig } from '../types';

export class MySqlEngine extends DatabaseEngine {
  private connection: mysql.Connection | null = null;

  constructor(config: DatabaseConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    this.connection = await mysql.createConnection({
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
      multipleStatements: true,
      dateStrings: true
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  async executeQuery(sql: string): Promise<{ rows: any[]; affectedRows: number }> {
    if (!this.connection) {
      throw new Error('Not connected to database');
    }
    if (!sql || sql.trim() === '') {
      return { rows: [], affectedRows: 0 };
    }
    try {
      const [result] = await this.connection.query(sql);
      if (Array.isArray(result)) {
        return { rows: result, affectedRows: result.length };
      }
      const okPacket = result as mysql.OkPacket;
      return { 
        rows: [], 
        affectedRows: okPacket.affectedRows || 0 
      };
    } catch (error: any) {
      throw new Error(`SQL execution failed: ${error.message}\nSQL: ${sql.substring(0, 200)}`);
    }
  }

  async beginTransaction(): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected to database');
    }
    await this.connection.beginTransaction();
  }

  async commitTransaction(): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected to database');
    }
    await this.connection.commit();
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected to database');
    }
    await this.connection.rollback();
  }

  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.executeQuery(
      `SHOW TABLES LIKE '${tableName}'`
    );
    return result.rows.length > 0;
  }

  async getTableRowCount(tableName: string): Promise<number> {
    const result = await this.executeQuery(
      `SELECT COUNT(*) as count FROM \`${tableName}\``
    );
    return result.rows[0]?.count || 0;
  }
}
