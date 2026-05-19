import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { runQuery, getQuery, allQuery } from '../database';
import { WasteRecord, RecordStatus, QueryOptions, PaginatedResult } from '../types';

export class WasteRecordDao {
  async create(record: Omit<WasteRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<WasteRecord> {
    const now = dayjs().toISOString();
    const id = uuidv4();
    const newRecord: WasteRecord = {
      ...record,
      id,
      createdAt: now,
      updatedAt: now
    };

    await runQuery(`
      INSERT INTO waste_records (
        id, store_id, store_name, dish_id, dish_name, batch_no,
        waste_time, waste_amount, waste_reason, waste_person,
        waste_person_phone, status, review_status, review_time,
        reviewer, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, record.storeId, record.storeName, record.dishId, record.dishName,
      record.batchNo, record.wasteTime, record.wasteAmount, record.wasteReason,
      record.wastePerson, record.wastePersonPhone || null, record.status,
      record.reviewStatus || null, record.reviewTime || null, record.reviewer || null,
      now, now
    ]);

    return newRecord;
  }

  async bulkCreate(records: Array<Omit<WasteRecord, 'id' | 'createdAt' | 'updatedAt'>>): Promise<WasteRecord[]> {
    const now = dayjs().toISOString();
    const createdRecords: WasteRecord[] = [];

    for (const record of records) {
      const id = uuidv4();
      await runQuery(`
        INSERT INTO waste_records (
          id, store_id, store_name, dish_id, dish_name, batch_no,
          waste_time, waste_amount, waste_reason, waste_person,
          waste_person_phone, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, record.storeId, record.storeName, record.dishId, record.dishName,
        record.batchNo, record.wasteTime, record.wasteAmount, record.wasteReason,
        record.wastePerson, record.wastePersonPhone || null,
        record.status || RecordStatus.PENDING, now, now
      ]);
      createdRecords.push({ ...record, id, createdAt: now, updatedAt: now });
    }

    return createdRecords;
  }

  async findById(id: string): Promise<WasteRecord | null> {
    const row = await getQuery('SELECT * FROM waste_records WHERE id = ?', [id]);
    return row ? this.mapRowToRecord(row as any) : null;
  }

  async findAll(options: QueryOptions = {}): Promise<PaginatedResult<WasteRecord>> {
    const { storeId, startDate, endDate, status, page = 1, pageSize = 50 } = options;
    
    let whereClauses: string[] = [];
    let params: any[] = [];

    if (storeId) {
      whereClauses.push('store_id = ?');
      params.push(storeId);
    }
    if (startDate) {
      whereClauses.push('waste_time >= ?');
      params.push(startDate);
    }
    if (endDate) {
      whereClauses.push('waste_time <= ?');
      params.push(endDate);
    }
    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const countResult = await getQuery<{ total: number }>(
      `SELECT COUNT(*) as total FROM waste_records ${whereSql}`,
      params
    );
    const total = countResult?.total || 0;

    const offset = (page - 1) * pageSize;
    const rows = await allQuery(`
      SELECT * FROM waste_records ${whereSql}
      ORDER BY waste_time DESC LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]);

    return {
      data: rows.map(row => this.mapRowToRecord(row)),
      total,
      page,
      pageSize
    };
  }

  async findByBatchNo(batchNo: string): Promise<WasteRecord[]> {
    const rows = await allQuery(`
      SELECT * FROM waste_records WHERE batch_no = ? ORDER BY waste_time DESC
    `, [batchNo]);
    return rows.map(row => this.mapRowToRecord(row));
  }

  async updateStatus(id: string, status: RecordStatus, reviewer?: string): Promise<boolean> {
    const now = dayjs().toISOString();
    const result = await runQuery(`
      UPDATE waste_records 
      SET status = ?, review_time = ?, reviewer = ?, updated_at = ?
      WHERE id = ?
    `, [status, now, reviewer || null, now, id]);
    return result.changes > 0;
  }

  async update(id: string, updates: Partial<WasteRecord>): Promise<boolean> {
    const now = dayjs().toISOString();
    const setClauses: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    const fieldMap: Record<string, string> = {
      storeId: 'store_id',
      storeName: 'store_name',
      dishId: 'dish_id',
      dishName: 'dish_name',
      batchNo: 'batch_no',
      wasteTime: 'waste_time',
      wasteAmount: 'waste_amount',
      wasteReason: 'waste_reason',
      wastePerson: 'waste_person',
      wastePersonPhone: 'waste_person_phone',
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
      UPDATE waste_records SET ${setClauses.join(', ')} WHERE id = ?
    `, params);
    return result.changes > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await runQuery('DELETE FROM waste_records WHERE id = ?', [id]);
    return result.changes > 0;
  }

  private mapRowToRecord(row: any): WasteRecord {
    return {
      id: row.id,
      storeId: row.store_id,
      storeName: row.store_name,
      dishId: row.dish_id,
      dishName: row.dish_name,
      batchNo: row.batch_no,
      wasteTime: row.waste_time,
      wasteAmount: row.waste_amount,
      wasteReason: row.waste_reason,
      wastePerson: row.waste_person,
      wastePersonPhone: row.waste_person_phone,
      status: row.status as RecordStatus,
      reviewStatus: row.review_status,
      reviewTime: row.review_time,
      reviewer: row.reviewer,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
