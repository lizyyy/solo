import { DatabaseConnection } from './database';
import * as Types from './types';
import { generateId, dateToString, stringToDate, normalizePlate } from './utils';

export class HistoryRepository {
  private db: DatabaseConnection;

  constructor(dbConnection?: DatabaseConnection) {
    this.db = dbConnection || DatabaseConnection.getInstance();
  }

  record(
    entityType: Types.OperationHistory['entityType'],
    entityId: string,
    operationType: Types.OperationHistory['operationType'],
    source: Types.RecordSource,
    options: { beforeData?: any; afterData?: any; reason?: string; operator?: string; batchId?: string } = {}
  ): string {
    const id = generateId();
    const stmt = this.db.prepare(`
      INSERT INTO operation_history (
        id, entity_type, entity_id, operation_type, before_data, after_data,
        reason, operator, source, batch_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      id,
      entityType,
      entityId,
      operationType,
      options.beforeData ? JSON.stringify(options.beforeData) : null,
      options.afterData ? JSON.stringify(options.afterData) : null,
      options.reason || null,
      options.operator || null,
      source,
      options.batchId || null,
      dateToString(new Date())
    ]);
    stmt.free();
    return id;
  }

  getHistory(entityType: Types.OperationHistory['entityType'], entityId: string): Types.OperationHistory[] {
    const stmt = this.db.prepare(`
      SELECT * FROM operation_history 
      WHERE entity_type = ? AND entity_id = ? 
      ORDER BY created_at DESC
    `);
    stmt.bind([entityType, entityId]);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows.map(this.rowToHistory);
  }

  private rowToHistory(row: any): Types.OperationHistory {
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      operationType: row.operation_type,
      beforeData: row.before_data,
      afterData: row.after_data,
      reason: row.reason,
      operator: row.operator,
      source: row.source,
      batchId: row.batch_id,
      createdAt: stringToDate(row.created_at)
    };
  }
}

export class ParkingRecordRepository {
  private db: DatabaseConnection;
  private historyRepo: HistoryRepository;

  constructor(dbConnection?: DatabaseConnection) {
    this.db = dbConnection || DatabaseConnection.getInstance();
    this.historyRepo = new HistoryRepository(this.db);
  }

  create(record: Omit<Types.ParkingRecord, 'id' | 'createdAt' | 'recognizedPlates'>, source: Types.RecordSource, options: { batchId?: string; operator?: string } = {}): string {
    const id = generateId();
    const now = new Date();
    const stmt = this.db.prepare(`
      INSERT INTO parking_records (
        id, plate_number, parking_lot_id, parking_lot_name, berth_id, berth_number,
        entry_time, exit_time, duration_minutes, total_amount, paid_amount, unpaid_amount,
        payment_status, payment_channel, is_recognized_plate, source, batch_id, imported_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      id,
      record.plateNumber,
      record.parkingLotId,
      record.parkingLotName,
      record.berthId,
      record.berthNumber,
      dateToString(record.entryTime),
      dateToString(record.exitTime),
      record.durationMinutes,
      record.totalAmount,
      record.paidAmount,
      record.unpaidAmount,
      record.paymentStatus,
      record.paymentChannel || null,
      record.isRecognizedPlate ? 1 : 0,
      source,
      options.batchId || null,
      record.importedAt ? dateToString(record.importedAt) : null,
      dateToString(now)
    ]);
    stmt.free();
    this.historyRepo.record('parking_record', id, 'create', source, {
      afterData: { ...record, id },
      operator: options.operator,
      batchId: options.batchId
    });
    return id;
  }

  findById(id: string): Types.ParkingRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM parking_records WHERE id = ?
    `);
    stmt.bind([id]);
    const hasRow = stmt.step();
    const row = hasRow ? stmt.getAsObject() : null;
    stmt.free();
    if (!row) return null;
    return this.rowToRecord(row);
  }

  findByPlate(plateNumber: string): Types.ParkingRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM parking_records WHERE plate_number = ? ORDER BY exit_time DESC
    `);
    stmt.bind([plateNumber]);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows.map(this.rowToRecord);
  }

  findByBatch(batchId: string): Types.ParkingRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM parking_records WHERE batch_id = ?
    `);
    stmt.bind([batchId]);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows.map(this.rowToRecord);
  }

  findUnpaid(): Types.ParkingRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM parking_records 
      WHERE payment_status IN ('unpaid', 'partial') 
      ORDER BY exit_time ASC
    `);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows.map(this.rowToRecord);
  }

  updatePayment(id: string, paidAmount: number, operator?: string): void {
    const existing = this.findById(id);
    if (!existing) return;

    const newPaidAmount = existing.paidAmount + paidAmount;
    const newUnpaidAmount = Math.max(0, existing.totalAmount - newPaidAmount);
    const newStatus = newUnpaidAmount <= 0 ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'unpaid');

    const stmt = this.db.prepare(`
      UPDATE parking_records 
      SET paid_amount = ?, unpaid_amount = ?, payment_status = ? 
      WHERE id = ?
    `);
    stmt.run([newPaidAmount, newUnpaidAmount, newStatus, id]);
    stmt.free();

    this.historyRepo.record('parking_record', id, 'update', 'system', {
      beforeData: existing,
      afterData: { ...existing, paidAmount: newPaidAmount, unpaidAmount: newUnpaidAmount, paymentStatus: newStatus },
      reason: '支付回调处理',
      operator
    });
  }

  private rowToRecord(row: any): Types.ParkingRecord {
    return {
      id: row.id,
      plateNumber: row.plate_number,
      parkingLotId: row.parking_lot_id,
      parkingLotName: row.parking_lot_name,
      berthId: row.berth_id,
      berthNumber: row.berth_number,
      entryTime: stringToDate(row.entry_time),
      exitTime: stringToDate(row.exit_time),
      durationMinutes: row.duration_minutes,
      totalAmount: row.total_amount,
      paidAmount: row.paid_amount,
      unpaidAmount: row.unpaid_amount,
      paymentStatus: row.payment_status,
      paymentChannel: row.payment_channel,
      recognizedPlates: [],
      isRecognizedPlate: row.is_recognized_plate === 1,
      source: row.source,
      batchId: row.batch_id,
      importedAt: row.imported_at ? stringToDate(row.imported_at) : undefined,
      createdAt: stringToDate(row.created_at)
    };
  }
}

export class ArrearsGroupRepository {
  private db: DatabaseConnection;
  private historyRepo: HistoryRepository;

  constructor(dbConnection?: DatabaseConnection) {
    this.db = dbConnection || DatabaseConnection.getInstance();
    this.historyRepo = new HistoryRepository(this.db);
  }

  create(group: Omit<Types.ArrearsGroup, 'id' | 'createdAt' | 'updatedAt'>, source: Types.RecordSource, options: { batchId?: string; operator?: string } = {}): string {
    const id = generateId();
    const now = new Date();
    const stmt = this.db.prepare(`
      INSERT INTO arrears_groups (
        id, plate_number, normalized_plate, total_unpaid_amount, record_count,
        status, latest_parking_time, first_unpaid_time, merged_record_ids,
        batch_id, last_collection_time, collection_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      id,
      group.plateNumber,
      group.normalizedPlate,
      group.totalUnpaidAmount,
      group.recordCount,
      group.status,
      dateToString(group.latestParkingTime),
      dateToString(group.firstUnpaidTime),
      JSON.stringify(group.mergedRecordIds),
      options.batchId || null,
      group.lastCollectionTime ? dateToString(group.lastCollectionTime) : null,
      group.collectionCount,
      dateToString(now),
      dateToString(now)
    ]);
    stmt.free();
    this.historyRepo.record('arrears_group', id, 'create', source, {
      afterData: { ...group, id },
      operator: options.operator,
      batchId: options.batchId
    });
    return id;
  }

  findById(id: string): Types.ArrearsGroup | null {
    const stmt = this.db.prepare(`
      SELECT * FROM arrears_groups WHERE id = ?
    `);
    stmt.bind([id]);
    const hasRow = stmt.step();
    const row = hasRow ? stmt.getAsObject() : null;
    stmt.free();
    if (!row) return null;
    return this.rowToGroup(row);
  }

  findByPlate(plate: string): Types.ArrearsGroup | null {
    const normalized = normalizePlate(plate);
    const stmt = this.db.prepare(`
      SELECT * FROM arrears_groups 
      WHERE normalized_plate = ? AND status NOT IN ('withdrawn')
      ORDER BY created_at DESC
    `);
    stmt.bind([normalized]);
    const hasRow = stmt.step();
    const row = hasRow ? stmt.getAsObject() : null;
    stmt.free();
    if (!row) return null;
    return this.rowToGroup(row);
  }

  findByStatus(status: Types.ArrearsStatus): Types.ArrearsGroup[] {
    const stmt = this.db.prepare(`
      SELECT * FROM arrears_groups WHERE status = ? ORDER BY total_unpaid_amount DESC
    `);
    stmt.bind([status]);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows.map(this.rowToGroup);
  }

  update(id: string, updates: Partial<Types.ArrearsGroup>, source: Types.RecordSource, options: { reason?: string; operator?: string; batchId?: string } = {}): void {
    const existing = this.findById(id);
    if (!existing) return;

    const stmt = this.db.prepare(`
      UPDATE arrears_groups SET 
        total_unpaid_amount = COALESCE(?, total_unpaid_amount),
        record_count = COALESCE(?, record_count),
        status = COALESCE(?, status),
        latest_parking_time = COALESCE(?, latest_parking_time),
        first_unpaid_time = COALESCE(?, first_unpaid_time),
        merged_record_ids = COALESCE(?, merged_record_ids),
        last_collection_time = COALESCE(?, last_collection_time),
        collection_count = COALESCE(?, collection_count),
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run([
      updates.totalUnpaidAmount ?? null,
      updates.recordCount ?? null,
      updates.status ?? null,
      updates.latestParkingTime ? dateToString(updates.latestParkingTime) : null,
      updates.firstUnpaidTime ? dateToString(updates.firstUnpaidTime) : null,
      updates.mergedRecordIds ? JSON.stringify(updates.mergedRecordIds) : null,
      updates.lastCollectionTime ? dateToString(updates.lastCollectionTime) : null,
      updates.collectionCount ?? null,
      dateToString(new Date()),
      id
    ]);
    stmt.free();

    const updated = this.findById(id)!;
    this.historyRepo.record('arrears_group', id, 'update', source, {
      beforeData: existing,
      afterData: updated,
      reason: options.reason,
      operator: options.operator,
      batchId: options.batchId
    });
  }

  withdraw(id: string, reason: string, operator?: string): void {
    this.update(id, { status: 'withdrawn' }, 'system', {
      reason,
      operator
    });
    this.historyRepo.record('arrears_group', id, 'withdraw', 'system', {
      reason,
      operator
    });
  }

  private rowToGroup(row: any): Types.ArrearsGroup {
    return {
      id: row.id,
      plateNumber: row.plate_number,
      normalizedPlate: row.normalized_plate,
      totalUnpaidAmount: row.total_unpaid_amount,
      recordCount: row.record_count,
      status: row.status,
      latestParkingTime: stringToDate(row.latest_parking_time),
      firstUnpaidTime: stringToDate(row.first_unpaid_time),
      mergedRecordIds: JSON.parse(row.merged_record_ids),
      batchId: row.batch_id,
      lastCollectionTime: row.last_collection_time ? stringToDate(row.last_collection_time) : undefined,
      collectionCount: row.collection_count,
      createdAt: stringToDate(row.created_at),
      updatedAt: stringToDate(row.updated_at)
    };
  }
}

export class CollectionRecordRepository {
  private db: DatabaseConnection;

  constructor(dbConnection?: DatabaseConnection) {
    this.db = dbConnection || DatabaseConnection.getInstance();
  }

  create(record: Omit<Types.CollectionRecord, 'id'>, options: { batchId?: string; operator?: string } = {}): string {
    const id = generateId();
    const stmt = this.db.prepare(`
      INSERT INTO collection_records (
        id, arrears_group_id, plate_number, action_type, action_result,
        channel, message, operator, source, batch_id, triggered_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      id,
      record.arrearsGroupId,
      record.plateNumber,
      record.actionType,
      record.actionResult,
      record.channel,
      record.message || null,
      options.operator || null,
      record.source,
      options.batchId || null,
      dateToString(record.triggeredAt),
      record.completedAt ? dateToString(record.completedAt) : null
    ]);
    stmt.free();
    return id;
  }

  findByArrearsGroup(arrearsGroupId: string): Types.CollectionRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM collection_records WHERE arrears_group_id = ? ORDER BY triggered_at DESC
    `);
    stmt.bind([arrearsGroupId]);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows.map(this.rowToRecord);
  }

  private rowToRecord(row: any): Types.CollectionRecord {
    return {
      id: row.id,
      arrearsGroupId: row.arrears_group_id,
      plateNumber: row.plate_number,
      actionType: row.action_type,
      actionResult: row.action_result,
      channel: row.channel,
      message: row.message,
      operator: row.operator,
      source: row.source,
      batchId: row.batch_id,
      triggeredAt: stringToDate(row.triggered_at),
      completedAt: row.completed_at ? stringToDate(row.completed_at) : undefined
    };
  }
}

export class PaymentCallbackRepository {
  private db: DatabaseConnection;
  private historyRepo: HistoryRepository;

  constructor(dbConnection?: DatabaseConnection) {
    this.db = dbConnection || DatabaseConnection.getInstance();
    this.historyRepo = new HistoryRepository(this.db);
  }

  create(callback: Omit<Types.PaymentCallback, 'id' | 'processed' | 'processedAt'>, source: Types.RecordSource, options: { batchId?: string; operator?: string } = {}): string | null {
    const existingStmt = this.db.prepare(`
      SELECT id FROM payment_callbacks WHERE external_order_id = ?
    `);
    existingStmt.bind([callback.externalOrderId]);
    const hasExisting = existingStmt.step();
    existingStmt.free();
    
    if (hasExisting) {
      return null;
    }

    const id = generateId();
    const stmt = this.db.prepare(`
      INSERT INTO payment_callbacks (
        id, external_order_id, arrears_group_id, plate_number, amount,
        payment_channel, payment_time, callback_time, source, processed, processed_at, batch_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      id,
      callback.externalOrderId,
      callback.arrearsGroupId || null,
      callback.plateNumber,
      callback.amount,
      callback.paymentChannel,
      dateToString(callback.paymentTime),
      dateToString(callback.callbackTime),
      source,
      0,
      null,
      options.batchId || null
    ]);
    stmt.free();
    this.historyRepo.record('payment_callback', id, 'create', source, {
      afterData: { ...callback, id },
      operator: options.operator,
      batchId: options.batchId
    });
    return id;
  }

  findByExternalOrder(externalOrderId: string): Types.PaymentCallback | null {
    const stmt = this.db.prepare(`
      SELECT * FROM payment_callbacks WHERE external_order_id = ?
    `);
    stmt.bind([externalOrderId]);
    const hasRow = stmt.step();
    const row = hasRow ? stmt.getAsObject() : null;
    stmt.free();
    if (!row) return null;
    return this.rowToCallback(row);
  }

  findUnprocessed(): Types.PaymentCallback[] {
    const stmt = this.db.prepare(`
      SELECT * FROM payment_callbacks WHERE processed = 0 ORDER BY callback_time ASC
    `);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows.map(this.rowToCallback);
  }

  markProcessed(id: string, arrearsGroupId?: string): void {
    const stmt = this.db.prepare(`
      UPDATE payment_callbacks 
      SET processed = 1, processed_at = ?, arrears_group_id = COALESCE(?, arrears_group_id)
      WHERE id = ?
    `);
    stmt.run([dateToString(new Date()), arrearsGroupId || null, id]);
    stmt.free();
  }

  private rowToCallback(row: any): Types.PaymentCallback {
    return {
      id: row.id,
      externalOrderId: row.external_order_id,
      arrearsGroupId: row.arrears_group_id,
      plateNumber: row.plate_number,
      amount: row.amount,
      paymentChannel: row.payment_channel,
      paymentTime: stringToDate(row.payment_time),
      callbackTime: stringToDate(row.callback_time),
      source: row.source,
      processed: row.processed === 1,
      processedAt: row.processed_at ? stringToDate(row.processed_at) : undefined,
      batchId: row.batch_id
    };
  }
}

export class BlacklistRepository {
  private db: DatabaseConnection;
  private historyRepo: HistoryRepository;

  constructor(dbConnection?: DatabaseConnection) {
    this.db = dbConnection || DatabaseConnection.getInstance();
    this.historyRepo = new HistoryRepository(this.db);
  }

  add(record: Omit<Types.BlacklistRecord, 'id'>, source: Types.RecordSource, options: { operator?: string } = {}): string {
    const id = generateId();
    const stmt = this.db.prepare(`
      INSERT INTO blacklist_records (
        id, plate_number, arrears_group_id, total_unpaid_amount, record_count,
        added_time, removed_time, status, source, sync_status, sync_message, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      id,
      record.plateNumber,
      record.arrearsGroupId,
      record.totalUnpaidAmount,
      record.recordCount,
      dateToString(record.addedTime),
      null,
      'active',
      source,
      record.syncStatus,
      record.syncMessage || null,
      record.syncedAt ? dateToString(record.syncedAt) : null
    ]);
    stmt.free();
    this.historyRepo.record('blacklist_record', id, 'create', source, {
      afterData: { ...record, id, status: 'active' },
      operator: options.operator
    });
    return id;
  }

  findByArrearsGroup(arrearsGroupId: string): Types.BlacklistRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM blacklist_records WHERE arrears_group_id = ?
    `);
    stmt.bind([arrearsGroupId]);
    const hasRow = stmt.step();
    const row = hasRow ? stmt.getAsObject() : null;
    stmt.free();
    if (!row) return null;
    return this.rowToRecord(row);
  }

  findActive(): Types.BlacklistRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM blacklist_records WHERE status = 'active' ORDER BY added_time DESC
    `);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows.map(this.rowToRecord);
  }

  remove(arrearsGroupId: string, source: Types.RecordSource, options: { reason?: string; operator?: string } = {}): void {
    const existing = this.findByArrearsGroup(arrearsGroupId);
    if (!existing) return;

    const stmt = this.db.prepare(`
      UPDATE blacklist_records 
      SET status = 'removed', removed_time = ? 
      WHERE arrears_group_id = ?
    `);
    stmt.run([dateToString(new Date()), arrearsGroupId]);
    stmt.free();

    this.historyRepo.record('blacklist_record', existing.id, 'update', source, {
      beforeData: existing,
      afterData: { ...existing, status: 'removed' },
      reason: options.reason,
      operator: options.operator
    });
  }

  updateSyncStatus(arrearsGroupId: string, syncStatus: 'synced' | 'pending' | 'failed', syncMessage?: string): void {
    const existing = this.findByArrearsGroup(arrearsGroupId);
    if (!existing) return;

    const stmt = this.db.prepare(`
      UPDATE blacklist_records 
      SET sync_status = ?, sync_message = ?, synced_at = ?
      WHERE arrears_group_id = ?
    `);
    stmt.run([syncStatus, syncMessage || null, dateToString(new Date()), arrearsGroupId]);
    stmt.free();
  }

  private rowToRecord(row: any): Types.BlacklistRecord {
    return {
      id: row.id,
      plateNumber: row.plate_number,
      arrearsGroupId: row.arrears_group_id,
      totalUnpaidAmount: row.total_unpaid_amount,
      recordCount: row.record_count,
      addedTime: stringToDate(row.added_time),
      removedTime: row.removed_time ? stringToDate(row.removed_time) : undefined,
      status: row.status,
      source: row.source,
      syncStatus: row.sync_status,
      syncMessage: row.sync_message,
      syncedAt: row.synced_at ? stringToDate(row.synced_at) : undefined
    };
  }
}

export class ReportRepository {
  private db: DatabaseConnection;

  constructor(dbConnection?: DatabaseConnection) {
    this.db = dbConnection || DatabaseConnection.getInstance();
  }

  create(report: Omit<Types.CollectionReport, 'id'>): string {
    const id = generateId();
    const stmt = this.db.prepare(`
      INSERT INTO collection_reports (
        id, report_date, generated_at, total_records, total_amount,
        collected_amount, pending_amount, blacklist_count, new_arrears_count, paid_count, summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      id,
      dateToString(report.reportDate),
      dateToString(report.generatedAt),
      report.totalRecords,
      report.totalAmount,
      report.collectedAmount,
      report.pendingAmount,
      report.blacklistCount,
      report.newArrearsCount,
      report.paidCount,
      report.summary
    ]);
    stmt.free();
    return id;
  }

  getLatest(): Types.CollectionReport | null {
    const stmt = this.db.prepare(`
      SELECT * FROM collection_reports ORDER BY generated_at DESC LIMIT 1
    `);
    const hasRow = stmt.step();
    const row = hasRow ? stmt.getAsObject() : null;
    stmt.free();
    if (!row) return null;
    return {
      id: row.id,
      reportDate: stringToDate(row.report_date),
      generatedAt: stringToDate(row.generated_at),
      totalRecords: row.total_records,
      totalAmount: row.total_amount,
      collectedAmount: row.collected_amount,
      pendingAmount: row.pending_amount,
      blacklistCount: row.blacklist_count,
      newArrearsCount: row.new_arrears_count,
      paidCount: row.paid_count,
      summary: row.summary
    };
  }
}

export class BatchRepository {
  private db: DatabaseConnection;

  constructor(dbConnection?: DatabaseConnection) {
    this.db = dbConnection || DatabaseConnection.getInstance();
  }

  create(batch: Omit<Types.BatchOperation, 'id' | 'status' | 'successCount' | 'failedCount' | 'startedAt'>): string {
    const id = generateId();
    const stmt = this.db.prepare(`
      INSERT INTO batch_operations (
        id, name, operation_type, status, total_count, success_count, failed_count,
        started_at, completed_at, result_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      id,
      batch.name,
      batch.operationType,
      'processing',
      batch.totalCount,
      0,
      0,
      dateToString(new Date()),
      null,
      null
    ]);
    stmt.free();
    return id;
  }

  updateProgress(id: string, successCount: number, failedCount: number): void {
    const stmt = this.db.prepare(`
      UPDATE batch_operations 
      SET success_count = ?, failed_count = ?
      WHERE id = ?
    `);
    stmt.run([successCount, failedCount, id]);
    stmt.free();
  }

  complete(id: string, summary: string): void {
    const stmt = this.db.prepare(`
      UPDATE batch_operations 
      SET status = 'completed', completed_at = ?, result_summary = ?
      WHERE id = ?
    `);
    stmt.run([dateToString(new Date()), summary, id]);
    stmt.free();
  }

  fail(id: string, error: string): void {
    const stmt = this.db.prepare(`
      UPDATE batch_operations 
      SET status = 'failed', completed_at = ?, result_summary = ?
      WHERE id = ?
    `);
    stmt.run([dateToString(new Date()), error, id]);
    stmt.free();
  }
}
