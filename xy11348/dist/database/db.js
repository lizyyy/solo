"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityControlDB = void 0;
const schema_1 = require("./schema");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const DEFAULT_DB_PATH = path_1.default.join(os_1.default.homedir(), '.pqc', 'quality-control.db');
class QualityControlDB {
    db;
    constructor(dbPath = DEFAULT_DB_PATH) {
        const fs = require('fs');
        const dir = path_1.default.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.db = (0, schema_1.initDatabase)(dbPath);
    }
    getDatabase() {
        return this.db;
    }
    transaction(fn) {
        const wrappedFn = this.db.transaction(fn);
        return wrappedFn();
    }
    insertThreshold(threshold) {
        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO thresholds (name, standardL, standardA, standardB, deltaLMax, deltaAMax, deltaBMax, deltaEMax)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(threshold.name, threshold.standardL, threshold.standardA, threshold.standardB, threshold.deltaLMax, threshold.deltaAMax, threshold.deltaBMax, threshold.deltaEMax);
        if (result.changes === 0) {
            const existing = this.db.prepare('SELECT id FROM thresholds WHERE name = ?').get(threshold.name);
            return existing.id;
        }
        return Number(result.lastInsertRowid);
    }
    getThresholdByName(name) {
        const stmt = this.db.prepare('SELECT * FROM thresholds WHERE name = ?');
        return stmt.get(name) || null;
    }
    getThresholdById(id) {
        const stmt = this.db.prepare('SELECT * FROM thresholds WHERE id = ?');
        return stmt.get(id) || null;
    }
    listThresholds() {
        const stmt = this.db.prepare('SELECT * FROM thresholds ORDER BY createdAt DESC');
        return stmt.all();
    }
    insertPaperBatch(batch) {
        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO paper_batches (batchNo, supplier, paperType, weight, receivedDate, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(batch.batchNo, batch.supplier, batch.paperType, batch.weight, batch.receivedDate, batch.status, batch.notes);
        if (result.changes === 0) {
            const existing = this.db.prepare('SELECT id FROM paper_batches WHERE batchNo = ?').get(batch.batchNo);
            return existing.id;
        }
        return Number(result.lastInsertRowid);
    }
    getPaperBatchByBatchNo(batchNo) {
        const stmt = this.db.prepare('SELECT * FROM paper_batches WHERE batchNo = ?');
        return stmt.get(batchNo) || null;
    }
    listPaperBatches() {
        const stmt = this.db.prepare('SELECT * FROM paper_batches ORDER BY receivedDate DESC');
        return stmt.all();
    }
    insertPrintBatch(batch) {
        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO print_batches (batchNo, productName, paperBatchId, printDate, shift, operator, machineNo, thresholdId, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(batch.batchNo, batch.productName, batch.paperBatchId, batch.printDate, batch.shift, batch.operator, batch.machineNo, batch.thresholdId, batch.status);
        if (result.changes === 0) {
            const existing = this.db.prepare('SELECT id FROM print_batches WHERE batchNo = ?').get(batch.batchNo);
            return existing.id;
        }
        return Number(result.lastInsertRowid);
    }
    getPrintBatchByBatchNo(batchNo) {
        const stmt = this.db.prepare(`
      SELECT pb.*, p.batchNo as paperBatchNo, t.name as thresholdName
      FROM print_batches pb
      JOIN paper_batches p ON pb.paperBatchId = p.id
      JOIN thresholds t ON pb.thresholdId = t.id
      WHERE pb.batchNo = ?
    `);
        return stmt.get(batchNo) || null;
    }
    updatePrintBatchStatus(batchNo, status) {
        const stmt = this.db.prepare('UPDATE print_batches SET status = ? WHERE batchNo = ?');
        stmt.run(status, batchNo);
    }
    listPrintBatches() {
        const stmt = this.db.prepare(`
      SELECT pb.*, p.batchNo as paperBatchNo, t.name as thresholdName
      FROM print_batches pb
      JOIN paper_batches p ON pb.paperBatchId = p.id
      JOIN thresholds t ON pb.thresholdId = t.id
      ORDER BY pb.printDate DESC
    `);
        return stmt.all();
    }
    insertMeasurement(measurement) {
        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO measurements (printBatchId, measurementPoint, L, a, b, deltaL, deltaA, deltaB, deltaE, isPass, isRetained, measuredAt, measuredBy, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(measurement.printBatchId, measurement.measurementPoint, measurement.L, measurement.a, measurement.b, measurement.deltaL, measurement.deltaA, measurement.deltaB, measurement.deltaE, measurement.isPass ? 1 : 0, measurement.isRetained ? 1 : 0, measurement.measuredAt, measurement.measuredBy, measurement.notes);
        if (result.changes === 0) {
            const existing = this.db.prepare(`
        SELECT id FROM measurements 
        WHERE printBatchId = ? AND measurementPoint = ? AND measuredAt = ?
      `).get(measurement.printBatchId, measurement.measurementPoint, measurement.measuredAt);
            return existing?.id || 0;
        }
        return Number(result.lastInsertRowid);
    }
    getMeasurementsByPrintBatchId(printBatchId) {
        const stmt = this.db.prepare(`
      SELECT m.*, pb.batchNo as printBatchNo
      FROM measurements m
      JOIN print_batches pb ON m.printBatchId = pb.id
      WHERE m.printBatchId = ?
      ORDER BY m.measurementPoint, m.measuredAt
    `);
        return stmt.all(printBatchId);
    }
    insertReworkRecord(record) {
        const stmt = this.db.prepare(`
      INSERT INTO rework_records (printBatchId, reworkType, reason, operator, startTime, endTime, result, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(record.printBatchId, record.reworkType, record.reason, record.operator, record.startTime, record.endTime, record.result, record.notes);
        return Number(result.lastInsertRowid);
    }
    getReworkRecordsByPrintBatchId(printBatchId) {
        const stmt = this.db.prepare(`
      SELECT r.*, pb.batchNo as printBatchNo
      FROM rework_records r
      JOIN print_batches pb ON r.printBatchId = pb.id
      WHERE r.printBatchId = ?
      ORDER BY r.startTime DESC
    `);
        return stmt.all(printBatchId);
    }
    insertReviewRecord(record) {
        const stmt = this.db.prepare(`
      INSERT INTO review_records (printBatchId, reviewer, reviewDate, decision, reason)
      VALUES (?, ?, ?, ?, ?)
    `);
        const result = stmt.run(record.printBatchId, record.reviewer, record.reviewDate, record.decision, record.reason);
        return Number(result.lastInsertRowid);
    }
    getReviewRecordsByPrintBatchId(printBatchId) {
        const stmt = this.db.prepare(`
      SELECT r.*, pb.batchNo as printBatchNo
      FROM review_records r
      JOIN print_batches pb ON r.printBatchId = pb.id
      WHERE r.printBatchId = ?
      ORDER BY r.reviewDate DESC
    `);
        return stmt.all(printBatchId);
    }
    insertInspectionReport(report) {
        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO inspection_reports (reportNo, printBatchId, generatedAt, generatedBy, totalMeasurements, passCount, failCount, passRate, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(report.reportNo, report.printBatchId, report.generatedAt, report.generatedBy, report.totalMeasurements, report.passCount, report.failCount, report.passRate, report.status);
        if (result.changes === 0) {
            const existing = this.db.prepare('SELECT id FROM inspection_reports WHERE reportNo = ?').get(report.reportNo);
            return existing.id;
        }
        return Number(result.lastInsertRowid);
    }
    getInspectionReportByReportNo(reportNo) {
        const stmt = this.db.prepare(`
      SELECT r.*, pb.batchNo as printBatchNo
      FROM inspection_reports r
      JOIN print_batches pb ON r.printBatchId = pb.id
      WHERE r.reportNo = ?
    `);
        return stmt.get(reportNo) || null;
    }
    batchInsert(items, insertFn) {
        const success = [];
        const failed = [];
        for (let i = 0; i < items.length; i++) {
            try {
                this.transaction(() => {
                    insertFn(items[i]);
                });
                success.push(items[i]);
            }
            catch (error) {
                failed.push({
                    index: i,
                    data: items[i],
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        return { success, failed };
    }
    close() {
        this.db.close();
    }
}
exports.QualityControlDB = QualityControlDB;
//# sourceMappingURL=db.js.map