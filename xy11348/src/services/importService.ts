import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { QualityControlDB } from '../database/db';
import { QualityService } from './qualityService';
import { Threshold, PaperBatch, PrintBatch, BatchResult } from '../types';

export class ImportService {
  private db: QualityControlDB;
  private qualityService: QualityService;

  constructor(db: QualityControlDB) {
    this.db = db;
    this.qualityService = new QualityService(db);
  }

  importThresholdsFromCsv(filePath: string): BatchResult<Threshold> {
    const content = readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true
    });

    const thresholds: Omit<Threshold, 'id' | 'createdAt'>[] = records.map((r: any) => ({
      name: r.name,
      standardL: parseFloat(r.standardL),
      standardA: parseFloat(r.standardA),
      standardB: parseFloat(r.standardB),
      deltaLMax: parseFloat(r.deltaLMax),
      deltaAMax: parseFloat(r.deltaAMax),
      deltaBMax: parseFloat(r.deltaBMax),
      deltaEMax: parseFloat(r.deltaEMax)
    }));

    return this.db.batchInsert(thresholds, (t) => this.db.insertThreshold(t));
  }

  importPaperBatchesFromCsv(filePath: string): BatchResult<PaperBatch> {
    const content = readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true
    });

    const batches: Omit<PaperBatch, 'id' | 'createdAt'>[] = records.map((r: any) => ({
      batchNo: r.batchNo,
      supplier: r.supplier,
      paperType: r.paperType,
      weight: parseFloat(r.weight),
      receivedDate: r.receivedDate,
      status: r.status || 'available',
      notes: r.notes
    }));

    return this.db.batchInsert(batches, (b) => this.db.insertPaperBatch(b));
  }

  importPrintBatchFromCsv(filePath: string): { batchResult: BatchResult<PrintBatch>; measurementResult?: BatchResult<any> } {
    const content = readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true
    });

    if (records.length === 0) {
      throw new Error('CSV文件为空');
    }

    const firstRecord = records[0];
    
    const paperBatch = this.db.getPaperBatchByBatchNo(firstRecord.paperBatchNo);
    if (!paperBatch) {
      throw new Error(`纸张批次 ${firstRecord.paperBatchNo} 不存在，请先导入纸张批次`);
    }

    const threshold = this.db.getThresholdByName(firstRecord.thresholdName);
    if (!threshold) {
      throw new Error(`阈值 ${firstRecord.thresholdName} 不存在，请先导入阈值配置`);
    }

    const printBatchData: Omit<PrintBatch, 'id' | 'createdAt'> = {
      batchNo: firstRecord.printBatchNo,
      productName: firstRecord.productName,
      paperBatchId: paperBatch.id!,
      printDate: firstRecord.printDate,
      shift: firstRecord.shift,
      operator: firstRecord.operator,
      machineNo: firstRecord.machineNo,
      thresholdId: threshold.id!,
      status: 'pending'
    };

    const batchResult = this.db.batchInsert([printBatchData], (b) => this.db.insertPrintBatch(b));
    
    if (batchResult.success.length === 0) {
      return { batchResult };
    }

    const printBatch = this.db.getPrintBatchByBatchNo(firstRecord.printBatchNo);
    if (!printBatch) {
      return { batchResult };
    }

    const measurements = records.map((r: any) => ({
      measurementPoint: r.measurementPoint,
      L: parseFloat(r.L),
      a: parseFloat(r.a),
      b: parseFloat(r.b),
      measuredAt: r.measuredAt || firstRecord.printDate,
      measuredBy: r.measuredBy || firstRecord.operator,
      notes: r.notes
    }));

    const measurementResult = this.qualityService.batchProcessMeasurements(printBatch.id!, measurements);

    const evaluation = this.qualityService.evaluateBatch(firstRecord.printBatchNo);
    let status: PrintBatch['status'] = 'pending';
    if (evaluation.overallResult === 'pass') {
      status = 'approved';
    } else if (evaluation.overallResult === 'fail') {
      status = 'rejected';
    }

    this.db.updatePrintBatchStatus(firstRecord.printBatchNo, status);

    return { batchResult, measurementResult };
  }

  importMeasurementsFromCsv(filePath: string, printBatchNo: string): BatchResult<any> {
    const printBatch = this.db.getPrintBatchByBatchNo(printBatchNo);
    if (!printBatch) {
      throw new Error(`印刷批次 ${printBatchNo} 不存在`);
    }

    const content = readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true
    });

    const measurements = records.map((r: any) => ({
      measurementPoint: r.measurementPoint,
      L: parseFloat(r.L),
      a: parseFloat(r.a),
      b: parseFloat(r.b),
      measuredAt: r.measuredAt,
      measuredBy: r.measuredBy,
      notes: r.notes
    }));

    return this.qualityService.batchProcessMeasurements(printBatch.id!, measurements);
  }
}
