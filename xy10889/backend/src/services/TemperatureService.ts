import { TemperatureRecord, ExceptionType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { runInsert, runQuery } from '../database';

const MIN_TEMP = 2;
const MAX_TEMP = 8;

export class TemperatureService {
  static validateTemperature(temperature: number): { valid: boolean; message?: string } {
    if (temperature < MIN_TEMP || temperature > MAX_TEMP) {
      return {
        valid: false,
        message: `温度 ${temperature}°C 超出范围 [${MIN_TEMP}, ${MAX_TEMP}]°C`
      };
    }
    return { valid: true };
  }

  static async addTemperatureRecord(record: Omit<TemperatureRecord, 'id'>): Promise<TemperatureRecord> {
    const id = uuidv4();
    const newRecord: TemperatureRecord = {
      ...record,
      id
    };

    await runInsert(
      `INSERT INTO temperatureRecords (id, batchId, sampleId, temperature, recordTime, location, recordedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, record.batchId || null, record.sampleId || null, record.temperature, record.recordTime, record.location, record.recordedBy]
    );

    return newRecord;
  }

  static async getTemperatureHistory(sampleId?: string, batchId?: string): Promise<TemperatureRecord[]> {
    let sql = 'SELECT * FROM temperatureRecords WHERE 1=1';
    const params: any[] = [];

    if (sampleId) {
      sql += ' AND sampleId = ?';
      params.push(sampleId);
    }
    if (batchId) {
      sql += ' AND batchId = ?';
      params.push(batchId);
    }
    sql += ' ORDER BY recordTime DESC';

    return runQuery(sql, params);
  }

  static checkTemperatureException(temperature: number): boolean {
    return temperature < MIN_TEMP || temperature > MAX_TEMP;
  }
}
