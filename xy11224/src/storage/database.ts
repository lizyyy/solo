import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'battery_swap.db');

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database | null = null;
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    this.db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    await this.initializeTables();
    this.initialized = true;
  }

  private async initializeTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        externalId TEXT UNIQUE NOT NULL,
        cabinetId TEXT NOT NULL,
        cabinetName TEXT NOT NULL,
        faultType TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        isOffline INTEGER NOT NULL DEFAULT 0,
        reportedAt TEXT NOT NULL,
        receivedAt TEXT,
        analyzedAt TEXT,
        dispatchedAt TEXT,
        reviewedAt TEXT,
        resolvedAt TEXT,
        assignedTo TEXT,
        rootCause TEXT,
        resolution TEXT,
        mergedInto TEXT,
        mergedTickets TEXT,
        ruleResults TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cabinets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        isOnline INTEGER NOT NULL DEFAULT 1,
        lastHeartbeat TEXT NOT NULL,
        location TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS maintenance_records (
        id TEXT PRIMARY KEY,
        ticketId TEXT NOT NULL,
        cabinetId TEXT NOT NULL,
        technician TEXT NOT NULL,
        scheduledAt TEXT NOT NULL,
        startedAt TEXT,
        completedAt TEXT,
        statusBefore TEXT NOT NULL,
        statusAfter TEXT,
        notes TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        ticketId TEXT,
        action TEXT NOT NULL,
        operator TEXT NOT NULL,
        details TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tickets_externalId ON tickets(externalId);
      CREATE INDEX IF NOT EXISTS idx_tickets_cabinetId ON tickets(cabinetId);
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
      CREATE INDEX IF NOT EXISTS idx_tickets_reportedAt ON tickets(reportedAt);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_ticketId ON audit_logs(ticketId);
      CREATE INDEX IF NOT EXISTS idx_maintenance_records_ticketId ON maintenance_records(ticketId);
    `);
  }

  public getConnection(): Database {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  public async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  public async runTransaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.exec('BEGIN TRANSACTION');
    try {
      const result = await fn(this.db);
      await this.db.exec('COMMIT');
      return result;
    } catch (error) {
      await this.db.exec('ROLLBACK');
      throw error;
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}