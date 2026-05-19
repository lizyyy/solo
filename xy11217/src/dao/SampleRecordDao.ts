import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { runQuery, getQuery, allQuery } from '../database';
import { SampleRecord, RecordStatus, QueryOptions, PaginatedResult } from '../types';

export class SampleRecordDao {
  async create(record: Omit<SampleRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<SampleRecord> {
    const now = dayjs().toISOString();
    const id = uuidv4();
    const newRecord: SampleRecord = {
      ...record,
      id,
      createdAt: now,
      updatedAt: now
    };

    await runQuery(`
      INSERT INTO sample_records (
        id, store_id, store_name, dish_id, dish_name, batch_no,
        sample_time, sample_person, sample_person_phone, expire_time,
        storage_location, status, review_status, review_time, reviewer,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, record.storeId, record.storeName, record.dishId, record.dishName,
      record.batchNo, record.sampleTime, record.samplePerson,
      record.samplePersonPhone || null, record.expireTime,
      record.storageLocation, record.status,
      record.reviewStatus || null, record.reviewTime || null,
      record.reviewer || null, now, now
    ]);

    return newRecord;
  }

  async bulkCreate(records: Array<Omit<SampleRecord, 'id' | 'createdAt' | 'updatedAt'>>): Promise<SampleRecord[]> {
    const now = dayjs().toISOString();
    const createdRecords: SampleRecord[] = [];

    for (const record of records) {
      const id = uuidv4();
      await runQuery(`
        INSERT INTO sample_records (
          id, store_id, store_name, dish_id, dish_name, batch_no,
          sample_time, sample_person, sample_person_phone, expire_time,
          storage_location, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, record.storeId, record.storeName, record.dishId, record.dishName,
        record.batchNo, record.sampleTime, record.samplePerson,
        record.samplePersonPhone || null, record.expireTime,
        record.storageLocation, record.status || RecordStatus.PENDING,
        now, now
      ]);
      createdRecords.push({ ...record, id, createdAt: now, updatedAt: now });
    }

    return createdRecords;
  }

  async findById(id: string): Promise<SampleRecord | null> {
    const row = await getQuery('SELECT * FROM sample_records WHERE id = ?', [id]);
    return row ? this.mapRowToRecord(row as any) : null;
  }

  async findAll(options: QueryOptions = {}): Promise<PaginatedResult<SampleRecord>> {
    const { storeId, startDate, endDate, status, page = 1, pageSize = 50 } = options;
    
    let whereClauses: string[] = [];
    let params: any[] = [];

    if (storeId) {
      whereClauses.push('store_id = ?');
      params.push(storeId);
    }
    if (startDate) {
      whereClauses.push('sample_time >= ?');
      params.push(startDate);
    }
    if (endDate) {
      whereClauses.push('sample_time <= ?');
      params.push(endDate);
    }
    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const countResult = await getQuery<{ total: number }>(
      `SELECT COUNT(*) as total FROM sample_records ${whereSql}`,
      params
    );
    const total = countResult?.total || 0;

    const offset = (page - 1) * pageSize;
    const rows = await allQuery(`
      SELECT * FROM sample_records ${whereSql}
      ORDER BY sample_time DESC LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]);

    return {
      data: rows.map(row => this.mapRowToRecord(row)),
      total,
      page,
      pageSize
    };
  }

  async findByBatchNo(batchNo: string): Promise<SampleRecord[]> {
    const rows = await allQuery(`
      SELECT * FROM sample_records WHERE batch_no = ? ORDER BY sample_time DESC
    `, [batchNo]);
    return rows.map(row => this.mapRowToRecord(row));
  }

  async findExpiredSamples(currentTime: string): Promise<SampleRecord[]> {
    const rows = await allQuery(`
      SELECT * FROM sample_records 
      WHERE expire_time < ? AND status != 'quarantined'
      ORDER BY expire_time ASC
    `, [currentTime]);
    return rows.map(row => this.mapRowToRecord(row));
  }

  async updateStatus(id: string, status: RecordStatus, reviewer?: string): Promise<boolean> {
    const now = dayjs().toISOString();
    const result = await runQuery(`
      UPDATE sample_records 
      SET status = ?, review_time = ?, reviewer = ?, updated_at = ?
      WHERE id = ?
    `, [status, now, reviewer || null, now, id]);
    return result.changes > 0;
  }

  async update(id: string, updates: Partial<SampleRecord>): Promise<boolean> {
    const now = dayjs().toISOString();
    const setClauses: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    const fieldMap: Record<string, string> = {
      storeId: 'store_id',
      storeName: 'store_name',
      dishId: 'dish_id',
      dishName: 'dish_name',
      batchNo: 'batch_no',
      sampleTime: 'sample_time',
      samplePerson: 'sample_person',
      samplePersonPhone: 'sample_person_phone',
      expireTime: 'expire_time',
      storageLocation: 'storage_location',
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
      UPDATE sample_records SET ${setClauses.join(', ')} WHERE id = ?
    `, params);
    return result.changes > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await runQuery('DELETE FROM sample_records WHERE id = ?', [id]);
    return result.changes > 0;
  }

  private mapRowToRecord(row: any): SampleRecord {
    return {
      id: row.id,
      storeId: row.store_id,
      storeName: row.store_name,
      dishId: row.dish_id,
      dishName: row.dish_name,
      batchNo: row.batch_no,
      sampleTime: row.sample_time,
      samplePerson: row.sample_person,
      samplePersonPhone: row.sample_person_phone,
      expireTime: row.expire_time,
      storageLocation: row.storage_location,
      status: row.status as RecordStatus,
      reviewStatus: row.review_status,
      reviewTime: row.review_time,
      reviewer: row.reviewer,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
