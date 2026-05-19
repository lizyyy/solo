import Database from 'better-sqlite3';
import { initDatabase } from './schema';
import { Threshold, PaperBatch, PrintBatch, Measurement, ReworkRecord, ReviewRecord, InspectionReport, BatchResult } from '../types';
import path from 'path';
import os from 'os';

const DEFAULT_DB_PATH = path.join(os.homedir(), '.pqc', 'quality-control.db');

export class QualityControlDB {
  private db: Database.Database;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    const fs = require('fs');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = initDatabase(dbPath);
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  transaction<T>(fn: () => T): T {
    const wrappedFn = this.db.transaction(fn);
    return wrappedFn();
  }

  insertThreshold(threshold: Omit<Threshold, 'id' | 'createdAt'>): number {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO thresholds (name, standardL, standardA, standardB, deltaLMax, deltaAMax, deltaBMax, deltaEMax)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(threshold.name, threshold.standardL, threshold.standardA, threshold.standardB, threshold.deltaLMax, threshold.deltaAMax, threshold.deltaBMax, threshold.deltaEMax);
    if (result.changes === 0) {
      const existing = this.db.prepare('SELECT id FROM thresholds WHERE name = ?').get(threshold.name) as { id: number };
      return existing.id;
    }
    return Number(result.lastInsertRowid);
  }

  getThresholdByName(name: string): Threshold | null {
    const stmt = this.db.prepare('SELECT * FROM thresholds WHERE name = ?');
    return stmt.get(name) as Threshold || null;
  }

  getThresholdById(id: number): Threshold | null {
    const stmt = this.db.prepare('SELECT * FROM thresholds WHERE id = ?');
    return stmt.get(id) as Threshold || null;
  }

  listThresholds(): Threshold[] {
    const stmt = this.db.prepare('SELECT * FROM thresholds ORDER BY createdAt DESC');
    return stmt.all() as Threshold[];
  }

  insertPaperBatch(batch: Omit<PaperBatch, 'id' | 'createdAt'>): number {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO paper_batches (batchNo, supplier, paperType, weight, receivedDate, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(batch.batchNo, batch.supplier, batch.paperType, batch.weight, batch.receivedDate, batch.status, batch.notes);
    if (result.changes === 0) {
      const existing = this.db.prepare('SELECT id FROM paper_batches WHERE batchNo = ?').get(batch.batchNo) as { id: number };
      return existing.id;
    }
    return Number(result.lastInsertRowid);
  }

  getPaperBatchByBatchNo(batchNo: string): PaperBatch | null {
    const stmt = this.db.prepare('SELECT * FROM paper_batches WHERE batchNo = ?');
    return stmt.get(batchNo) as PaperBatch || null;
  }

  listPaperBatches(): PaperBatch[] {
    const stmt = this.db.prepare('SELECT * FROM paper_batches ORDER BY receivedDate DESC');
    return stmt.all() as PaperBatch[];
  }

  insertPrintBatch(batch: Omit<PrintBatch, 'id' | 'createdAt'>): number {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO print_batches (batchNo, productName, paperBatchId, printDate, shift, operator, machineNo, thresholdId, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(batch.batchNo, batch.productName, batch.paperBatchId, batch.printDate, batch.shift, batch.operator, batch.machineNo, batch.thresholdId, batch.status);
    if (result.changes === 0) {
      const existing = this.db.prepare('SELECT id FROM print_batches WHERE batchNo = ?').get(batch.batchNo) as { id: number };
      return existing.id;
    }
    return Number(result.lastInsertRowid);
  }

  getPrintBatchByBatchNo(batchNo: string): (PrintBatch & { paperBatchNo: string; thresholdName: string }) | null {
    const stmt = this.db.prepare(`
      SELECT pb.*, p.batchNo as paperBatchNo, t.name as thresholdName
      FROM print_batches pb
      JOIN paper_batches p ON pb.paperBatchId = p.id
      JOIN thresholds t ON pb.thresholdId = t.id
      WHERE pb.batchNo = ?
    `);
    return stmt.get(batchNo) as (PrintBatch & { paperBatchNo: string; thresholdName: string }) || null;
  }

  updatePrintBatchStatus(batchNo: string, status: PrintBatch['status']): void {
    const stmt = this.db.prepare('UPDATE print_batches SET status = ? WHERE batchNo = ?');
    stmt.run(status, batchNo);
  }

  listPrintBatches(): (PrintBatch & { paperBatchNo: string; thresholdName: string })[] {
    const stmt = this.db.prepare(`
      SELECT pb.*, p.batchNo as paperBatchNo, t.name as thresholdName
      FROM print_batches pb
      JOIN paper_batches p ON pb.paperBatchId = p.id
      JOIN thresholds t ON pb.thresholdId = t.id
      ORDER BY pb.printDate DESC
    `);
    return stmt.all() as (PrintBatch & { paperBatchNo: string; thresholdName: string })[];
  }

  insertMeasurement(measurement: Omit<Measurement, 'id' | 'createdAt'>): number {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO measurements (printBatchId, measurementPoint, L, a, b, deltaL, deltaA, deltaB, deltaE, isPass, isRetained, measuredAt, measuredBy, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      measurement.printBatchId,
      measurement.measurementPoint,
      measurement.L,
      measurement.a,
      measurement.b,
      measurement.deltaL,
      measurement.deltaA,
      measurement.deltaB,
      measurement.deltaE,
      measurement.isPass ? 1 : 0,
      measurement.isRetained ? 1 : 0,
      measurement.measuredAt,
      measurement.measuredBy,
      measurement.notes
    );
    if (result.changes === 0) {
      const existing = this.db.prepare(`
        SELECT id FROM measurements 
        WHERE printBatchId = ? AND measurementPoint = ? AND measuredAt = ?
      `).get(measurement.printBatchId, measurement.measurementPoint, measurement.measuredAt) as { id: number };
      return existing?.id || 0;
    }
    return Number(result.lastInsertRowid);
  }

  getMeasurementsByPrintBatchId(printBatchId: number): (Measurement & { printBatchNo: string })[] {
    const stmt = this.db.prepare(`
      SELECT m.*, pb.batchNo as printBatchNo
      FROM measurements m
      JOIN print_batches pb ON m.printBatchId = pb.id
      WHERE m.printBatchId = ?
      ORDER BY m.measurementPoint, m.measuredAt
    `);
    return stmt.all(printBatchId) as (Measurement & { printBatchNo: string })[];
  }

  insertReworkRecord(record: Omit<ReworkRecord, 'id' | 'createdAt'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO rework_records (printBatchId, reworkType, reason, operator, startTime, endTime, result, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(record.printBatchId, record.reworkType, record.reason, record.operator, record.startTime, record.endTime, record.result, record.notes);
    return Number(result.lastInsertRowid);
  }

  getReworkRecordsByPrintBatchId(printBatchId: number): (ReworkRecord & { printBatchNo: string })[] {
    const stmt = this.db.prepare(`
      SELECT r.*, pb.batchNo as printBatchNo
      FROM rework_records r
      JOIN print_batches pb ON r.printBatchId = pb.id
      WHERE r.printBatchId = ?
      ORDER BY r.startTime DESC
    `);
    return stmt.all(printBatchId) as (ReworkRecord & { printBatchNo: string })[];
  }

  insertReviewRecord(record: Omit<ReviewRecord, 'id' | 'createdAt'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO review_records (printBatchId, reviewer, reviewDate, decision, reason)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(record.printBatchId, record.reviewer, record.reviewDate, record.decision, record.reason);
    return Number(result.lastInsertRowid);
  }

  getReviewRecordsByPrintBatchId(printBatchId: number): (ReviewRecord & { printBatchNo: string })[] {
    const stmt = this.db.prepare(`
      SELECT r.*, pb.batchNo as printBatchNo
      FROM review_records r
      JOIN print_batches pb ON r.printBatchId = pb.id
      WHERE r.printBatchId = ?
      ORDER BY r.reviewDate DESC
    `);
    return stmt.all(printBatchId) as (ReviewRecord & { printBatchNo: string })[];
  }

  insertInspectionReport(report: Omit<InspectionReport, 'id' | 'createdAt'>): number {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO inspection_reports (reportNo, printBatchId, generatedAt, generatedBy, totalMeasurements, passCount, failCount, passRate, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(report.reportNo, report.printBatchId, report.generatedAt, report.generatedBy, report.totalMeasurements, report.passCount, report.failCount, report.passRate, report.status);
    if (result.changes === 0) {
      const existing = this.db.prepare('SELECT id FROM inspection_reports WHERE reportNo = ?').get(report.reportNo) as { id: number };
      return existing.id;
    }
    return Number(result.lastInsertRowid);
  }

  getInspectionReportByReportNo(reportNo: string): (InspectionReport & { printBatchNo: string }) | null {
    const stmt = this.db.prepare(`
      SELECT r.*, pb.batchNo as printBatchNo
      FROM inspection_reports r
      JOIN print_batches pb ON r.printBatchId = pb.id
      WHERE r.reportNo = ?
    `);
    return stmt.get(reportNo) as (InspectionReport & { printBatchNo: string }) || null;
  }

  batchInsert<T>(items: T[], insertFn: (item: T) => number): BatchResult<T> {
    const success: T[] = [];
    const failed: Array<{ index: number; data: T; error: string }> = [];

    for (let i = 0; i < items.length; i++) {
      try {
        this.transaction(() => {
          insertFn(items[i]);
        });
        success.push(items[i]);
      } catch (error) {
        failed.push({
          index: i,
          data: items[i],
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { success, failed };
  }

  close(): void {
    this.db.close();
  }
}
