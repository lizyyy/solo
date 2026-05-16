const fs = require('fs');

const mysqlContent = `
import mysql from 'mysql2/promise';
import { DatabaseEngine } from './database';
import { DatabaseConfig } from '../types';

export class MySqlEngine extends DatabaseEngine {
  private connection?: mysql.Connection;

  async connect(): Promise<void> {
    this.connection = await mysql.createConnection({
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
      multipleStatements: true
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection) await this.connection.end();
  }

  async executeQuery(sql: string): Promise<{ rows: any[]; affectedRows: number }> {
    if (!this.connection) throw new Error('Not connected');
    const [result] = await this.connection.execute(sql);
    if (Array.isArray(result)) {
      return { rows: result, affectedRows: result.length };
    }
    const header = result;
    return { rows: [], affectedRows: header.affectedRows || 0 };
  }

  async beginTransaction(): Promise<void> {
    if (!this.connection) throw new Error('Not connected');
    await this.connection.beginTransaction();
  }

  async commitTransaction(): Promise<void> {
    if (!this.connection) throw new Error('Not connected');
    await this.connection.commit();
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.connection) throw new Error('Not connected');
    await this.connection.rollback();
  }
}
`;

fs.writeFileSync('src/engines/mysql.ts', mysqlContent.trim());
console.log('Created mysql.ts');
