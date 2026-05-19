"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const quotaService_1 = require("./services/quotaService");
const queryService_1 = require("./services/queryService");
const router = express_1.default.Router();
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});
router.get('/dashboard/stats', async (req, res) => {
    try {
        const stats = await queryService_1.queryService.getDashboardStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: '获取统计数据失败' });
    }
});
router.get('/members', async (req, res) => {
    try {
        const members = await queryService_1.queryService.getMembers();
        res.json(members);
    }
    catch (error) {
        res.status(500).json({ error: '获取成员列表失败' });
    }
});
router.get('/projects', async (req, res) => {
    try {
        const memberId = req.query.member_id;
        const projects = await queryService_1.queryService.getProjects(memberId);
        res.json(projects);
    }
    catch (error) {
        res.status(500).json({ error: '获取项目列表失败' });
    }
});
router.get('/quota-packages', async (req, res) => {
    try {
        const memberId = req.query.member_id;
        const projectId = req.query.project_id;
        const packages = await queryService_1.queryService.getQuotaPackages(memberId, projectId);
        res.json(packages);
    }
    catch (error) {
        res.status(500).json({ error: '获取额度包列表失败' });
    }
});
router.get('/generation-requests', async (req, res) => {
    try {
        const filters = {
            member_id: req.query.member_id,
            project_id: req.query.project_id,
            status: req.query.status,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined,
            offset: req.query.offset ? parseInt(req.query.offset) : undefined
        };
        const requests = await queryService_1.queryService.getGenerationRequests(filters);
        res.json(requests);
    }
    catch (error) {
        res.status(500).json({ error: '获取请求列表失败' });
    }
});
router.get('/generation-requests/:id', async (req, res) => {
    try {
        const detail = await quotaService_1.quotaService.getRequestWithHistory(req.params.id);
        if (!detail) {
            return res.status(404).json({ error: '请求不存在' });
        }
        res.json(detail);
    }
    catch (error) {
        res.status(500).json({ error: '获取请求详情失败' });
    }
});
router.post('/generation-requests', async (req, res) => {
    try {
        const result = await quotaService_1.quotaService.createGenerationRequest(req.body);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        res.status(201).json(result.request);
    }
    catch (error) {
        res.status(500).json({ error: '创建请求失败' });
    }
});
router.post('/generation-requests/:id/complete', async (req, res) => {
    try {
        const result = await quotaService_1.quotaService.completeRequest(req.params.id);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        res.json(result.request);
    }
    catch (error) {
        res.status(500).json({ error: '完成请求失败' });
    }
});
router.post('/generation-requests/:id/fail', async (req, res) => {
    try {
        const result = await quotaService_1.quotaService.failRequest(req.params.id, req.body.error_message || '未知错误');
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: '标记失败失败' });
    }
});
router.get('/failure-credits', async (req, res) => {
    try {
        const filters = {
            member_id: req.query.member_id,
            status: req.query.status,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined
        };
        const credits = await queryService_1.queryService.getFailureCredits(filters);
        res.json(credits);
    }
    catch (error) {
        res.status(500).json({ error: '获取退费列表失败' });
    }
});
router.post('/failure-credits/:id/review', async (req, res) => {
    try {
        const result = await quotaService_1.quotaService.reviewCredit(req.params.id, req.body.status, req.body.reviewed_by, req.body.review_note);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        res.json(result.credit);
    }
    catch (error) {
        res.status(500).json({ error: '审核失败' });
    }
});
router.get('/monthly-summaries', async (req, res) => {
    try {
        const filters = {
            member_id: req.query.member_id,
            project_id: req.query.project_id,
            year: req.query.year ? parseInt(req.query.year) : undefined,
            month: req.query.month ? parseInt(req.query.month) : undefined
        };
        const summaries = await queryService_1.queryService.getMonthlySummaries(filters);
        res.json(summaries);
    }
    catch (error) {
        res.status(500).json({ error: '获取月度汇总失败' });
    }
});
router.get('/export/monthly-report', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const month = parseInt(req.query.month);
        const csv = await queryService_1.queryService.exportMonthlyReport(year, month);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="monthly-report-${year}-${month}.csv"`);
        res.send('\uFEFF' + csv);
    }
    catch (error) {
        res.status(500).json({ error: '导出失败' });
    }
});
router.get('/export/member-details', async (req, res) => {
    try {
        const memberId = req.query.member_id;
        const year = req.query.year ? parseInt(req.query.year) : undefined;
        const month = req.query.month ? parseInt(req.query.month) : undefined;
        const csv = await queryService_1.queryService.exportMemberDetails(memberId, year, month);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="member-${memberId}-details.csv"`);
        res.send('\uFEFF' + csv);
    }
    catch (error) {
        res.status(500).json({ error: '导出失败' });
    }
});
exports.default = router;
