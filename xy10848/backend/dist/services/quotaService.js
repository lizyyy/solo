"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quotaService = exports.QuotaService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
class QuotaService {
    async findAvailablePackage(memberId, projectId, quotaNeeded) {
        const db = await (0, database_1.getDb)();
        const now = Date.now();
        const pkg = await db.get(`SELECT * FROM quota_packages 
       WHERE member_id = ? 
         AND (project_id IS NULL OR project_id = ?)
         AND status = 'active'
         AND remaining_quota >= ?
         AND valid_from <= ?
         AND valid_to >= ?
       ORDER BY valid_to ASC, remaining_quota ASC
       LIMIT 1`, [memberId, projectId, quotaNeeded, now, now]);
        return pkg || null;
    }
    async getRequestByIdempotencyKey(key) {
        const db = await (0, database_1.getDb)();
        const request = await db.get('SELECT * FROM generation_requests WHERE idempotency_key = ?', [key]);
        return request || null;
    }
    async createGenerationRequest(data) {
        const db = await (0, database_1.getDb)();
        const existingRequest = await this.getRequestByIdempotencyKey(data.idempotency_key);
        if (existingRequest) {
            return { success: true, request: existingRequest };
        }
        if (typeof data.quota_amount !== 'number' || data.quota_amount <= 0) {
            return { success: false, error: 'quota_amount 必须为正整数' };
        }
        const project = await db.get('SELECT * FROM projects WHERE id = ? AND member_id = ?', [data.project_id, data.member_id]);
        if (!project) {
            return { success: false, error: '项目不属于该成员，或项目不存在' };
        }
        const member = await db.get('SELECT * FROM members WHERE id = ?', [data.member_id]);
        if (!member) {
            return { success: false, error: '成员不存在' };
        }
        const pkg = await this.findAvailablePackage(data.member_id, data.project_id, data.quota_amount);
        if (!pkg) {
            return { success: false, error: '可用额度不足或无有效额度包' };
        }
        const now = Date.now();
        const requestId = (0, uuid_1.v4)();
        try {
            await db.run('BEGIN TRANSACTION');
            const newRemaining = pkg.remaining_quota - data.quota_amount;
            const newStatus = newRemaining <= 0 ? 'depleted' : 'active';
            await db.run(`UPDATE quota_packages 
         SET remaining_quota = ?, status = ?, updated_at = ?
         WHERE id = ?`, [newRemaining, newStatus, now, pkg.id]);
            await db.run(`INSERT INTO generation_requests (
          id, idempotency_key, member_id, project_id, quota_package_id,
          quota_consumed, prompt, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                requestId, data.idempotency_key, data.member_id, data.project_id, pkg.id,
                data.quota_amount, data.prompt, 'processing', now, now
            ]);
            await this.updateMonthlySummary(db, data.member_id, data.project_id, {
                total_requests: 1,
                quota_consumed: data.quota_amount,
                net_quota_used: data.quota_amount
            });
            await db.run('COMMIT');
            const request = await db.get('SELECT * FROM generation_requests WHERE id = ?', [requestId]);
            return { success: true, request: request };
        }
        catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    }
    async completeRequest(requestId) {
        const db = await (0, database_1.getDb)();
        const now = Date.now();
        const request = await db.get('SELECT * FROM generation_requests WHERE id = ?', [requestId]);
        if (!request) {
            return { success: false, error: '请求不存在' };
        }
        if (request.status !== 'processing') {
            return { success: true, request };
        }
        await db.run(`UPDATE generation_requests 
       SET status = 'completed', completed_at = ?, updated_at = ?
       WHERE id = ?`, [now, now, requestId]);
        await this.updateMonthlySummary(db, request.member_id, request.project_id, {
            successful_requests: 1
        });
        const updatedRequest = await db.get('SELECT * FROM generation_requests WHERE id = ?', [requestId]);
        return { success: true, request: updatedRequest };
    }
    async failRequest(requestId, errorMessage) {
        const db = await (0, database_1.getDb)();
        const now = Date.now();
        const request = await db.get('SELECT * FROM generation_requests WHERE id = ?', [requestId]);
        if (!request) {
            return { success: false, error: '请求不存在' };
        }
        if (request.status !== 'processing') {
            return { success: false, error: `当前状态 ${request.status} 不能标记为失败，仅 processing 状态允许` };
        }
        try {
            await db.run('BEGIN TRANSACTION');
            await db.run(`UPDATE generation_requests 
         SET status = 'failed', error_message = ?, updated_at = ?
         WHERE id = ?`, [errorMessage, now, requestId]);
            const creditId = (0, uuid_1.v4)();
            await db.run(`INSERT INTO failure_credits (
          id, request_id, member_id, quota_package_id, quota_returned,
          reason, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                creditId, requestId, request.member_id, request.quota_package_id,
                request.quota_consumed, errorMessage, 'pending', now
            ]);
            await this.updateMonthlySummary(db, request.member_id, request.project_id, {
                failed_requests: 1
            });
            await db.run('COMMIT');
            const updatedRequest = await db.get('SELECT * FROM generation_requests WHERE id = ?', [requestId]);
            const credit = await db.get('SELECT * FROM failure_credits WHERE id = ?', [creditId]);
            return { success: true, request: updatedRequest, credit: credit };
        }
        catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    }
    async reviewCredit(creditId, status, reviewedBy, reviewNote) {
        const db = await (0, database_1.getDb)();
        const now = Date.now();
        const credit = await db.get('SELECT * FROM failure_credits WHERE id = ?', [creditId]);
        if (!credit) {
            return { success: false, error: '退费记录不存在' };
        }
        if (credit.status !== 'pending') {
            return { success: false, error: `当前状态 ${credit.status} 不能审核，仅 pending 状态允许` };
        }
        const request = await db.get('SELECT * FROM generation_requests WHERE id = ?', [credit.request_id]);
        if (!request) {
            return { success: false, error: '关联的生成请求不存在' };
        }
        try {
            await db.run('BEGIN TRANSACTION');
            await db.run(`UPDATE failure_credits 
         SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = ?
         WHERE id = ?`, [status, reviewedBy, reviewNote || null, now, creditId]);
            if (status === 'approved') {
                await db.run(`UPDATE quota_packages 
           SET remaining_quota = remaining_quota + ?, status = 'active', updated_at = ?
           WHERE id = ?`, [credit.quota_returned, now, credit.quota_package_id]);
                await db.run(`UPDATE generation_requests 
           SET status = 'refunded', updated_at = ?
           WHERE id = ?`, [now, credit.request_id]);
                await this.updateMonthlySummary(db, credit.member_id, request.project_id, {
                    quota_returned: credit.quota_returned,
                    net_quota_used: -credit.quota_returned
                });
            }
            await db.run('COMMIT');
            const updatedCredit = await db.get('SELECT * FROM failure_credits WHERE id = ?', [creditId]);
            return { success: true, credit: updatedCredit };
        }
        catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    }
    async updateMonthlySummary(db, memberId, projectId, increments) {
        const now = Date.now();
        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const existing = await db.get(`SELECT id FROM monthly_summaries 
       WHERE member_id = ? AND (project_id = ? OR (project_id IS NULL AND ? IS NULL)) 
         AND year = ? AND month = ?`, [memberId, projectId, projectId, year, month]);
        if (existing) {
            const updates = [];
            const params = [];
            for (const [key, value] of Object.entries(increments)) {
                if (value !== undefined) {
                    updates.push(`${key} = ${key} + ?`);
                    params.push(value);
                }
            }
            updates.push('updated_at = ?');
            params.push(now, existing.id);
            await db.run(`UPDATE monthly_summaries SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        else {
            await db.run(`INSERT INTO monthly_summaries (
          id, member_id, project_id, year, month,
          total_requests, successful_requests, failed_requests,
          quota_consumed, quota_returned, net_quota_used,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                (0, uuid_1.v4)(), memberId, projectId || null, year, month,
                increments.total_requests || 0,
                increments.successful_requests || 0,
                increments.failed_requests || 0,
                increments.quota_consumed || 0,
                increments.quota_returned || 0,
                increments.net_quota_used || 0,
                now, now
            ]);
        }
    }
    async getRequestWithHistory(requestId) {
        const db = await (0, database_1.getDb)();
        const request = await db.get('SELECT * FROM generation_requests WHERE id = ?', [requestId]);
        if (!request)
            return null;
        const credit = await db.get('SELECT * FROM failure_credits WHERE request_id = ?', [requestId]);
        const pkg = await db.get('SELECT * FROM quota_packages WHERE id = ?', [request.quota_package_id]);
        return {
            request,
            credit,
            quota_package: pkg
        };
    }
}
exports.QuotaService = QuotaService;
exports.quotaService = new QuotaService();
