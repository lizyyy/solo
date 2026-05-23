import { getDB } from './init';
import { v4 as uuidv4 } from 'uuid';
import {
  ReturnBatch,
  EquipmentItem,
  Attachment,
  AuditLog,
  FailedRecord,
  DepositDeduction,
  ReturnStatus,
  AuditAction,
  AttachmentType,
  FinancialSummary
} from '../types';

function serialize(obj: any): string {
  return JSON.stringify(obj);
}

function deserialize(str: string | null): any {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

export const BatchDAO = {
  async create(batch: Omit<ReturnBatch, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReturnBatch> {
    const db = getDB();
    const id = uuidv4();
    const now = new Date().toISOString();
    
    return new Promise((resolve, reject) => {
      db.run(`INSERT INTO return_batches (
        id, batch_no, customer_id, customer_name, order_id,
        total_deposit, deductible_amount, final_refund, status,
        previous_status, freeze_reason, frozen_by, frozen_at,
        manual_reason, created_by, created_at, updated_by, updated_at,
        is_archived, archived_at, archived_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, batch.batchNo, batch.customerId, batch.customerName, batch.orderId,
          batch.totalDeposit, batch.deductibleAmount, batch.finalRefund, batch.status,
          batch.previousStatus || null, batch.freezeReason || null, batch.frozenBy || null, batch.frozenAt?.toISOString() || null,
          batch.manualReason || null, batch.createdBy, now, batch.updatedBy, now,
          0, null, null
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ ...batch, id, createdAt: new Date(now), updatedAt: new Date(now), isArchived: false });
        }
      );
    });
  },

  async findById(id: string): Promise<ReturnBatch | null> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM return_batches WHERE id = ?`, [id], (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve(this.mapRowToBatch(row));
      });
    });
  },

  async findByBatchNo(batchNo: string): Promise<ReturnBatch | null> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM return_batches WHERE batch_no = ?`, [batchNo], (err, row: any) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve(this.mapRowToBatch(row));
      });
    });
  },

  async updateStatus(id: string, status: ReturnStatus, reason: string, operatorId: string, operatorName: string): Promise<void> {
    const db = getDB();
    const now = new Date().toISOString();
    const batch = await this.findById(id);
    if (!batch) throw new Error('Batch not found');

    return new Promise((resolve, reject) => {
      db.run(`UPDATE return_batches SET status = ?, previous_status = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
        [status, batch.status, operatorId, now, id],
        async (err) => {
          if (err) reject(err);
          else {
            await AuditLogDAO.create({
              batchId: id,
              action: AuditAction.STATUS_CHANGE,
              previousValue: batch.status,
              newValue: status,
              reason,
              operatorId,
              operatorName,
              timestamp: new Date()
            });
            resolve();
          }
        }
      );
    });
  },

  async freeze(id: string, reason: string, operatorId: string, operatorName: string): Promise<void> {
    const db = getDB();
    const now = new Date().toISOString();
    const batch = await this.findById(id);
    if (!batch) throw new Error('Batch not found');

    return new Promise((resolve, reject) => {
      db.run(`UPDATE return_batches SET 
        status = ?, previous_status = ?, freeze_reason = ?, frozen_by = ?, frozen_at = ?,
        updated_by = ?, updated_at = ? WHERE id = ?`,
        [ReturnStatus.SETTLEMENT_FROZEN, batch.status, reason, operatorId, now, operatorId, now, id],
        async (err) => {
          if (err) reject(err);
          else {
            await AuditLogDAO.create({
              batchId: id,
              action: AuditAction.FREEZE,
              previousValue: batch.status,
              newValue: ReturnStatus.SETTLEMENT_FROZEN,
              reason,
              operatorId,
              operatorName,
              timestamp: new Date()
            });
            resolve();
          }
        }
      );
    });
  },

  async unfreeze(id: string, reason: string, operatorId: string, operatorName: string): Promise<void> {
    const db = getDB();
    const now = new Date().toISOString();
    const batch = await this.findById(id);
    if (!batch) throw new Error('Batch not found');
    const targetStatus = batch.previousStatus || ReturnStatus.UNDER_REVIEW;

    return new Promise((resolve, reject) => {
      db.run(`UPDATE return_batches SET 
        status = ?, previous_status = ?, freeze_reason = NULL, frozen_by = NULL, frozen_at = NULL,
        updated_by = ?, updated_at = ? WHERE id = ?`,
        [targetStatus, batch.status, operatorId, now, id],
        async (err) => {
          if (err) reject(err);
          else {
            await AuditLogDAO.create({
              batchId: id,
              action: AuditAction.UNFREEZE,
              previousValue: batch.status,
              newValue: targetStatus,
              reason,
              operatorId,
              operatorName,
              timestamp: new Date()
            });
            resolve();
          }
        }
      );
    });
  },

  async archive(id: string, reason: string, operatorId: string, operatorName: string): Promise<void> {
    const db = getDB();
    const now = new Date().toISOString();
    const batch = await this.findById(id);
    if (!batch) throw new Error('Batch not found');

    return new Promise((resolve, reject) => {
      db.run(`UPDATE return_batches SET 
        is_archived = 1, archived_at = ?, archived_by = ?,
        status = ?, previous_status = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
        [now, operatorId, ReturnStatus.ARCHIVED, batch.status, operatorId, now, id],
        async (err) => {
          if (err) reject(err);
          else {
            await AuditLogDAO.create({
              batchId: id,
              action: AuditAction.ARCHIVE,
              previousValue: batch.status,
              newValue: ReturnStatus.ARCHIVED,
              reason,
              operatorId,
              operatorName,
              timestamp: new Date()
            });
            resolve();
          }
        }
      );
    });
  },

  async updateDeductions(id: string, deductibleAmount: number, finalRefund: number, reason: string, operatorId: string, operatorName: string): Promise<void> {
    const db = getDB();
    const now = new Date().toISOString();
    const batch = await this.findById(id);
    if (!batch) throw new Error('Batch not found');

    return new Promise((resolve, reject) => {
      db.run(`UPDATE return_batches SET 
        deductible_amount = ?, final_refund = ?, manual_reason = ?,
        updated_by = ?, updated_at = ? WHERE id = ?`,
        [deductibleAmount, finalRefund, reason, operatorId, now, id],
        async (err) => {
          if (err) reject(err);
          else {
            await AuditLogDAO.create({
              batchId: id,
              action: AuditAction.MANUAL_EDIT,
              previousValue: { deductibleAmount: batch.deductibleAmount, finalRefund: batch.finalRefund },
              newValue: { deductibleAmount, finalRefund },
              reason,
              operatorId,
              operatorName,
              timestamp: new Date()
            });
            resolve();
          }
        }
      );
    });
  },

  async findAll(filters?: { status?: ReturnStatus; customerId?: string; isArchived?: boolean }, page = 1, pageSize = 20): Promise<{ data: ReturnBatch[]; total: number }> {
    const db = getDB();
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (filters?.status) {
      whereClause += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.customerId) {
      whereClause += ' AND customer_id = ?';
      params.push(filters.customerId);
    }
    if (filters?.isArchived !== undefined) {
      whereClause += ' AND is_archived = ?';
      params.push(filters.isArchived ? 1 : 0);
    }

    const countPromise = new Promise<number>((resolve, reject) => {
      db.get(`SELECT COUNT(*) as count FROM return_batches ${whereClause}`, params, (err, row: any) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    const offset = (page - 1) * pageSize;
    const dataPromise = new Promise<ReturnBatch[]>((resolve, reject) => {
      db.all(`SELECT * FROM return_batches ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map(row => this.mapRowToBatch(row)));
        }
      );
    });

    const [total, data] = await Promise.all([countPromise, dataPromise]);
    return { data, total };
  },

  mapRowToBatch(row: any): ReturnBatch {
    return {
      id: row.id,
      batchNo: row.batch_no,
      customerId: row.customer_id,
      customerName: row.customer_name,
      orderId: row.order_id,
      totalDeposit: row.total_deposit,
      deductibleAmount: row.deductible_amount,
      finalRefund: row.final_refund,
      status: row.status as ReturnStatus,
      previousStatus: row.previous_status as ReturnStatus,
      freezeReason: row.freeze_reason,
      frozenBy: row.frozen_by,
      frozenAt: row.frozen_at ? new Date(row.frozen_at) : undefined,
      manualReason: row.manual_reason,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedBy: row.updated_by,
      updatedAt: new Date(row.updated_at),
      isArchived: row.is_archived === 1,
      archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
      archivedBy: row.archived_by,
      equipmentList: []
    };
  }
};

export const EquipmentDAO = {
  async create(items: Omit<EquipmentItem, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<EquipmentItem[]> {
    const db = getDB();
    const createdItems: EquipmentItem[] = [];

    for (const item of items) {
      const id = uuidv4();
      const now = new Date().toISOString();

      await new Promise<void>((resolve, reject) => {
        db.run(`INSERT INTO equipment_items (
          id, batch_id, equipment_code, equipment_name, expected_return_date,
          actual_return_date, deposit_amount, deductible_amount, condition, notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, item.batchId, item.equipmentCode, item.equipmentName,
            item.expectedReturnDate.toISOString(),
            item.actualReturnDate?.toISOString() || null,
            item.depositAmount, item.deductibleAmount, item.condition,
            item.notes || null, now, now
          ],
          (err) => {
            if (err) reject(err);
            else {
              createdItems.push({ ...item, id, createdAt: new Date(now), updatedAt: new Date(now) });
              resolve();
            }
          }
        );
      });
    }

    return createdItems;
  },

  async findByBatchId(batchId: string): Promise<EquipmentItem[]> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM equipment_items WHERE batch_id = ?`, [batchId], (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          id: row.id,
          batchId: row.batch_id,
          equipmentCode: row.equipment_code,
          equipmentName: row.equipment_name,
          expectedReturnDate: new Date(row.expected_return_date),
          actualReturnDate: row.actual_return_date ? new Date(row.actual_return_date) : undefined,
          depositAmount: row.deposit_amount,
          deductibleAmount: row.deductible_amount,
          condition: row.condition,
          notes: row.notes,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        })));
      });
    });
  }
};

export const AttachmentDAO = {
  async create(attachment: Omit<Attachment, 'id' | 'uploadedAt'>): Promise<Attachment> {
    const db = getDB();
    const id = uuidv4();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      db.run(`INSERT INTO attachments (
        id, batch_id, type, file_name, file_url, file_size,
        uploaded_by, uploaded_at, is_verified, verified_by, verified_at, verification_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, attachment.batchId, attachment.type, attachment.fileName,
          attachment.fileUrl, attachment.fileSize, attachment.uploadedBy, now,
          0, null, null, null
        ],
        async (err) => {
          if (err) reject(err);
          else {
            await AuditLogDAO.create({
              batchId: attachment.batchId,
              action: AuditAction.ATTACHMENT_UPLOAD,
              previousValue: null,
              newValue: { id, type: attachment.type, fileName: attachment.fileName },
              reason: 'Upload attachment',
              operatorId: attachment.uploadedBy,
              operatorName: attachment.uploadedBy,
              timestamp: new Date()
            });
            resolve({ ...attachment, id, uploadedAt: new Date(now), isVerified: false });
          }
        }
      );
    });
  },

  async findByBatchId(batchId: string): Promise<Attachment[]> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM attachments WHERE batch_id = ? ORDER BY uploaded_at DESC`, [batchId], (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          id: row.id,
          batchId: row.batch_id,
          type: row.type as AttachmentType,
          fileName: row.file_name,
          fileUrl: row.file_url,
          fileSize: row.file_size,
          uploadedBy: row.uploaded_by,
          uploadedAt: new Date(row.uploaded_at),
          isVerified: row.is_verified === 1,
          verifiedBy: row.verified_by,
          verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
          verificationNotes: row.verification_notes
        })));
      });
    });
  },

  async verify(id: string, verifiedBy: string, notes?: string): Promise<void> {
    const db = getDB();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      db.run(`UPDATE attachments SET is_verified = 1, verified_by = ?, verified_at = ?, verification_notes = ? WHERE id = ?`,
        [verifiedBy, now, notes || null, id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
};

export const AuditLogDAO = {
  async create(log: Omit<AuditLog, 'id'>): Promise<AuditLog> {
    const db = getDB();
    const id = uuidv4();

    return new Promise((resolve, reject) => {
      db.run(`INSERT INTO audit_logs (
        id, batch_id, action, previous_value, new_value, reason,
        operator_id, operator_name, timestamp, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, log.batchId, log.action,
          typeof log.previousValue === 'object' ? serialize(log.previousValue) : log.previousValue,
          typeof log.newValue === 'object' ? serialize(log.newValue) : log.newValue,
          log.reason, log.operatorId, log.operatorName,
          log.timestamp.toISOString(), log.ipAddress || null
        ],
        (err) => {
          if (err) reject(err);
          else resolve({ ...log, id });
        }
      );
    });
  },

  async findByBatchId(batchId: string): Promise<AuditLog[]> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM audit_logs WHERE batch_id = ? ORDER BY timestamp DESC`, [batchId], (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          id: row.id,
          batchId: row.batch_id,
          action: row.action as AuditAction,
          previousValue: deserialize(row.previous_value),
          newValue: deserialize(row.new_value),
          reason: row.reason,
          operatorId: row.operator_id,
          operatorName: row.operator_name,
          timestamp: new Date(row.timestamp),
          ipAddress: row.ip_address
        })));
      });
    });
  }
};

export const FailedRecordDAO = {
  async create(record: Omit<FailedRecord, 'id' | 'failedAt' | 'resolved'>): Promise<FailedRecord> {
    const db = getDB();
    const id = uuidv4();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      db.run(`INSERT INTO failed_records (
        id, batch_id, failure_type, error_message, error_details,
        source_data, failed_at, resolved, resolved_at, resolved_by, resolution_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, record.batchId || null, record.failureType, record.errorMessage,
          record.errorDetails ? serialize(record.errorDetails) : null,
          serialize(record.sourceData), now, 0, null, null, null
        ],
        (err) => {
          if (err) reject(err);
          else resolve({ ...record, id, failedAt: new Date(now), resolved: false });
        }
      );
    });
  },

  async findAll(resolved?: boolean, page = 1, pageSize = 20): Promise<{ data: FailedRecord[]; total: number }> {
    const db = getDB();
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (resolved !== undefined) {
      whereClause += ' AND resolved = ?';
      params.push(resolved ? 1 : 0);
    }

    const countPromise = new Promise<number>((resolve, reject) => {
      db.get(`SELECT COUNT(*) as count FROM failed_records ${whereClause}`, params, (err, row: any) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    const offset = (page - 1) * pageSize;
    const dataPromise = new Promise<FailedRecord[]>((resolve, reject) => {
      db.all(`SELECT * FROM failed_records ${whereClause} ORDER BY failed_at DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map(row => ({
            id: row.id,
            batchId: row.batch_id,
            failureType: row.failure_type,
            errorMessage: row.error_message,
            errorDetails: deserialize(row.error_details),
            sourceData: deserialize(row.source_data),
            failedAt: new Date(row.failed_at),
            resolved: row.resolved === 1,
            resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
            resolvedBy: row.resolved_by,
            resolutionNotes: row.resolution_notes
          })));
        }
      );
    });

    const [total, data] = await Promise.all([countPromise, dataPromise]);
    return { data, total };
  },

  async resolve(id: string, resolvedBy: string, notes: string): Promise<void> {
    const db = getDB();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      db.run(`UPDATE failed_records SET resolved = 1, resolved_at = ?, resolved_by = ?, resolution_notes = ? WHERE id = ?`,
        [now, resolvedBy, notes, id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
};

export const DeductionDAO = {
  async create(deduction: Omit<DepositDeduction, 'id' | 'createdAt' | 'isApproved'>): Promise<DepositDeduction> {
    const db = getDB();
    const id = uuidv4();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      db.run(`INSERT INTO deposit_deductions (
        id, batch_id, equipment_id, deduction_type, amount, reason,
        evidence_attachment_ids, created_by, created_at, is_approved,
        approved_by, approved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, deduction.batchId, deduction.equipmentId || null, deduction.deductionType,
          deduction.amount, deduction.reason,
          deduction.evidenceAttachmentIds.join(','),
          deduction.createdBy, now, 0, null, null
        ],
        (err) => {
          if (err) reject(err);
          else resolve({ ...deduction, id, createdAt: new Date(now), isApproved: false });
        }
      );
    });
  },

  async findByBatchId(batchId: string): Promise<DepositDeduction[]> {
    const db = getDB();
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM deposit_deductions WHERE batch_id = ? ORDER BY created_at DESC`, [batchId], (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          id: row.id,
          batchId: row.batch_id,
          equipmentId: row.equipment_id,
          deductionType: row.deduction_type,
          amount: row.amount,
          reason: row.reason,
          evidenceAttachmentIds: row.evidence_attachment_ids ? row.evidence_attachment_ids.split(',') : [],
          createdBy: row.created_by,
          createdAt: new Date(row.created_at),
          isApproved: row.is_approved === 1,
          approvedBy: row.approved_by,
          approvedAt: row.approved_at ? new Date(row.approved_at) : undefined
        })));
      });
    });
  },

  async approve(id: string, approvedBy: string): Promise<void> {
    const db = getDB();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      db.run(`UPDATE deposit_deductions SET is_approved = 1, approved_by = ?, approved_at = ? WHERE id = ?`,
        [approvedBy, now, id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
};

export const SummaryDAO = {
  async getFinancialSummary(): Promise<FinancialSummary> {
    const db = getDB();

    const totalsPromise = new Promise<any>((resolve, reject) => {
      db.get(`SELECT 
        COUNT(*) as totalBatches,
        SUM(total_deposit) as totalDeposit,
        SUM(deductible_amount) as totalDeductions,
        SUM(final_refund) as totalRefunds
      FROM return_batches WHERE is_archived = 0`, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const frozenPromise = new Promise<any>((resolve, reject) => {
      db.get(`SELECT SUM(total_deposit) as frozenAmount FROM return_batches WHERE status = ? AND is_archived = 0`,
        [ReturnStatus.SETTLEMENT_FROZEN], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
    });

    const pendingPromise = new Promise<any>((resolve, reject) => {
      db.get(`SELECT SUM(total_deposit) as pendingAmount FROM return_batches WHERE status IN (?, ?, ?) AND is_archived = 0`,
        [ReturnStatus.UNDER_REVIEW, ReturnStatus.ATTACHMENTS_PENDING, ReturnStatus.ATTACHMENTS_COMPLETE],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
    });

    const byStatusPromise = new Promise<any[]>((resolve, reject) => {
      db.all(`SELECT status, COUNT(*) as count, SUM(total_deposit) as amount 
        FROM return_batches WHERE is_archived = 0 GROUP BY status`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
    });

    const [totals, frozen, pending, byStatusRows] = await Promise.all([
      totalsPromise, frozenPromise, pendingPromise, byStatusPromise
    ]);

    const byStatus: Record<ReturnStatus, { count: number; amount: number }> = {} as any;
    Object.values(ReturnStatus).forEach(status => {
      byStatus[status] = { count: 0, amount: 0 };
    });

    byStatusRows.forEach((row: any) => {
      if (byStatus[row.status as ReturnStatus]) {
        byStatus[row.status as ReturnStatus] = {
          count: row.count,
          amount: row.amount || 0
        };
      }
    });

    return {
      totalBatches: totals.totalBatches || 0,
      totalDeposit: totals.totalDeposit || 0,
      totalDeductions: totals.totalDeductions || 0,
      totalRefunds: totals.totalRefunds || 0,
      frozenAmount: frozen.frozenAmount || 0,
      pendingReviewAmount: pending.pendingAmount || 0,
      byStatus
    };
  }
};
