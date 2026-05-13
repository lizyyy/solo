import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import * as types from './types';

export class Database {
  private db: sqlite3.Database;

  constructor(dbPath: string = './cold-chain.db') {
    this.db = new sqlite3.Database(dbPath);
    this.initTables();
  }

  private initTables(): void {
    const tables = [
      `CREATE TABLE IF NOT EXISTS temperature_boxes (
        id TEXT PRIMARY KEY,
        box_code TEXT UNIQUE,
        order_id TEXT,
        medicine_name TEXT,
        min_temp REAL,
        max_temp REAL,
        current_temp REAL,
        status TEXT,
        created_at TEXT,
        created_by TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS rider_handovers (
        id TEXT PRIMARY KEY,
        box_id TEXT,
        rider_id TEXT,
        rider_name TEXT,
        from_rider_id TEXT,
        from_rider_name TEXT,
        status TEXT,
        handover_time TEXT,
        confirmed_time TEXT,
        location TEXT,
        temperature_at_handover REAL,
        notes TEXT,
        FOREIGN KEY (box_id) REFERENCES temperature_boxes(id)
      )`,
      `CREATE TABLE IF NOT EXISTS gps_nodes (
        id TEXT PRIMARY KEY,
        box_id TEXT,
        latitude REAL,
        longitude REAL,
        timestamp TEXT,
        temperature REAL,
        battery_level REAL,
        FOREIGN KEY (box_id) REFERENCES temperature_boxes(id)
      )`,
      `CREATE TABLE IF NOT EXISTS sign_off_persons (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        id_card TEXT UNIQUE,
        authorized INTEGER,
        department TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS delay_exchanges (
        id TEXT PRIMARY KEY,
        box_id TEXT,
        old_box_id TEXT,
        reason TEXT,
        reason_type TEXT,
        delay_minutes INTEGER,
        changed_by TEXT,
        changed_at TEXT,
        affected_record_ids TEXT,
        reviewed_by TEXT,
        reviewed_at TEXT,
        status TEXT,
        FOREIGN KEY (box_id) REFERENCES temperature_boxes(id)
      )`,
      `CREATE TABLE IF NOT EXISTS risk_assessments (
        id TEXT PRIMARY KEY,
        box_id TEXT,
        level TEXT,
        score INTEGER,
        factors TEXT,
        assessed_at TEXT,
        assessed_by TEXT,
        FOREIGN KEY (box_id) REFERENCES temperature_boxes(id)
      )`,
      `CREATE TABLE IF NOT EXISTS operation_logs (
        id TEXT PRIMARY KEY,
        operation_type TEXT,
        entity_type TEXT,
        entity_id TEXT,
        operator_id TEXT,
        operator_name TEXT,
        operate_time TEXT,
        before_value TEXT,
        after_value TEXT,
        remarks TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS sign_off_records (
        id TEXT PRIMARY KEY,
        box_id TEXT,
        sign_off_person_id TEXT,
        sign_off_time TEXT,
        temperature REAL,
        location TEXT,
        result TEXT,
        risk_level TEXT,
        blocked_reasons TEXT,
        operator_id TEXT,
        operator_name TEXT,
        FOREIGN KEY (box_id) REFERENCES temperature_boxes(id),
        FOREIGN KEY (sign_off_person_id) REFERENCES sign_off_persons(id)
      )`
    ];

    tables.forEach(sql => this.db.run(sql));
  }

  run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export const db = new Database();
