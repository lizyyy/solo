"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchRepository = exports.ReportRepository = exports.BlacklistRepository = exports.PaymentCallbackRepository = exports.CollectionRecordRepository = exports.ArrearsGroupRepository = exports.ParkingRecordRepository = exports.HistoryRepository = void 0;
const database_1 = require("./database");
const utils_1 = require("./utils");
class HistoryRepository {
    constructor(dbConnection) {
        this.db = dbConnection || database_1.DatabaseConnection.getInstance();
    }
    record(entityType, entityId, operationType, source, options = {}) {
        const id = (0, utils_1.generateId)();
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
            (0, utils_1.dateToString)(new Date())
        ]);
        stmt.free();
        return id;
    }
    getHistory(entityType, entityId) {
        const stmt = this.db.prepare(`
      SELECT * FROM operation_history 
      WHERE entity_type = ? AND entity_id = ? 
      ORDER BY created_at DESC
    `);
        stmt.bind([entityType, entityId]);
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows.map(this.rowToHistory);
    }
    rowToHistory(row) {
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
            createdAt: (0, utils_1.stringToDate)(row.created_at)
        };
    }
}
exports.HistoryRepository = HistoryRepository;
class ParkingRecordRepository {
    constructor(dbConnection) {
        this.db = dbConnection || database_1.DatabaseConnection.getInstance();
        this.historyRepo = new HistoryRepository(this.db);
    }
    create(record, source, options = {}) {
        const id = (0, utils_1.generateId)();
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
            (0, utils_1.dateToString)(record.entryTime),
            (0, utils_1.dateToString)(record.exitTime),
            record.durationMinutes,
            record.totalAmount,
            record.paidAmount,
            record.unpaidAmount,
            record.paymentStatus,
            record.paymentChannel || null,
            record.isRecognizedPlate ? 1 : 0,
            source,
            options.batchId || null,
            record.importedAt ? (0, utils_1.dateToString)(record.importedAt) : null,
            (0, utils_1.dateToString)(now)
        ]);
        stmt.free();
        this.historyRepo.record('parking_record', id, 'create', source, {
            afterData: { ...record, id },
            operator: options.operator,
            batchId: options.batchId
        });
        return id;
    }
    findById(id) {
        const stmt = this.db.prepare(`
      SELECT * FROM parking_records WHERE id = ?
    `);
        stmt.bind([id]);
        const hasRow = stmt.step();
        const row = hasRow ? stmt.getAsObject() : null;
        stmt.free();
        if (!row)
            return null;
        return this.rowToRecord(row);
    }
    findByPlate(plateNumber) {
        const stmt = this.db.prepare(`
      SELECT * FROM parking_records WHERE plate_number = ? ORDER BY exit_time DESC
    `);
        stmt.bind([plateNumber]);
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows.map(this.rowToRecord);
    }
    findByBatch(batchId) {
        const stmt = this.db.prepare(`
      SELECT * FROM parking_records WHERE batch_id = ?
    `);
        stmt.bind([batchId]);
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows.map(this.rowToRecord);
    }
    findUnpaid() {
        const stmt = this.db.prepare(`
      SELECT * FROM parking_records 
      WHERE payment_status IN ('unpaid', 'partial') 
      ORDER BY exit_time ASC
    `);
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows.map(this.rowToRecord);
    }
    updatePayment(id, paidAmount, operator) {
        const existing = this.findById(id);
        if (!existing)
            return;
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
    rowToRecord(row) {
        return {
            id: row.id,
            plateNumber: row.plate_number,
            parkingLotId: row.parking_lot_id,
            parkingLotName: row.parking_lot_name,
            berthId: row.berth_id,
            berthNumber: row.berth_number,
            entryTime: (0, utils_1.stringToDate)(row.entry_time),
            exitTime: (0, utils_1.stringToDate)(row.exit_time),
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
            importedAt: row.imported_at ? (0, utils_1.stringToDate)(row.imported_at) : undefined,
            createdAt: (0, utils_1.stringToDate)(row.created_at)
        };
    }
}
exports.ParkingRecordRepository = ParkingRecordRepository;
class ArrearsGroupRepository {
    constructor(dbConnection) {
        this.db = dbConnection || database_1.DatabaseConnection.getInstance();
        this.historyRepo = new HistoryRepository(this.db);
    }
    create(group, source, options = {}) {
        const id = (0, utils_1.generateId)();
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
            (0, utils_1.dateToString)(group.latestParkingTime),
            (0, utils_1.dateToString)(group.firstUnpaidTime),
            JSON.stringify(group.mergedRecordIds),
            options.batchId || null,
            group.lastCollectionTime ? (0, utils_1.dateToString)(group.lastCollectionTime) : null,
            group.collectionCount,
            (0, utils_1.dateToString)(now),
            (0, utils_1.dateToString)(now)
        ]);
        stmt.free();
        this.historyRepo.record('arrears_group', id, 'create', source, {
            afterData: { ...group, id },
            operator: options.operator,
            batchId: options.batchId
        });
        return id;
    }
    findById(id) {
        const stmt = this.db.prepare(`
      SELECT * FROM arrears_groups WHERE id = ?
    `);
        stmt.bind([id]);
        const hasRow = stmt.step();
        const row = hasRow ? stmt.getAsObject() : null;
        stmt.free();
        if (!row)
            return null;
        return this.rowToGroup(row);
    }
    findByPlate(plate) {
        const normalized = (0, utils_1.normalizePlate)(plate);
        const stmt = this.db.prepare(`
      SELECT * FROM arrears_groups 
      WHERE normalized_plate = ? AND status NOT IN ('withdrawn')
      ORDER BY created_at DESC
    `);
        stmt.bind([normalized]);
        const hasRow = stmt.step();
        const row = hasRow ? stmt.getAsObject() : null;
        stmt.free();
        if (!row)
            return null;
        return this.rowToGroup(row);
    }
    findByStatus(status) {
        const stmt = this.db.prepare(`
      SELECT * FROM arrears_groups WHERE status = ? ORDER BY total_unpaid_amount DESC
    `);
        stmt.bind([status]);
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows.map(this.rowToGroup);
    }
    update(id, updates, source, options = {}) {
        const existing = this.findById(id);
        if (!existing)
            return;
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
            updates.latestParkingTime ? (0, utils_1.dateToString)(updates.latestParkingTime) : null,
            updates.firstUnpaidTime ? (0, utils_1.dateToString)(updates.firstUnpaidTime) : null,
            updates.mergedRecordIds ? JSON.stringify(updates.mergedRecordIds) : null,
            updates.lastCollectionTime ? (0, utils_1.dateToString)(updates.lastCollectionTime) : null,
            updates.collectionCount ?? null,
            (0, utils_1.dateToString)(new Date()),
            id
        ]);
        stmt.free();
        const updated = this.findById(id);
        this.historyRepo.record('arrears_group', id, 'update', source, {
            beforeData: existing,
            afterData: updated,
            reason: options.reason,
            operator: options.operator,
            batchId: options.batchId
        });
    }
    withdraw(id, reason, operator) {
        this.update(id, { status: 'withdrawn' }, 'system', {
            reason,
            operator
        });
        this.historyRepo.record('arrears_group', id, 'withdraw', 'system', {
            reason,
            operator
        });
    }
    rowToGroup(row) {
        return {
            id: row.id,
            plateNumber: row.plate_number,
            normalizedPlate: row.normalized_plate,
            totalUnpaidAmount: row.total_unpaid_amount,
            recordCount: row.record_count,
            status: row.status,
            latestParkingTime: (0, utils_1.stringToDate)(row.latest_parking_time),
            firstUnpaidTime: (0, utils_1.stringToDate)(row.first_unpaid_time),
            mergedRecordIds: JSON.parse(row.merged_record_ids),
            batchId: row.batch_id,
            lastCollectionTime: row.last_collection_time ? (0, utils_1.stringToDate)(row.last_collection_time) : undefined,
            collectionCount: row.collection_count,
            createdAt: (0, utils_1.stringToDate)(row.created_at),
            updatedAt: (0, utils_1.stringToDate)(row.updated_at)
        };
    }
}
exports.ArrearsGroupRepository = ArrearsGroupRepository;
class CollectionRecordRepository {
    constructor(dbConnection) {
        this.db = dbConnection || database_1.DatabaseConnection.getInstance();
    }
    create(record, options = {}) {
        const id = (0, utils_1.generateId)();
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
            (0, utils_1.dateToString)(record.triggeredAt),
            record.completedAt ? (0, utils_1.dateToString)(record.completedAt) : null
        ]);
        stmt.free();
        return id;
    }
    findByArrearsGroup(arrearsGroupId) {
        const stmt = this.db.prepare(`
      SELECT * FROM collection_records WHERE arrears_group_id = ? ORDER BY triggered_at DESC
    `);
        stmt.bind([arrearsGroupId]);
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows.map(this.rowToRecord);
    }
    rowToRecord(row) {
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
            triggeredAt: (0, utils_1.stringToDate)(row.triggered_at),
            completedAt: row.completed_at ? (0, utils_1.stringToDate)(row.completed_at) : undefined
        };
    }
}
exports.CollectionRecordRepository = CollectionRecordRepository;
class PaymentCallbackRepository {
    constructor(dbConnection) {
        this.db = dbConnection || database_1.DatabaseConnection.getInstance();
        this.historyRepo = new HistoryRepository(this.db);
    }
    create(callback, source, options = {}) {
        const existingStmt = this.db.prepare(`
      SELECT id FROM payment_callbacks WHERE external_order_id = ?
    `);
        existingStmt.bind([callback.externalOrderId]);
        const hasExisting = existingStmt.step();
        existingStmt.free();
        if (hasExisting) {
            return null;
        }
        const id = (0, utils_1.generateId)();
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
            (0, utils_1.dateToString)(callback.paymentTime),
            (0, utils_1.dateToString)(callback.callbackTime),
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
    findByExternalOrder(externalOrderId) {
        const stmt = this.db.prepare(`
      SELECT * FROM payment_callbacks WHERE external_order_id = ?
    `);
        stmt.bind([externalOrderId]);
        const hasRow = stmt.step();
        const row = hasRow ? stmt.getAsObject() : null;
        stmt.free();
        if (!row)
            return null;
        return this.rowToCallback(row);
    }
    findUnprocessed() {
        const stmt = this.db.prepare(`
      SELECT * FROM payment_callbacks WHERE processed = 0 ORDER BY callback_time ASC
    `);
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows.map(this.rowToCallback);
    }
    markProcessed(id, arrearsGroupId) {
        const stmt = this.db.prepare(`
      UPDATE payment_callbacks 
      SET processed = 1, processed_at = ?, arrears_group_id = COALESCE(?, arrears_group_id)
      WHERE id = ?
    `);
        stmt.run([(0, utils_1.dateToString)(new Date()), arrearsGroupId || null, id]);
        stmt.free();
    }
    rowToCallback(row) {
        return {
            id: row.id,
            externalOrderId: row.external_order_id,
            arrearsGroupId: row.arrears_group_id,
            plateNumber: row.plate_number,
            amount: row.amount,
            paymentChannel: row.payment_channel,
            paymentTime: (0, utils_1.stringToDate)(row.payment_time),
            callbackTime: (0, utils_1.stringToDate)(row.callback_time),
            source: row.source,
            processed: row.processed === 1,
            processedAt: row.processed_at ? (0, utils_1.stringToDate)(row.processed_at) : undefined,
            batchId: row.batch_id
        };
    }
}
exports.PaymentCallbackRepository = PaymentCallbackRepository;
class BlacklistRepository {
    constructor(dbConnection) {
        this.db = dbConnection || database_1.DatabaseConnection.getInstance();
        this.historyRepo = new HistoryRepository(this.db);
    }
    add(record, source, options = {}) {
        const id = (0, utils_1.generateId)();
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
            (0, utils_1.dateToString)(record.addedTime),
            null,
            'active',
            source,
            record.syncStatus,
            record.syncMessage || null,
            record.syncedAt ? (0, utils_1.dateToString)(record.syncedAt) : null
        ]);
        stmt.free();
        this.historyRepo.record('blacklist_record', id, 'create', source, {
            afterData: { ...record, id, status: 'active' },
            operator: options.operator
        });
        return id;
    }
    findByArrearsGroup(arrearsGroupId) {
        const stmt = this.db.prepare(`
      SELECT * FROM blacklist_records WHERE arrears_group_id = ?
    `);
        stmt.bind([arrearsGroupId]);
        const hasRow = stmt.step();
        const row = hasRow ? stmt.getAsObject() : null;
        stmt.free();
        if (!row)
            return null;
        return this.rowToRecord(row);
    }
    findActive() {
        const stmt = this.db.prepare(`
      SELECT * FROM blacklist_records WHERE status = 'active' ORDER BY added_time DESC
    `);
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows.map(this.rowToRecord);
    }
    remove(arrearsGroupId, source, options = {}) {
        const existing = this.findByArrearsGroup(arrearsGroupId);
        if (!existing)
            return;
        const stmt = this.db.prepare(`
      UPDATE blacklist_records 
      SET status = 'removed', removed_time = ? 
      WHERE arrears_group_id = ?
    `);
        stmt.run([(0, utils_1.dateToString)(new Date()), arrearsGroupId]);
        stmt.free();
        this.historyRepo.record('blacklist_record', existing.id, 'update', source, {
            beforeData: existing,
            afterData: { ...existing, status: 'removed' },
            reason: options.reason,
            operator: options.operator
        });
    }
    updateSyncStatus(arrearsGroupId, syncStatus, syncMessage) {
        const existing = this.findByArrearsGroup(arrearsGroupId);
        if (!existing)
            return;
        const stmt = this.db.prepare(`
      UPDATE blacklist_records 
      SET sync_status = ?, sync_message = ?, synced_at = ?
      WHERE arrears_group_id = ?
    `);
        stmt.run([syncStatus, syncMessage || null, (0, utils_1.dateToString)(new Date()), arrearsGroupId]);
        stmt.free();
    }
    rowToRecord(row) {
        return {
            id: row.id,
            plateNumber: row.plate_number,
            arrearsGroupId: row.arrears_group_id,
            totalUnpaidAmount: row.total_unpaid_amount,
            recordCount: row.record_count,
            addedTime: (0, utils_1.stringToDate)(row.added_time),
            removedTime: row.removed_time ? (0, utils_1.stringToDate)(row.removed_time) : undefined,
            status: row.status,
            source: row.source,
            syncStatus: row.sync_status,
            syncMessage: row.sync_message,
            syncedAt: row.synced_at ? (0, utils_1.stringToDate)(row.synced_at) : undefined
        };
    }
}
exports.BlacklistRepository = BlacklistRepository;
class ReportRepository {
    constructor(dbConnection) {
        this.db = dbConnection || database_1.DatabaseConnection.getInstance();
    }
    create(report) {
        const id = (0, utils_1.generateId)();
        const stmt = this.db.prepare(`
      INSERT INTO collection_reports (
        id, report_date, generated_at, total_records, total_amount,
        collected_amount, pending_amount, blacklist_count, new_arrears_count, paid_count, summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run([
            id,
            (0, utils_1.dateToString)(report.reportDate),
            (0, utils_1.dateToString)(report.generatedAt),
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
    getLatest() {
        const stmt = this.db.prepare(`
      SELECT * FROM collection_reports ORDER BY generated_at DESC LIMIT 1
    `);
        const hasRow = stmt.step();
        const row = hasRow ? stmt.getAsObject() : null;
        stmt.free();
        if (!row)
            return null;
        return {
            id: row.id,
            reportDate: (0, utils_1.stringToDate)(row.report_date),
            generatedAt: (0, utils_1.stringToDate)(row.generated_at),
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
exports.ReportRepository = ReportRepository;
class BatchRepository {
    constructor(dbConnection) {
        this.db = dbConnection || database_1.DatabaseConnection.getInstance();
    }
    create(batch) {
        const id = (0, utils_1.generateId)();
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
            (0, utils_1.dateToString)(new Date()),
            null,
            null
        ]);
        stmt.free();
        return id;
    }
    updateProgress(id, successCount, failedCount) {
        const stmt = this.db.prepare(`
      UPDATE batch_operations 
      SET success_count = ?, failed_count = ?
      WHERE id = ?
    `);
        stmt.run([successCount, failedCount, id]);
        stmt.free();
    }
    complete(id, summary) {
        const stmt = this.db.prepare(`
      UPDATE batch_operations 
      SET status = 'completed', completed_at = ?, result_summary = ?
      WHERE id = ?
    `);
        stmt.run([(0, utils_1.dateToString)(new Date()), summary, id]);
        stmt.free();
    }
    fail(id, error) {
        const stmt = this.db.prepare(`
      UPDATE batch_operations 
      SET status = 'failed', completed_at = ?, result_summary = ?
      WHERE id = ?
    `);
        stmt.run([(0, utils_1.dateToString)(new Date()), error, id]);
        stmt.free();
    }
}
exports.BatchRepository = BatchRepository;
//# sourceMappingURL=repositories.js.map