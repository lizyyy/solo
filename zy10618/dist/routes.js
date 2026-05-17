"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const csv_writer_1 = require("csv-writer");
const store_1 = require("./store");
const services_1 = require("./services");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const router = express_1.default.Router();
router.get('/health', (req, res) => {
    res.json({ status: 'ok', message: '广告投放预算超投止损系统运行中' });
});
router.get('/advertisers', (req, res) => {
    const advertisers = store_1.store.getAllAdvertisers();
    res.json({ success: true, data: advertisers });
});
router.get('/plans', (req, res) => {
    const { advertiserId, status } = req.query;
    let plans = store_1.store.getAllAdPlans();
    if (advertiserId) {
        plans = plans.filter(p => p.advertiserId === advertiserId);
    }
    if (status) {
        plans = plans.filter(p => p.status === status);
    }
    plans.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    res.json({ success: true, data: plans });
});
router.get('/plans/:id', (req, res) => {
    const details = services_1.budgetService.getPlanWithDetails(req.params.id);
    if (!details) {
        return res.status(404).json({ success: false, message: '计划不存在' });
    }
    res.json({ success: true, data: details });
});
router.get('/plans/:id/history', (req, res) => {
    const plan = store_1.store.getAdPlan(req.params.id);
    if (!plan) {
        return res.status(404).json({ success: false, message: '计划不存在' });
    }
    const spendCallbacks = store_1.store.getSpendCallbacksByPlan(req.params.id);
    const reviewRecords = store_1.store.getReviewRecordsByPlan(req.params.id);
    const history = [
        ...spendCallbacks.map(c => ({
            type: '消耗回传',
            time: c.callbackTime,
            content: `回传消耗: ${c.spendAmount}元`,
            details: c
        })),
        ...reviewRecords.map(r => ({
            type: r.flowType,
            time: r.createdAt,
            content: `${r.reviewResult} - ${r.reason}`,
            details: r
        }))
    ].sort((a, b) => b.time.getTime() - a.time.getTime());
    res.json({ success: true, data: history });
});
router.post('/plans/:id/trigger-stop-loss', (req, res) => {
    try {
        const { operatorId, operatorName } = req.body;
        if (!operatorId || !operatorName) {
            return res.status(400).json({
                success: false,
                message: '缺少操作员信息'
            });
        }
        const plan = services_1.budgetService.triggerStopLoss(req.params.id, operatorId, operatorName);
        res.json({ success: true, data: plan });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : '操作失败'
        });
    }
});
router.post('/plans/:id/reject', (req, res) => {
    try {
        const { operatorId, operatorName, reason } = req.body;
        if (!operatorId || !operatorName || !reason) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数'
            });
        }
        const plan = services_1.budgetService.processReject(req.params.id, operatorId, operatorName, reason);
        res.json({ success: true, data: plan });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : '操作失败'
        });
    }
});
router.post('/plans/:id/manual-review', (req, res) => {
    try {
        const { operatorId, operatorName, approved, reason } = req.body;
        if (!operatorId || !operatorName || reason === undefined || approved === undefined) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数'
            });
        }
        const plan = services_1.budgetService.processManualReview(req.params.id, operatorId, operatorName, approved, reason);
        res.json({ success: true, data: plan });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : '操作失败'
        });
    }
});
router.post('/plans/:id/close', (req, res) => {
    try {
        const { operatorId, operatorName } = req.body;
        if (!operatorId || !operatorName) {
            return res.status(400).json({
                success: false,
                message: '缺少操作员信息'
            });
        }
        const plan = services_1.budgetService.closePlan(req.params.id, operatorId, operatorName);
        res.json({ success: true, data: plan });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : '操作失败'
        });
    }
});
router.post('/spend-callbacks/batch-import', (req, res) => {
    try {
        const { data } = req.body;
        if (!Array.isArray(data)) {
            return res.status(400).json({
                success: false,
                message: '数据格式错误，需要数组'
            });
        }
        const results = services_1.budgetService.batchImportSpendCallbacks(data);
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        res.json({
            success: true,
            data: {
                total: results.length,
                success: successCount,
                fail: failCount,
                details: results
            }
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : '导入失败'
        });
    }
});
router.get('/plans/:id/export', async (req, res) => {
    try {
        const exportData = services_1.budgetService.exportPlanData(req.params.id);
        if (!exportData) {
            return res.status(404).json({ success: false, message: '计划不存在' });
        }
        const exportDir = path.join(process.cwd(), 'exports');
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }
        const filename = `plan-${req.params.id}-${Date.now()}.csv`;
        const filepath = path.join(exportDir, filename);
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: filepath,
            header: [
                { id: 'type', title: '类型' },
                { id: 'field', title: '字段' },
                { id: 'value', title: '值' }
            ]
        });
        const records = [];
        records.push({ type: '广告主信息', field: '', value: '' });
        records.push({ type: '', field: '广告主ID', value: exportData.advertiser.id });
        records.push({ type: '', field: '广告主名称', value: exportData.advertiser.name });
        records.push({ type: '', field: '公司名称', value: exportData.advertiser.companyName });
        records.push({ type: '', field: '行业', value: exportData.advertiser.industry });
        records.push({ type: '', field: '联系人', value: exportData.advertiser.contactPerson });
        records.push({ type: '', field: '联系电话', value: exportData.advertiser.contactPhone });
        records.push({ type: '', field: '总预算', value: exportData.advertiser.totalBudget });
        records.push({ type: '', field: '已用预算', value: exportData.advertiser.usedBudget });
        records.push({ type: '投放计划信息', field: '', value: '' });
        records.push({ type: '', field: '计划ID', value: exportData.plan.id });
        records.push({ type: '', field: '计划名称', value: exportData.plan.name });
        records.push({ type: '', field: '投放平台', value: exportData.plan.platform });
        records.push({ type: '', field: '日预算', value: exportData.plan.dailyBudget });
        records.push({ type: '', field: '总预算', value: exportData.plan.totalBudget });
        records.push({ type: '', field: '当前消耗', value: exportData.plan.currentSpend });
        records.push({ type: '', field: '状态', value: exportData.plan.status });
        records.push({ type: '', field: '开始日期', value: exportData.plan.startDate.toISOString() });
        records.push({ type: '', field: '结束日期', value: exportData.plan.endDate.toISOString() });
        records.push({ type: '消耗回传记录', field: '', value: '' });
        exportData.spendCallbacks.forEach((c, i) => {
            records.push({ type: `回传${i + 1}`, field: '回传时间', value: c.callbackTime.toISOString() });
            records.push({ type: `回传${i + 1}`, field: '消耗金额', value: c.spendAmount });
            records.push({ type: `回传${i + 1}`, field: '来源', value: c.callbackSource });
            records.push({ type: `回传${i + 1}`, field: '是否延迟', value: c.isDelayed ? '是' : '否' });
        });
        records.push({ type: '审批记录', field: '', value: '' });
        exportData.reviewRecords.forEach((r, i) => {
            records.push({ type: `审批${i + 1}`, field: '流程类型', value: r.flowType });
            records.push({ type: `审批${i + 1}`, field: '操作员', value: r.operatorName });
            records.push({ type: `审批${i + 1}`, field: '审批结果', value: r.reviewResult });
            records.push({ type: `审批${i + 1}`, field: '原因', value: r.reason });
            records.push({ type: `审批${i + 1}`, field: '证据链接', value: r.evidenceUrls.join('; ') });
        });
        await csvWriter.writeRecords(records);
        res.json({
            success: true,
            data: {
                filename,
                filepath,
                exportData
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : '导出失败'
        });
    }
});
router.get('/plans/:id/check-budget', (req, res) => {
    try {
        const result = services_1.budgetService.checkBudgetOverrun(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : '检查失败'
        });
    }
});
exports.default = router;
