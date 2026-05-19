"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryService = exports.QueryService = void 0;
const database_1 = require("../database");
const csv_writer_1 = require("csv-writer");
class QueryService {
    async getMembers() {
        const db = await (0, database_1.getDb)();
        return db.all('SELECT * FROM members ORDER BY created_at DESC');
    }
    async getProjects(memberId) {
        const db = await (0, database_1.getDb)();
        if (memberId) {
            return db.all('SELECT * FROM projects WHERE member_id = ? ORDER BY created_at DESC', [memberId]);
        }
        return db.all('SELECT * FROM projects ORDER BY created_at DESC');
    }
    async getQuotaPackages(memberId, projectId) {
        const db = await (0, database_1.getDb)();
        let query = 'SELECT * FROM quota_packages WHERE 1=1';
        const params = [];
        if (memberId) {
            query += ' AND member_id = ?';
            params.push(memberId);
        }
        if (projectId) {
            query += ' AND project_id = ?';
            params.push(projectId);
        }
        query += ' ORDER BY created_at DESC';
        return db.all(query, params);
    }
    async getGenerationRequests(filters) {
        const db = await (0, database_1.getDb)();
        let query = 'SELECT * FROM generation_requests WHERE 1=1';
        const params = [];
        if (filters?.member_id) {
            query += ' AND member_id = ?';
            params.push(filters.member_id);
        }
        if (filters?.project_id) {
            query += ' AND project_id = ?';
            params.push(filters.project_id);
        }
        if (filters?.status) {
            query += ' AND status = ?';
            params.push(filters.status);
        }
        query += ' ORDER BY created_at DESC';
        if (filters?.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }
        if (filters?.offset) {
            query += ' OFFSET ?';
            params.push(filters.offset);
        }
        return db.all(query, params);
    }
    async getFailureCredits(filters) {
        const db = await (0, database_1.getDb)();
        let query = 'SELECT * FROM failure_credits WHERE 1=1';
        const params = [];
        if (filters?.member_id) {
            query += ' AND member_id = ?';
            params.push(filters.member_id);
        }
        if (filters?.status) {
            query += ' AND status = ?';
            params.push(filters.status);
        }
        query += ' ORDER BY created_at DESC';
        if (filters?.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }
        return db.all(query, params);
    }
    async getMonthlySummaries(filters) {
        const db = await (0, database_1.getDb)();
        let query = 'SELECT * FROM monthly_summaries WHERE 1=1';
        const params = [];
        if (filters?.member_id) {
            query += ' AND member_id = ?';
            params.push(filters.member_id);
        }
        if (filters?.project_id) {
            query += ' AND project_id = ?';
            params.push(filters.project_id);
        }
        if (filters?.year) {
            query += ' AND year = ?';
            params.push(filters.year);
        }
        if (filters?.month) {
            query += ' AND month = ?';
            params.push(filters.month);
        }
        query += ' ORDER BY year DESC, month DESC';
        return db.all(query, params);
    }
    async getDashboardStats() {
        const db = await (0, database_1.getDb)();
        const [totalRequests, totalQuota, pendingCredits, activeMembers] = await Promise.all([
            db.get('SELECT COUNT(*) as count FROM generation_requests'),
            db.get('SELECT SUM(remaining_quota) as total FROM quota_packages WHERE status = "active"'),
            db.get('SELECT COUNT(*) as count FROM failure_credits WHERE status = "pending"'),
            db.get('SELECT COUNT(*) as count FROM members')
        ]);
        return {
            total_requests: totalRequests?.count || 0,
            total_remaining_quota: totalQuota?.total || 0,
            pending_credits: pendingCredits?.count || 0,
            active_members: activeMembers?.count || 0
        };
    }
    async exportMonthlyReport(year, month) {
        const db = await (0, database_1.getDb)();
        const summaries = await db.all(`SELECT 
        m.name as member_name,
        p.name as project_name,
        ms.total_requests,
        ms.successful_requests,
        ms.failed_requests,
        ms.quota_consumed,
        ms.quota_returned,
        ms.net_quota_used
       FROM monthly_summaries ms
       LEFT JOIN members m ON ms.member_id = m.id
       LEFT JOIN projects p ON ms.project_id = p.id
       WHERE ms.year = ? AND ms.month = ?
       ORDER BY ms.member_id, ms.project_id`, [year, month]);
        const csvStringifier = (0, csv_writer_1.createObjectCsvStringifier)({
            header: [
                { id: 'member_name', title: '成员' },
                { id: 'project_name', title: '项目' },
                { id: 'total_requests', title: '总请求数' },
                { id: 'successful_requests', title: '成功数' },
                { id: 'failed_requests', title: '失败数' },
                { id: 'quota_consumed', title: '消耗额度' },
                { id: 'quota_returned', title: '返还额度' },
                { id: 'net_quota_used', title: '净使用额度' }
            ]
        });
        const header = `月度使用报告 - ${year}年${month}月\n`;
        return header + csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(summaries);
    }
    async exportMemberDetails(memberId, year, month) {
        const db = await (0, database_1.getDb)();
        let query = `
      SELECT 
        r.id,
        r.prompt,
        r.quota_consumed,
        r.status,
        r.created_at,
        p.name as project_name,
        c.status as credit_status,
        c.quota_returned
      FROM generation_requests r
      LEFT JOIN projects p ON r.project_id = p.id
      LEFT JOIN failure_credits c ON r.id = c.request_id
      WHERE r.member_id = ?
    `;
        const params = [memberId];
        if (year && month) {
            const startDate = new Date(year, month - 1, 1).getTime();
            const endDate = new Date(year, month, 1).getTime();
            query += ' AND r.created_at >= ? AND r.created_at < ?';
            params.push(startDate, endDate);
        }
        query += ' ORDER BY r.created_at DESC';
        const records = await db.all(query, params);
        const csvStringifier = (0, csv_writer_1.createObjectCsvStringifier)({
            header: [
                { id: 'id', title: '请求ID' },
                { id: 'project_name', title: '项目' },
                { id: 'prompt', title: '提示词' },
                { id: 'quota_consumed', title: '消耗额度' },
                { id: 'status', title: '状态' },
                { id: 'credit_status', title: '退费状态' },
                { id: 'quota_returned', title: '返还额度' },
                { id: 'created_at', title: '创建时间' }
            ]
        });
        return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records.map(r => ({
            ...r,
            created_at: new Date(r.created_at).toLocaleString('zh-CN')
        })));
    }
}
exports.QueryService = QueryService;
exports.queryService = new QueryService();
