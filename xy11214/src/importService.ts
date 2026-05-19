import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { format } from 'date-fns';
import { run, all, get, InspectionRecord, SensorAlert, ImportError, BatchResult } from './database';
import { validateInspectionRecord, validateSensorAlert, ValidationResult } from './validations';

export async function saveImportError(
  importType: 'csv' | 'json',
  sourceFile: string,
  rowNumber: number,
  rawData: string,
  errorMessage: string,
  suggestion: string
): Promise<void> {
  await run(`
    INSERT INTO import_errors (importType, sourceFile, rowNumber, rawData, errorMessage, suggestion, isResolved, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `, [importType, sourceFile, rowNumber, rawData, errorMessage, suggestion, format(new Date(), 'yyyy-MM-dd HH:mm:ss')]);
}

export async function saveInspectionRecord(record: InspectionRecord): Promise<number> {
  const result = await run(`
    INSERT INTO inspection_records (
      inspectionDate, inspector, equipmentName, location, status,
      temperature, pressure, vibration, remarks, reviewStatus,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    record.inspectionDate,
    record.inspector,
    record.equipmentName,
    record.location,
    record.status,
    record.temperature ?? null,
    record.pressure ?? null,
    record.vibration ?? null,
    record.remarks ?? null,
    record.reviewStatus,
    record.createdAt,
    record.updatedAt
  ]);
  return Number(result.lastID);
}

export async function saveSensorAlert(alert: SensorAlert): Promise<number> {
  const result = await run(`
    INSERT INTO sensor_alerts (
      sensorId, sensorType, location, alertLevel, value, threshold,
      alertTime, isAcknowledged, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    alert.sensorId,
    alert.sensorType,
    alert.location,
    alert.alertLevel,
    alert.value,
    alert.threshold,
    alert.alertTime,
    alert.isAcknowledged,
    alert.createdAt
  ]);
  return Number(result.lastID);
}

export async function importCSV(filePath: string): Promise<BatchResult<InspectionRecord>> {
  const results: InspectionRecord[] = [];
  const failed: BatchResult<InspectionRecord>['failed'] = [];
  const sourceFile = path.basename(filePath);

  return new Promise((resolve, reject) => {
    let rowNumber = 0;
    const stream = fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', async (row) => {
        stream.pause();
        rowNumber++;
        const validation: ValidationResult<InspectionRecord> = validateInspectionRecord(row);
        
        if (validation.valid && validation.data) {
          try {
            const id = await saveInspectionRecord(validation.data);
            results.push({ ...validation.data, id });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : '保存失败';
            failed.push({
              rowNumber,
              data: validation.data,
              error: errorMsg,
              suggestion: '检查数据库连接或数据约束'
            });
            await saveImportError('csv', sourceFile, rowNumber, JSON.stringify(row), errorMsg, '检查数据库连接或数据约束');
          }
        } else {
          failed.push({
            rowNumber,
            data: {} as InspectionRecord,
            error: validation.errors.join('; '),
            suggestion: validation.suggestions.join('; ')
          });
          await saveImportError(
            'csv',
            sourceFile,
            rowNumber,
            JSON.stringify(row),
            validation.errors.join('; '),
            validation.suggestions.join('; ')
          );
        }
        stream.resume();
      })
      .on('end', () => {
        resolve({ success: results, failed });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

export async function importJSON(filePath: string): Promise<BatchResult<SensorAlert>> {
  const results: SensorAlert[] = [];
  const failed: BatchResult<SensorAlert>['failed'] = [];
  const sourceFile = path.basename(filePath);

  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  const alerts = Array.isArray(data) ? data : [data];

  for (let i = 0; i < alerts.length; i++) {
    const rowNumber = i + 1;
    const obj = alerts[i];
    const validation: ValidationResult<SensorAlert> = validateSensorAlert(obj);

    if (validation.valid && validation.data) {
      try {
        const id = await saveSensorAlert(validation.data);
        results.push({ ...validation.data, id });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '保存失败';
        failed.push({
          rowNumber,
          data: validation.data,
          error: errorMsg,
          suggestion: '检查数据库连接或数据约束'
        });
        await saveImportError('json', sourceFile, rowNumber, JSON.stringify(obj), errorMsg, '检查数据库连接或数据约束');
      }
    } else {
      failed.push({
        rowNumber,
        data: {} as SensorAlert,
        error: validation.errors.join('; '),
        suggestion: validation.suggestions.join('; ')
      });
      await saveImportError(
        'json',
        sourceFile,
        rowNumber,
        JSON.stringify(obj),
        validation.errors.join('; '),
        validation.suggestions.join('; ')
      );
    }
  }

  return { success: results, failed };
}

export async function getImportErrors(onlyUnresolved: boolean = true): Promise<ImportError[]> {
  let query = 'SELECT * FROM import_errors';
  const params: any[] = [];
  
  if (onlyUnresolved) {
    query += ' WHERE isResolved = 0';
  }
  query += ' ORDER BY createdAt DESC';
  
  return all<ImportError>(query, params);
}

export async function resolveImportError(id: number): Promise<boolean> {
  const result = await run(`
    UPDATE import_errors 
    SET isResolved = 1, resolvedAt = ?
    WHERE id = ?
  `, [format(new Date(), 'yyyy-MM-dd HH:mm:ss'), id]);
  return result.changes > 0;
}
