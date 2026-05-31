import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import {
  CollisionRecord,
  StudentRecord,
  RawCollisionData,
  ImportBatch,
  UnitConversionError
} from './types';
import { CollisionCalculator, getDefaultCalibration } from './calculator';
import { Database } from './database';

export interface ImportResult {
  success: boolean;
  batchId: string;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
  unitErrors: UnitConversionError[];
}

export class DataImporter {
  private db: Database;
  private calculator: CollisionCalculator;

  constructor(db: Database) {
    this.db = db;
    const calibration = db.getCalibration() || getDefaultCalibration();
    this.calculator = new CollisionCalculator(calibration);
    if (!db.getCalibration()) {
      db.saveCalibration(calibration);
    }
  }

  async importFromCSV(filePath: string, operator: string, reason?: string): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
      const records: any[] = [];
      const errors: string[] = [];
      let lineNumber = 1;

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          lineNumber++;
          try {
            records.push(data);
          } catch (e: any) {
            errors.push(`行 ${lineNumber}: ${e.message}`);
          }
        })
        .on('end', () => {
          resolve(this.processRecords(records, filePath, operator, reason, errors));
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  importFromExcel(filePath: string, operator: string, reason?: string): ImportResult {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const records = xlsx.utils.sheet_to_json(sheet);
    return this.processRecords(records, filePath, operator, reason, []);
  }

  private processRecords(
    rawRecords: any[],
    filePath: string,
    operator: string,
    reason: string | undefined,
    initialErrors: string[]
  ): ImportResult {
    const batchId = this.generateBatchId();
    const errors = [...initialErrors];
    const unitErrors: UnitConversionError[] = [];
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < rawRecords.length; i++) {
      const raw = rawRecords[i];
      const lineNum = i + 2;

      try {
        const parsed = this.parseRawRecord(raw, lineNum);
        
        if (parsed.unitErrors.length > 0) {
          unitErrors.push(...parsed.unitErrors);
        }

        const collisionRecord = this.createCollisionRecord(parsed.data, batchId);
        const existing = this.db.getRecord(collisionRecord.id);

        this.db.addRecord(collisionRecord, operator, reason);

        if (existing) {
          updatedCount++;
        } else {
          importedCount++;
        }
      } catch (e: any) {
        errors.push(`行 ${lineNum}: ${e.message}`);
        skippedCount++;
      }
    }

    const batch: ImportBatch = {
      id: batchId,
      fileName: path.basename(filePath),
      importTime: new Date().toISOString(),
      recordCount: importedCount + updatedCount,
      operator,
      status: skippedCount === 0 && errors.length === 0 ? 'completed' : 'partial'
    };
    this.db.addBatch(batch);

    return {
      success: skippedCount === 0,
      batchId,
      importedCount,
      updatedCount,
      skippedCount,
      errorCount: errors.length,
      errors,
      unitErrors
    };
  }

  private parseRawRecord(raw: any, lineNum: number): { data: { student: StudentRecord; rawData: RawCollisionData }; unitErrors: UnitConversionError[] } {
    const unitErrors: UnitConversionError[] = [];

    const requiredFields = ['studentId', 'studentName', 'experimentDate', 'ballMass', 'ballDiameter', 'initialHeight', 'horizontalDisplacement', 'collisionDisplacement'];
    for (const field of requiredFields) {
      if (raw[field] === undefined || raw[field] === null || raw[field] === '') {
        throw new Error(`缺少必填字段: ${field}`);
      }
    }

    const studentId = String(raw.studentId).trim();
    const recordId = `${studentId}_${String(raw.experimentDate).trim().replace(/-/g, '')}`;

    const student: StudentRecord = {
      studentId,
      studentName: String(raw.studentName).trim(),
      groupId: raw.groupId ? String(raw.groupId).trim() : undefined,
      experimentDate: String(raw.experimentDate).trim()
    };

    const parseNumber = (value: any, field: string, unit: string, expectedRange?: [number, number]): number => {
      const strValue = String(value).trim();
      let num = parseFloat(strValue.replace(/[^\d.-]/g, ''));
      
      if (isNaN(num)) {
        throw new Error(`字段 ${field} 不是有效的数字: ${strValue}`);
      }

      if (expectedRange && (num < expectedRange[0] * 10 || num > expectedRange[1] * 10)) {
        if (num >= 1000 && field === 'ballMass') {
          unitErrors.push({
            recordId,
            field,
            rawValue: strValue,
            expectedUnit: 'kg',
            detectedUnit: 'g',
            suggestion: `建议值: ${(num / 1000).toFixed(4)} kg`
          });
          num = num / 1000;
        }
      }

      return num;
    };

    const rawData: RawCollisionData = {
      recordId,
      ballMass: parseNumber(raw.ballMass, 'ballMass', 'kg', [0.05, 0.15]),
      ballDiameter: parseNumber(raw.ballDiameter, 'ballDiameter', 'm', [0.01, 0.05]),
      initialHeight: parseNumber(raw.initialHeight, 'initialHeight', 'cm'),
      horizontalDisplacement: parseNumber(raw.horizontalDisplacement, 'horizontalDisplacement', 'cm'),
      collisionDisplacement: parseNumber(raw.collisionDisplacement, 'collisionDisplacement', 'cm'),
      notes: raw.notes ? String(raw.notes).trim() : undefined
    };

    return { data: { student, rawData }, unitErrors };
  }

  private createCollisionRecord(
    data: { student: StudentRecord; rawData: RawCollisionData },
    batchId: string
  ): CollisionRecord {
    const now = new Date().toISOString();
    const calculation = this.calculator.calculate(data.rawData);
    const anomalies = this.calculator.detectAnomalies(data.rawData, calculation);

    return {
      id: data.rawData.recordId,
      student: data.student,
      rawData: data.rawData,
      calculation,
      anomalies,
      status: anomalies.length === 0 ? 'imported' : 'pending',
      createdAt: now,
      updatedAt: now,
      version: 1,
      importBatchId: batchId
    };
  }

  private generateBatchId(): string {
    return 'BATCH_' + Date.now().toString(36).toUpperCase();
  }
}
