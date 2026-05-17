import { db } from '../models/database';
import { SupplementRecord, SupplementStatus, HistoryLog, QueryFilter, PaginatedResult, ConflictInfo } from '../models/types';

class SupplementService {
  private async addHistoryLog(log: Omit<HistoryLog, 'id' | 'created_at'>): Promise<void> {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO history_logs (record_id, action, from_status, to_status, operator, remark, change_detail)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [log.record_id, log.action, log.from_status, log.to_status, log.operator, log.remark, log.change_detail],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });
  }

  async findDuplicate(record: Partial<SupplementRecord>): Promise<SupplementRecord | null> {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM supplement_records WHERE waybill_no = ? AND carrier = ? AND node_time = ?`,
        [record.waybill_no, record.carrier, record.node_time],
        (err, row: any) => {
          if (err) reject(err);
          resolve(row || null);
        }
      );
    });
  }

  async checkConflicts(record: Partial<SupplementRecord>): Promise<ConflictInfo | null> {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM supplement_records WHERE waybill_no = ? AND node_type = ? AND id != ?`,
        [record.waybill_no, record.node_type, record.id || -1],
        (err, rows: any[]) => {
          if (err) reject(err);
          
          for (const existing of rows) {
            if (existing.carrier !== record.carrier) {
              const conflictFields: string[] = [];
              if (existing.node_time !== record.node_time) {
                conflictFields.push('node_time');
              }
              if (conflictFields.length > 0) {
                resolve({
                  existingRecord: existing,
                  newRecord: record,
                  conflictFields
                });
              }
            }
          }
          resolve(null);
        }
      );
    });
  }

  async create(record: Omit<SupplementRecord, 'id' | 'created_at' | 'updated_at'>, operator?: string): Promise<SupplementRecord> {
    const duplicate = await this.findDuplicate(record);
    if (duplicate) {
      throw new Error('重复记录：相同运单号、承运商、节点时间已存在');
    }

    const conflictInfo = await this.checkConflicts(record);
    const service = this;
    
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO supplement_records 
         (waybill_no, carrier, node_time, node_type, supplement_source, status, handler, business_object, conflict_info, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.waybill_no,
          record.carrier,
          record.node_time,
          record.node_type,
          record.supplement_source,
          conflictInfo ? SupplementStatus.CONFLICT : record.status,
          record.handler,
          record.business_object,
          conflictInfo ? JSON.stringify(conflictInfo) : undefined,
          record.remark
        ],
        async function(err: Error | null) {
          if (err) return reject(err);
          const stmt = this as any;
          const id = stmt.lastID;
          
          const createdRecord = { ...record, id, status: conflictInfo ? SupplementStatus.CONFLICT : record.status };
          await service.addHistoryLog({
            record_id: id,
            action: 'CREATE',
            to_status: conflictInfo ? SupplementStatus.CONFLICT : record.status,
            operator,
            remark: conflictInfo ? '检测到冲突，自动标记为冲突待判' : '创建补传记录'
          });
          
          resolve(createdRecord as SupplementRecord);
        }
      );
    });
  }

  async getById(id: number): Promise<SupplementRecord | null> {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM supplement_records WHERE id = ?`, [id], (err, row: any) => {
        if (err) reject(err);
        resolve(row || null);
      });
    });
  }

  async query(filter: QueryFilter): Promise<PaginatedResult<SupplementRecord>> {
    const page = filter.page || 1;
    const pageSize = filter.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let whereClause = '1=1';
    const params: any[] = [];

    if (filter.startDate) {
      whereClause += ' AND created_at >= ?';
      params.push(filter.startDate);
    }
    if (filter.endDate) {
      whereClause += ' AND created_at <= ?';
      params.push(filter.endDate);
    }
    if (filter.status) {
      whereClause += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter.handler) {
      whereClause += ' AND handler LIKE ?';
      params.push(`%${filter.handler}%`);
    }
    if (filter.business_object) {
      whereClause += ' AND business_object LIKE ?';
      params.push(`%${filter.business_object}%`);
    }
    if (filter.waybill_no) {
      whereClause += ' AND waybill_no LIKE ?';
      params.push(`%${filter.waybill_no}%`);
    }
    if (filter.carrier) {
      whereClause += ' AND carrier LIKE ?';
      params.push(`%${filter.carrier}%`);
    }

    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM supplement_records WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
        (err, rows: any[]) => {
          if (err) reject(err);
          
          db.get(
            `SELECT COUNT(*) as total FROM supplement_records WHERE ${whereClause}`,
            params,
            (err, countRow: any) => {
              if (err) reject(err);
              resolve({
                data: rows,
                total: countRow.total,
                page,
                pageSize
              });
            }
          );
        }
      );
    });
  }

  async updateStatus(id: number, newStatus: SupplementStatus, operator?: string, remark?: string): Promise<SupplementRecord> {
    const record = await this.getById(id);
    if (!record) {
      throw new Error('记录不存在');
    }

    const validTransitions: Record<SupplementStatus, SupplementStatus[]> = {
      [SupplementStatus.PENDING]: [SupplementStatus.RECEIVED, SupplementStatus.CONFLICT, SupplementStatus.ARCHIVED],
      [SupplementStatus.RECEIVED]: [SupplementStatus.CONFLICT, SupplementStatus.ARCHIVED],
      [SupplementStatus.CONFLICT]: [SupplementStatus.RECEIVED, SupplementStatus.ARCHIVED],
      [SupplementStatus.ARCHIVED]: []
    };

    if (!validTransitions[record.status]?.includes(newStatus)) {
      throw new Error(`无效的状态流转: ${record.status} -> ${newStatus}`);
    }

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE supplement_records SET status = ?, updated_at = CURRENT_TIMESTAMP, remark = COALESCE(?, remark) WHERE id = ?`,
        [newStatus, remark, id],
        async (err) => {
          if (err) reject(err);
          
          await this.addHistoryLog({
            record_id: id,
            action: 'STATUS_CHANGE',
            from_status: record.status,
            to_status: newStatus,
            operator,
            remark: remark || '状态更新'
          });
          
          const updatedRecord = await this.getById(id);
          resolve(updatedRecord!);
        }
      );
    });
  }

  async update(id: number, updates: Partial<SupplementRecord>, operator?: string): Promise<SupplementRecord> {
    const record = await this.getById(id);
    if (!record) {
      throw new Error('记录不存在');
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    const changeDetails: string[] = [];

    const fields = ['waybill_no', 'carrier', 'node_time', 'node_type', 'supplement_source', 'handler', 'business_object', 'remark'];
    for (const field of fields) {
      if (updates[field as keyof SupplementRecord] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field as keyof SupplementRecord]);
        changeDetails.push(`${field}: ${record[field as keyof SupplementRecord]} -> ${updates[field as keyof SupplementRecord]}`);
      }
    }

    if (updateFields.length === 0) {
      return record;
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE supplement_records SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues,
        async (err) => {
          if (err) reject(err);
          
          await this.addHistoryLog({
            record_id: id,
            action: 'UPDATE',
            from_status: record.status,
            to_status: record.status,
            operator,
            change_detail: changeDetails.join('; ')
          });
          
          const updatedRecord = await this.getById(id);
          resolve(updatedRecord!);
        }
      );
    });
  }

  async getHistory(recordId: number): Promise<HistoryLog[]> {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM history_logs WHERE record_id = ? ORDER BY created_at DESC`,
        [recordId],
        (err, rows: any[]) => {
          if (err) reject(err);
          resolve(rows);
        }
      );
    });
  }

  async getAllForExport(filter: Omit<QueryFilter, 'page' | 'pageSize'>): Promise<SupplementRecord[]> {
    const result = await this.query({ ...filter, page: 1, pageSize: 10000 });
    return result.data;
  }

  async batchCreate(records: Omit<SupplementRecord, 'id' | 'created_at' | 'updated_at'>[], operator?: string): Promise<{
    success: SupplementRecord[];
    failed: { record: Omit<SupplementRecord, 'id' | 'created_at' | 'updated_at'>; error: string }[];
  }> {
    const success: SupplementRecord[] = [];
    const failed: { record: Omit<SupplementRecord, 'id' | 'created_at' | 'updated_at'>; error: string }[] = [];

    for (const record of records) {
      try {
        const created = await this.create(record, operator);
        success.push(created);
      } catch (error: any) {
        failed.push({ record, error: error.message });
      }
    }

    return { success, failed };
  }
}

export const supplementService = new SupplementService();
