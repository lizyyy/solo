import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { runQuery, getQuery, allQuery } from '../database';
import { TemperatureRecord, RecordStatus, QueryOptions, PaginatedResult } from '../types';

export class TemperatureRecordDao {
  async create(record: Omit<TemperatureRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<TemperatureRecord> {
    const now = dayjs().toISOString();
    const id = uuidv4();
    const newRecord: TemperatureRecord = {
      ...record,
      id,
      createdAt: now,
      updatedAt: now
    };

    await runQuery(`
      INSERT INTO temperature_records (
        id, store_id, store_name, fridge_id, fridge_name,
        record_time, temperature, min_temp, max_temp,
        record_person, record_person_phone, status,
        review_status, review_time, reviewer, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, record.storeId, record.storeName, record.fridgeId, record.fridgeName,
      record.recordTime, record.temperature, record.minTemp, record.maxTemp,
      record.recordPerson, record.recordPersonPhone || null, record.status,
      record.reviewStatus || null, record.reviewTime || null, record.reviewer || null,
      now, now
    ]);

    return newRecord;
  }

  async bulkCreate(records: Array<Omit<TemperatureRecord, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TemperatureRecord[]> {
    const now = dayjs().toISOString();
    const createdRecords: TemperatureRecord[] = [];

    for (const record of records) {
      const id = uuidv4();
      await runQuery(`
        INSERT INTO temperature_records (
          id, store_id, store_name, fridge_id, fridge_name,
          record_time, temperature, min_temp, max_temp,
          record_person, record_person_phone, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, record.storeId, record.storeName, record.fridgeId, record.fridgeName,
        record.recordTime, record.temperature, record.minTemp, record.maxTemp,
        record.recordPerson, record.recordPersonPhone || null,
        record.status || RecordStatus.PENDING, now, now
      ]);
      createdRecords.push({ ...record, id, createdAt: now, updatedAt: now });
    }

    return createdRecords;
  }

  async findById(id: string): Promise<TemperatureRecord | null> {
    const row = await getQuery('SELECT * FROM temperature_records WHERE id = ?', [id]);
    return row ? this.mapRowToRecord(row as any) : null;
  }

  async findAll(options: QueryOptions = {}): Promise<PaginatedResult<TemperatureRecord>> {
    const { storeId, startDate, endDate, status, page = 1, pageSize = 50 } = options;
    
    let whereClauses: string[] = [];
    let params: any[] = [];

    if (storeId) {
      whereClauses.push('store_id = ?');
      params.push(storeId);
    }
    if (startDate) {
      whereClauses.push('record_time >= ?');
      params.push(startDate);
    }
    if (endDate) {
      whereClauses.push('record_time <= ?');
      params.push(endDate);
    }
    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const countResult = await getQuery<{ total: number }>(
      `SELECT COUNT(*) as total FROM temperature_records ${whereSql}`,
      params
    );
    const total = countResult?.total || 0;

    const offset = (page - 1) * pageSize;
    const rows = await allQuery(`
      SELECT * FROM temperature_records ${whereSql}
      ORDER BY record_time DESC LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]);

    return {
      data: rows.map(row => this.mapRowToRecord(row)),
      total,
      page,
      pageSize
    };
  }

  async findByStoreAndDateRange(storeId: string, startDate: string, endDate: string): Promise<TemperatureRecord[]> {
    const rows = await allQuery(`
      SELECT * FROM temperature_records 
      WHERE store_id = ? AND record_time >= ? AND record_time <= ?
      ORDER BY record_time ASC
    `, [storeId, startDate, endDate]);
    return rows.map(row => this.mapRowToRecord(row));
  }

  async findTemperatureAnomalies(): Promise<TemperatureRecord[]> {
    const rows = await allQuery(`
      SELECT * FROM temperature_records 
      WHERE (temperature < min_temp OR temperature > max_temp) 
        AND status != 'rejected'
      ORDER BY record_time DESC
    `);
    return rows.map(row => this.mapRowToRecord(row));
  }

  async updateStatus(id: string, status: RecordStatus, reviewer?: string): Promise<boolean> {
    const now = dayjs().toISOString();
    const result = await runQuery(`
      UPDATE temperature_records 
      SET status = ?, review_time = ?, reviewer = ?, updated_at = ?
      WHERE id = ?
    `, [status, now, reviewer || null, now, id]);
    return result.changes > 0;
  }

  async update(id: string, updates: Partial<TemperatureRecord>): Promise<boolean> {
    const now = dayjs().toISOString();
    const setClauses: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    const fieldMap: Record<string, string> = {
      storeId: 'store_id',
      storeName: 'store_name',
      fridgeId: 'fridge_id',
      fridgeName: 'fridge_name',
      recordTime: 'record_time',
      temperature: 'temperature',
      minTemp: 'min_temp',
      maxTemp: 'max_temp',
      recordPerson: 'record_person',
      recordPersonPhone: 'record_person_phone',
      status: 'status',
      reviewStatus: 'review_status',
      reviewTime: 'review_time',
      reviewer: 'reviewer'
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMap[key];
      if (dbField && value !== undefined) {
        setClauses.push(`${dbField} = ?`);
        params.push(value);
      }
    }

    params.push(id);
    const result = await runQuery(`
      UPDATE temperature_records SET ${setClauses.join(', ')} WHERE id = ?
    `, params);
    return result.changes > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await runQuery('DELETE FROM temperature_records WHERE id = ?', [id]);
    return result.changes > 0;
  }

  private mapRowToRecord(row: any): TemperatureRecord {
    return {
      id: row.id,
      storeId: row.store_id,
      storeName: row.store_name,
      fridgeId: row.fridge_id,
      fridgeName: row.fridge_name,
      recordTime: row.record_time,
      temperature: row.temperature,
      minTemp: row.min_temp,
      maxTemp: row.max_temp,
      recordPerson: row.record_person,
      recordPersonPhone: row.record_person_phone,
      status: row.status as RecordStatus,
      reviewStatus: row.review_status,
      reviewTime: row.review_time,
      reviewer: row.reviewer,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
