import db from '../database';
import { v4 as uuidv4 } from 'uuid';
import { InspectionRecord, InspectionStatus, FlowType, OperationType, OperationHistory } from '../types';

export class InspectionRecordModel {
  static async create(record: Omit<InspectionRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<InspectionRecord> {
    const id = uuidv4();
    const now = new Date().toISOString();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO inspection_records (id, planId, deviceId, inspectorId, planDate, actualInspectionDate, supplementReason, supplementDate, discoveredDate, status, flowType, remarks, attachmentUrls, requiredMaterials, inspectionResults, createdBy, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, record.planId, record.deviceId, record.inspectorId, record.planDate,
          record.actualInspectionDate || null, record.supplementReason || null,
          record.supplementDate || null, record.discoveredDate || null,
          record.status, record.flowType, record.remarks || null,
          record.attachmentUrls ? JSON.stringify(record.attachmentUrls) : null,
          record.requiredMaterials ? JSON.stringify(record.requiredMaterials) : null,
          record.inspectionResults ? JSON.stringify(record.inspectionResults) : null,
          record.createdBy, now, now
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ ...record, id, createdAt: now, updatedAt: now });
        }
      );
    });
  }

  static async update(id: string, updates: Partial<InspectionRecord>): Promise<void> {
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt') {
        fields.push(`${key} = ?`);
        if (Array.isArray(value) || typeof value === 'object') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    });

    fields.push('updatedAt = ?');
    values.push(now, id);

    return new Promise((resolve, reject) => {
      db.run(`UPDATE inspection_records SET ${fields.join(', ')} WHERE id = ?`, values, function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  static async findById(id: string): Promise<InspectionRecord | undefined> {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM inspection_records WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else if (row) {
          const record = row as any;
          if (record.attachmentUrls) record.attachmentUrls = JSON.parse(record.attachmentUrls);
          if (record.requiredMaterials) record.requiredMaterials = JSON.parse(record.requiredMaterials);
          if (record.inspectionResults) record.inspectionResults = JSON.parse(record.inspectionResults);
          resolve(record as InspectionRecord);
        } else {
          resolve(undefined);
        }
      });
    });
  }

  static async findAll(params?: { status?: InspectionStatus; flowType?: FlowType; page?: number; pageSize?: number }): Promise<{ list: InspectionRecord[]; total: number }> {
    let whereClause = '1=1';
    const values: any[] = [];

    if (params?.status) {
      whereClause += ' AND status = ?';
      values.push(params.status);
    }

    if (params?.flowType) {
      whereClause += ' AND flowType = ?';
      values.push(params.flowType);
    }

    const countQuery = `SELECT COUNT(*) as total FROM inspection_records WHERE ${whereClause}`;
    let query = `SELECT * FROM inspection_records WHERE ${whereClause} ORDER BY createdAt DESC`;

    if (params?.page && params?.pageSize) {
      const offset = (params.page - 1) * params.pageSize;
      query += ` LIMIT ? OFFSET ?`;
      values.push(params.pageSize, offset);
    }

    return new Promise((resolve, reject) => {
      db.get(countQuery, values.slice(0, values.length - (params?.page && params?.pageSize ? 2 : 0)), (err, countRow) => {
        if (err) reject(err);
        else {
          db.all(query, values, (err, rows) => {
            if (err) reject(err);
            else {
              const records = (rows as any[]).map(row => {
                if (row.attachmentUrls) row.attachmentUrls = JSON.parse(row.attachmentUrls);
                if (row.requiredMaterials) row.requiredMaterials = JSON.parse(row.requiredMaterials);
                if (row.inspectionResults) row.inspectionResults = JSON.parse(row.inspectionResults);
                return row as InspectionRecord;
              });
              resolve({ list: records, total: (countRow as any).total });
            }
          });
        }
      });
    });
  }

  static async addHistory(history: Omit<OperationHistory, 'id'>): Promise<OperationHistory> {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO operation_history (id, recordId, operationType, operatorId, operatorName, previousStatus, newStatus, remarks, operationTime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, history.recordId, history.operationType, history.operatorId, history.operatorName, history.previousStatus || null, history.newStatus, history.remarks || null, history.operationTime],
        function(err) {
          if (err) reject(err);
          else resolve({ ...history, id });
        }
      );
    });
  }

  static async getHistory(recordId: string): Promise<OperationHistory[]> {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM operation_history WHERE recordId = ? ORDER BY operationTime DESC`, [recordId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows as OperationHistory[]);
      });
    });
  }
}
