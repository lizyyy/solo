import initSqlJs, { Database } from 'sql.js';
import { Batch, TemperatureCurve, Formula, ReviewRecord } from './types';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(__dirname, '..', 'data', 'database.db');

export class DyeingDatabase {
  private db: Database | null = null;

  async init(): Promise<void> {
    const SQL = await initSqlJs();
    
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.createTables();
  }

  private createTables(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS batches (
        id TEXT PRIMARY KEY,
        batchNumber TEXT UNIQUE NOT NULL,
        fabricType TEXT NOT NULL,
        customerName TEXT NOT NULL,
        targetColor_L REAL NOT NULL,
        targetColor_a REAL NOT NULL,
        targetColor_b REAL NOT NULL,
        measuredColor_L REAL,
        measuredColor_a REAL,
        measuredColor_b REAL,
        deltaE REAL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS temperature_curves (
        id TEXT PRIMARY KEY,
        batchId TEXT NOT NULL,
        targetCurve TEXT NOT NULL,
        actualCurve TEXT NOT NULL,
        temperatureDeviation REAL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (batchId) REFERENCES batches(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS formulas (
        id TEXT PRIMARY KEY,
        batchId TEXT NOT NULL,
        targetFormula TEXT NOT NULL,
        actualFormula TEXT NOT NULL,
        missingChemicals TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (batchId) REFERENCES batches(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS review_records (
        id TEXT PRIMARY KEY,
        batchId TEXT NOT NULL,
        reviewer TEXT NOT NULL,
        judgement TEXT NOT NULL,
        notes TEXT,
        reworkPriority INTEGER,
        reworkReason TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY (batchId) REFERENCES batches(id)
      )
    `);

    this.saveToDisk();
  }

  private saveToDisk(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(DB_PATH, buffer);
  }

  createBatch(batch: Batch): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`
      INSERT INTO batches (
        id, batchNumber, fabricType, customerName,
        targetColor_L, targetColor_a, targetColor_b,
        measuredColor_L, measuredColor_a, measuredColor_b,
        deltaE, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      batch.id,
      batch.batchNumber,
      batch.fabricType,
      batch.customerName,
      batch.targetColor.L,
      batch.targetColor.a,
      batch.targetColor.b,
      batch.measuredColor?.L ?? null,
      batch.measuredColor?.a ?? null,
      batch.measuredColor?.b ?? null,
      batch.deltaE ?? null,
      batch.createdAt,
      batch.updatedAt
    ]);

    this.saveToDisk();
  }

  updateBatch(batch: Batch): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`
      UPDATE batches SET
        fabricType = ?,
        customerName = ?,
        targetColor_L = ?,
        targetColor_a = ?,
        targetColor_b = ?,
        measuredColor_L = ?,
        measuredColor_a = ?,
        measuredColor_b = ?,
        deltaE = ?,
        updatedAt = ?
      WHERE id = ?
    `, [
      batch.fabricType,
      batch.customerName,
      batch.targetColor.L,
      batch.targetColor.a,
      batch.targetColor.b,
      batch.measuredColor?.L ?? null,
      batch.measuredColor?.a ?? null,
      batch.measuredColor?.b ?? null,
      batch.deltaE ?? null,
      batch.updatedAt,
      batch.id
    ]);

    this.saveToDisk();
  }

  getBatchById(id: string): Batch | null {
    if (!this.db) return null;

    const result = this.db.exec('SELECT * FROM batches WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    return this.rowToBatch(row);
  }

  getBatchByNumber(batchNumber: string): Batch | null {
    if (!this.db) return null;

    const result = this.db.exec('SELECT * FROM batches WHERE batchNumber = ?', [batchNumber]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    return this.rowToBatch(row);
  }

  getAllBatches(): Batch[] {
    if (!this.db) return [];

    const result = this.db.exec('SELECT * FROM batches ORDER BY createdAt DESC');
    if (result.length === 0) return [];

    return result[0].values.map(row => this.rowToBatch(row));
  }

  private rowToBatch(row: any[]): Batch {
    return {
      id: row[0] as string,
      batchNumber: row[1] as string,
      fabricType: row[2] as string,
      customerName: row[3] as string,
      targetColor: {
        L: row[4] as number,
        a: row[5] as number,
        b: row[6] as number
      },
      measuredColor: row[7] !== null ? {
        L: row[7] as number,
        a: row[8] as number,
        b: row[9] as number
      } : undefined,
      deltaE: row[10] as number | undefined,
      createdAt: row[11] as number,
      updatedAt: row[12] as number
    };
  }

  createTemperatureCurve(curve: TemperatureCurve): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`
      INSERT INTO temperature_curves (
        id, batchId, targetCurve, actualCurve, temperatureDeviation, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      curve.id,
      curve.batchId,
      JSON.stringify(curve.targetCurve),
      JSON.stringify(curve.actualCurve),
      curve.temperatureDeviation ?? null,
      curve.createdAt
    ]);

    this.saveToDisk();
  }

  getTemperatureCurveByBatchId(batchId: string): TemperatureCurve | null {
    if (!this.db) return null;

    const result = this.db.exec('SELECT * FROM temperature_curves WHERE batchId = ?', [batchId]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    return {
      id: row[0] as string,
      batchId: row[1] as string,
      targetCurve: JSON.parse(row[2] as string),
      actualCurve: JSON.parse(row[3] as string),
      temperatureDeviation: row[4] as number | undefined,
      createdAt: row[5] as number
    };
  }

  createFormula(formula: Formula): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`
      INSERT INTO formulas (
        id, batchId, targetFormula, actualFormula, missingChemicals, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      formula.id,
      formula.batchId,
      JSON.stringify(formula.targetFormula),
      JSON.stringify(formula.actualFormula),
      JSON.stringify(formula.missingChemicals),
      formula.createdAt
    ]);

    this.saveToDisk();
  }

  getFormulaByBatchId(batchId: string): Formula | null {
    if (!this.db) return null;

    const result = this.db.exec('SELECT * FROM formulas WHERE batchId = ?', [batchId]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    return {
      id: row[0] as string,
      batchId: row[1] as string,
      targetFormula: JSON.parse(row[2] as string),
      actualFormula: JSON.parse(row[3] as string),
      missingChemicals: JSON.parse(row[4] as string),
      createdAt: row[5] as number
    };
  }

  createReviewRecord(record: ReviewRecord): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`
      INSERT INTO review_records (
        id, batchId, reviewer, judgement, notes,
        reworkPriority, reworkReason, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      record.id,
      record.batchId,
      record.reviewer,
      record.judgement,
      record.notes ?? null,
      record.reworkPriority ?? null,
      record.reworkReason ?? null,
      record.createdAt,
      record.updatedAt
    ]);

    this.saveToDisk();
  }

  updateReviewRecord(record: ReviewRecord): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`
      UPDATE review_records SET
        reviewer = ?,
        judgement = ?,
        notes = ?,
        reworkPriority = ?,
        reworkReason = ?,
        updatedAt = ?
      WHERE id = ?
    `, [
      record.reviewer,
      record.judgement,
      record.notes ?? null,
      record.reworkPriority ?? null,
      record.reworkReason ?? null,
      record.updatedAt,
      record.id
    ]);

    this.saveToDisk();
  }

  getReviewRecordByBatchId(batchId: string): ReviewRecord | null {
    if (!this.db) return null;

    const result = this.db.exec('SELECT * FROM review_records WHERE batchId = ?', [batchId]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    return {
      id: row[0] as string,
      batchId: row[1] as string,
      reviewer: row[2] as string,
      judgement: row[3] as ReviewRecord['judgement'],
      notes: row[4] as string | undefined,
      reworkPriority: row[5] as number | undefined,
      reworkReason: row[6] as string | undefined,
      createdAt: row[7] as number,
      updatedAt: row[8] as number
    };
  }

  getAllReviewRecords(): ReviewRecord[] {
    if (!this.db) return [];

    const result = this.db.exec('SELECT * FROM review_records ORDER BY createdAt DESC');
    if (result.length === 0) return [];

    return result[0].values.map(row => ({
      id: row[0] as string,
      batchId: row[1] as string,
      reviewer: row[2] as string,
      judgement: row[3] as ReviewRecord['judgement'],
      notes: row[4] as string | undefined,
      reworkPriority: row[5] as number | undefined,
      reworkReason: row[6] as string | undefined,
      createdAt: row[7] as number,
      updatedAt: row[8] as number
    }));
  }

  close(): void {
    if (this.db) {
      this.saveToDisk();
      this.db.close();
      this.db = null;
    }
  }
}

export const database = new DyeingDatabase();
