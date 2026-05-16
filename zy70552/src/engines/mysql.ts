import mysql from "mysql2/promise";
import { DatabaseEngine } from "./database";
import { DatabaseConfig } from "../types";
export class MySqlEngine extends DatabaseEngine {
  private connection: any;
  async connect(): Promise<void> { this.connection = mysql.createConnection({}); }
  async disconnect(): Promise<void> { if (this.connection) await this.connection.end(); }
  async executeQuery(sql: string): Promise<{ rows: any[]; affectedRows: number }> { return { rows: [], affectedRows: 0 }; }
  async beginTransaction(): Promise<void> {}
  async commitTransaction(): Promise<void> {}
  async rollbackTransaction(): Promise<void> {}
}