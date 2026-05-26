import { getDb } from '../database';
import { createAuditLog } from './auditService';
import { validatePurchaseRecord } from './validationService';
import { addDays } from 'date-fns';
import { PurchaseRecord, RecordStatus, QueryFilter } from '../types';

export function getPendingRecords(batchId?: string): PurchaseRecord[] {
  const db = getDb();
  let query = `
    SELECT pr.*, c.name as customer_name, m.name as medicine_name, m.category as medicine_category
    FROM purchase_records pr
    JOIN customers c ON pr.customer_id = c.id
    JOIN medicines m ON pr.medicine_id = m.id
    WHERE pr.status = 'pending'
  `;
  const params: any[] = [];

  if (batchId) {
    query += ' AND pr.batch_id = ?';
    params.push(batchId);
  }

  query += ' ORDER BY pr.purchase_date DESC';

  const rows = db.prepare(query).all(...params) as any[];
  return rows.map(mapRowToRecord);
}

export function getRecordById(recordId: string): PurchaseRecord | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT pr.*, c.name as customer_name, m.name as medicine_name, m.category as medicine_category
    FROM purchase_records pr
    JOIN customers c ON pr.customer_id = c.id
    JOIN medicines m ON pr.medicine_id = m.id
    WHERE pr.id = ?
  `).get(recordId) as any;

  return row ? mapRowToRecord(row) : null;
}

export function processRecord(
  recordId: string,
  action: 'approve' | 'reject' | 'return',
  reason: string,
  operator: string,
  notes?: string
): PurchaseRecord | null {
  const db = getDb();
  const record = getRecordById(recordId);

  if (!record) return null;

  let newStatus: RecordStatus;
  let actionText: string;

  switch (action) {
    case 'approve':
      newStatus = 'approved';
      actionText = '审核通过';
      break;
    case 'reject':
      newStatus = 'rejected';
      actionText = '审核拒绝';
      break;
    case 'return':
      newStatus = 'returned';
      actionText = '退回修改';
      break;
    default:
      return null;
  }

  const validation = validatePurchaseRecord(
    record.customerId,
    record.medicineId,
    record.purchaseDate,
    record.quantity
  );

  let followUpDate: number | null = null;
  if (action === 'approve') {
    const followUpRule = db.prepare(`
      SELECT * FROM follow_up_rules WHERE medicine_category = ?
    `).get((record as any).medicineCategory || '') as any;

    if (followUpRule) {
      followUpDate = addDays(record.purchaseDate, followUpRule.days_after_purchase).getTime();
    }
  }

  db.prepare(`
    UPDATE purchase_records
    SET status = ?, processed_by = ?, processed_at = ?, follow_up_date = ?, notes = ?
    WHERE id = ?
  `).run(newStatus, operator, Date.now(), followUpDate, notes || record.notes, recordId);

  createAuditLog(recordId, actionText, reason, operator, {
    oldStatus: record.status,
    newStatus,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
    notes
  });

  return getRecordById(recordId);
}

export function queryRecords(filter: QueryFilter): PurchaseRecord[] {
  const db = getDb();
  let query = `
    SELECT pr.*, c.name as customer_name, c.tags as customer_tags,
           m.name as medicine_name, m.category as medicine_category
    FROM purchase_records pr
    JOIN customers c ON pr.customer_id = c.id
    JOIN medicines m ON pr.medicine_id = m.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filter.status) {
    query += ' AND pr.status = ?';
    params.push(filter.status);
  }

  if (filter.startDate) {
    query += ' AND pr.purchase_date >= ?';
    params.push(filter.startDate);
  }

  if (filter.endDate) {
    query += ' AND pr.purchase_date <= ?';
    params.push(filter.endDate);
  }

  if (filter.medicineCategories && filter.medicineCategories.length > 0) {
    const placeholders = filter.medicineCategories.map(() => '?').join(',');
    query += ` AND m.category IN (${placeholders})`;
    params.push(...filter.medicineCategories);
  }

  query += ' ORDER BY pr.purchase_date DESC';

  let rows = db.prepare(query).all(...params) as any[];

  if (filter.customerTags && filter.customerTags.length > 0) {
    rows = rows.filter((row: any) => {
      const tags = JSON.parse(row.customer_tags || '[]');
      return filter.customerTags!.some(tag => tags.includes(tag));
    });
  }

  return rows.map(mapRowToRecord);
}

export function exportRecords(filter: QueryFilter): any[] {
  const records = queryRecords(filter);
  return records.map(record => ({
    id: record.id,
    customerId: record.customerId,
    customerName: (record as any).customerName,
    medicineId: record.medicineId,
    medicineName: (record as any).medicineName,
    medicineCategory: (record as any).medicineCategory,
    quantity: record.quantity,
    purchaseDate: new Date(record.purchaseDate).toISOString().split('T')[0],
    status: record.status,
    processedBy: record.processedBy,
    processedAt: record.processedAt ? new Date(record.processedAt).toISOString().split('T')[0] : '',
    followUpDate: record.followUpDate ? new Date(record.followUpDate).toISOString().split('T')[0] : '',
    notes: record.notes
  }));
}

export function getRecordWithAuditTrail(recordId: string): any {
  const record = getRecordById(recordId);
  if (!record) return null;

  const auditLogs = (db: any) => {
    const rows = db.prepare(`
      SELECT * FROM audit_logs WHERE record_id = ? ORDER BY timestamp DESC
    `).all(recordId) as any[];

    return rows.map(row => ({
      id: row.id,
      action: row.action,
      reason: row.reason,
      operator: row.operator,
      timestamp: row.timestamp,
      timestampFormatted: new Date(row.timestamp).toLocaleString('zh-CN'),
      details: JSON.parse(row.details || '{}')
    }));
  };

  const db = getDb();
  const logs = auditLogs(db);

  return {
    record,
    auditTrail: logs,
    processingHistory: logs.map(log => ({
      action: log.action,
      reason: log.reason,
      operator: log.operator,
      time: log.timestampFormatted,
      details: log.details
    }))
  };
}

function mapRowToRecord(row: any): PurchaseRecord & { customerName?: string; medicineName?: string; medicineCategory?: string } {
  return {
    id: row.id,
    batchId: row.batch_id,
    customerId: row.customer_id,
    medicineId: row.medicine_id,
    quantity: row.quantity,
    purchaseDate: row.purchase_date,
    status: row.status,
    processedBy: row.processed_by,
    processedAt: row.processed_at,
    followUpDate: row.follow_up_date,
    notes: row.notes,
    customerName: row.customer_name,
    medicineName: row.medicine_name,
    medicineCategory: row.medicine_category
  };
}
