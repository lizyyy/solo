"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
class DatabaseService {
    constructor(db) {
        this.db = db;
    }
    runAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    getAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
    }
    allAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows);
            });
        });
    }
    async findByIdempotencyKey(key) {
        const row = await this.getAsync('SELECT * FROM recalculation_applications WHERE idempotency_key = ?', [key]);
        if (!row)
            return undefined;
        return this.mapToApplication(row);
    }
    async createApplication(request) {
        const now = new Date().toISOString();
        const id = (0, uuid_1.v4)();
        const totalOriginalAmount = request.impactDetails.reduce((sum, d) => sum + d.originalAmount, 0);
        const totalNewAmount = request.impactDetails.reduce((sum, d) => sum + d.newAmount, 0);
        const totalDifference = totalNewAmount - totalOriginalAmount;
        await this.runAsync(`INSERT INTO recalculation_applications (
        id, idempotency_key, billing_month, customer_account, customer_name,
        reason_category, reason_detail, trigger_source,
        total_original_amount, total_new_amount, total_difference,
        status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            id, request.idempotencyKey, request.billingMonth, request.customerAccount, request.customerName,
            request.reasonCategory, request.reasonDetail, request.triggerSource,
            totalOriginalAmount, totalNewAmount, totalDifference,
            types_1.RecalculationStatus.DRAFT, request.createdBy, now, now
        ]);
        for (const detail of request.impactDetails) {
            const detailId = (0, uuid_1.v4)();
            const difference = detail.newAmount - detail.originalAmount;
            await this.runAsync(`INSERT INTO impact_details (
          id, application_id, item_code, item_name, original_amount, new_amount, difference, remarks, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [detailId, id, detail.itemCode, detail.itemName, detail.originalAmount, detail.newAmount, difference, detail.remarks, now]);
        }
        await this.createSnapshot(id, 'ORIGINAL_INPUT', JSON.stringify(request));
        return this.getApplicationById(id);
    }
    async createSnapshot(applicationId, snapshotType, data) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        await this.runAsync('INSERT INTO recalculation_snapshots (id, application_id, snapshot_type, data, created_at) VALUES (?, ?, ?, ?, ?)', [id, applicationId, snapshotType, data, now]);
    }
    async getApplicationById(id) {
        const row = await this.getAsync('SELECT * FROM recalculation_applications WHERE id = ?', [id]);
        if (!row)
            return undefined;
        return this.mapToApplication(row);
    }
    async getApplications(filters, limit = 100, offset = 0) {
        let sql = 'SELECT * FROM recalculation_applications WHERE 1=1';
        const params = [];
        if (filters?.billingMonth) {
            sql += ' AND billing_month = ?';
            params.push(filters.billingMonth);
        }
        if (filters?.customerAccount) {
            sql += ' AND customer_account = ?';
            params.push(filters.customerAccount);
        }
        if (filters?.status) {
            sql += ' AND status = ?';
            params.push(filters.status);
        }
        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const rows = await this.allAsync(sql, params);
        return Promise.all(rows.map(row => this.mapToApplication(row)));
    }
    async updateStatus(applicationId, request) {
        const now = new Date().toISOString();
        await this.runAsync('UPDATE recalculation_applications SET status = ?, current_approver = ?, updated_at = ? WHERE id = ?', [request.status, request.approver, now, applicationId]);
        const historyId = (0, uuid_1.v4)();
        await this.runAsync(`INSERT INTO approval_history (
        id, application_id, status, approver, approver_role, opinion, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [historyId, applicationId, request.status, request.approver, request.approverRole, request.opinion, now]);
    }
    async getApprovalHistory(applicationId) {
        return this.allAsync('SELECT * FROM approval_history WHERE application_id = ? ORDER BY created_at DESC', [applicationId]);
    }
    async getSnapshots(applicationId) {
        return this.allAsync('SELECT * FROM recalculation_snapshots WHERE application_id = ? ORDER BY created_at DESC', [applicationId]);
    }
    async markAsFailed(applicationId, failureReason, processingBasis, finalConclusion) {
        const now = new Date().toISOString();
        await this.runAsync(`UPDATE recalculation_applications 
       SET status = ?, failure_reason = ?, processing_basis = ?, final_conclusion = ?, updated_at = ? 
       WHERE id = ?`, [types_1.RecalculationStatus.FAILED, failureReason, processingBasis, finalConclusion, now, applicationId]);
        await this.createSnapshot(applicationId, 'FAILED_PROCESSING', JSON.stringify({ failureReason, processingBasis, finalConclusion, failedAt: now }));
    }
    async applyManualCorrection(applicationId, request) {
        const now = new Date().toISOString();
        const appRow = await this.getAsync('SELECT total_original_amount FROM recalculation_applications WHERE id = ?', [applicationId]);
        const totalOriginalAmount = appRow?.total_original_amount ?? 0;
        const totalDifference = request.totalNewAmount - totalOriginalAmount;
        await this.runAsync(`UPDATE recalculation_applications 
       SET total_new_amount = ?, total_difference = ?, status = ?, updated_at = ? 
       WHERE id = ?`, [request.totalNewAmount, totalDifference, types_1.RecalculationStatus.PENDING_APPROVAL, now, applicationId]);
        await this.runAsync('DELETE FROM impact_details WHERE application_id = ?', [applicationId]);
        for (const detail of request.impactDetails) {
            const detailId = (0, uuid_1.v4)();
            const difference = detail.newAmount - detail.originalAmount;
            await this.runAsync(`INSERT INTO impact_details (
          id, application_id, item_code, item_name, original_amount, new_amount, difference, remarks, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [detailId, applicationId, detail.itemCode, detail.itemName, detail.originalAmount, detail.newAmount, difference, detail.remarks, now]);
        }
        await this.createSnapshot(applicationId, 'PROCESSING_RESULT', JSON.stringify(request));
    }
    async completeApplication(applicationId, finalConclusion, reportUrl) {
        const now = new Date().toISOString();
        await this.runAsync(`UPDATE recalculation_applications 
       SET status = ?, final_conclusion = ?, report_url = ?, updated_at = ? 
       WHERE id = ?`, [types_1.RecalculationStatus.COMPLETED, finalConclusion, reportUrl, now, applicationId]);
        await this.createSnapshot(applicationId, 'FINAL_CONCLUSION', JSON.stringify({ finalConclusion, reportUrl }));
    }
    async getAllApplicationsForExport(filters) {
        let sql = 'SELECT * FROM recalculation_applications WHERE 1=1';
        const params = [];
        if (filters?.billingMonth) {
            sql += ' AND billing_month = ?';
            params.push(filters.billingMonth);
        }
        if (filters?.status) {
            sql += ' AND status = ?';
            params.push(filters.status);
        }
        sql += ' ORDER BY created_at DESC';
        const rows = await this.allAsync(sql, params);
        return Promise.all(rows.map(row => this.mapToApplication(row)));
    }
    mapToImpactDetail(row) {
        return {
            id: row.id,
            itemCode: row.item_code,
            itemName: row.item_name,
            originalAmount: row.original_amount,
            newAmount: row.new_amount,
            difference: row.difference,
            remarks: row.remarks
        };
    }
    async mapToApplication(row) {
        const impactDetailRows = await this.allAsync('SELECT * FROM impact_details WHERE application_id = ?', [row.id]);
        const impactDetails = impactDetailRows.map(r => this.mapToImpactDetail(r));
        return {
            id: row.id,
            idempotencyKey: row.idempotency_key,
            billingMonth: row.billing_month,
            customerAccount: row.customer_account,
            customerName: row.customer_name,
            reasonCategory: row.reason_category,
            reasonDetail: row.reason_detail,
            triggerSource: row.trigger_source,
            totalOriginalAmount: row.total_original_amount,
            totalNewAmount: row.total_new_amount,
            totalDifference: row.total_difference,
            impactDetails,
            status: row.status,
            currentApprover: row.current_approver,
            failureReason: row.failure_reason,
            processingBasis: row.processing_basis,
            finalConclusion: row.final_conclusion,
            reportUrl: row.report_url,
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}
exports.DatabaseService = DatabaseService;
