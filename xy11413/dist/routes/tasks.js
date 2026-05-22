"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const taskService_1 = require("../services/taskService");
const reconciliationService_1 = require("../services/reconciliationService");
const router = (0, express_1.Router)();
router.post('/', auth_1.authenticate, (0, auth_1.requirePermission)('reconcile'), async (req, res) => {
    try {
        const { taskType, payload } = req.body;
        if (!taskType) {
            res.status(400).json({ error: '缺少任务类型', code: 'MISSING_TASK_TYPE' });
            return;
        }
        const taskId = await (0, taskService_1.createTask)(taskType, payload || {});
        res.json({
            success: true,
            data: { taskId, taskType }
        });
    }
    catch (error) {
        console.error('创建任务失败:', error);
        res.status(500).json({
            error: '创建任务失败',
            code: 'TASK_CREATE_FAILED',
            message: error instanceof Error ? error.message : '未知错误'
        });
    }
});
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const { status } = req.query;
        let tasks;
        if (status && typeof status === 'string') {
            tasks = await (0, taskService_1.getTasksByStatus)(status);
        }
        else {
            tasks = await (0, taskService_1.getAllTasks)();
        }
        res.json({
            success: true,
            data: tasks
        });
    }
    catch (error) {
        console.error('获取任务列表失败:', error);
        res.status(500).json({
            error: '获取任务列表失败',
            code: 'TASK_LIST_FAILED'
        });
    }
});
router.get('/:taskId', auth_1.authenticate, async (req, res) => {
    try {
        const { taskId } = req.params;
        const task = await (0, taskService_1.getTaskById)(taskId);
        if (!task) {
            res.status(404).json({ error: '任务不存在', code: 'TASK_NOT_FOUND' });
            return;
        }
        res.json({
            success: true,
            data: task
        });
    }
    catch (error) {
        console.error('获取任务详情失败:', error);
        res.status(500).json({
            error: '获取任务详情失败',
            code: 'TASK_DETAIL_FAILED'
        });
    }
});
router.post('/:taskId/reconcile', auth_1.authenticate, (0, auth_1.requirePermission)('reconcile'), async (req, res) => {
    try {
        const { taskId } = req.params;
        const { franchiseeId, startDate, endDate } = req.body;
        const started = await (0, taskService_1.getTaskById)(taskId);
        if (!started) {
            res.status(404).json({ error: '任务不存在', code: 'TASK_NOT_FOUND' });
            return;
        }
        const result = await (0, reconciliationService_1.performReconciliation)(taskId, { franchiseeId, startDate, endDate });
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('对账失败:', error);
        res.status(500).json({
            error: '对账失败',
            code: 'RECONCILIATION_FAILED',
            message: error instanceof Error ? error.message : '未知错误'
        });
    }
});
router.get('/:taskId/results', auth_1.authenticate, async (req, res) => {
    try {
        const { taskId } = req.params;
        const results = await (0, reconciliationService_1.getReconciliationResults)(taskId);
        res.json({
            success: true,
            data: results
        });
    }
    catch (error) {
        console.error('获取对账结果失败:', error);
        res.status(500).json({
            error: '获取对账结果失败',
            code: 'RESULTS_FAILED'
        });
    }
});
router.get('/:taskId/summary', auth_1.authenticate, async (req, res) => {
    try {
        const { taskId } = req.params;
        const summary = await (0, reconciliationService_1.getReconciliationSummary)(taskId);
        res.json({
            success: true,
            data: summary
        });
    }
    catch (error) {
        console.error('获取对账摘要失败:', error);
        res.status(500).json({
            error: '获取对账摘要失败',
            code: 'SUMMARY_FAILED'
        });
    }
});
router.post('/:taskId/manual-opinion', auth_1.authenticate, (0, auth_1.requirePermission)('manage_tasks'), async (req, res) => {
    try {
        const { taskId } = req.params;
        const { opinion, resolved } = req.body;
        if (!opinion) {
            res.status(400).json({ error: '缺少处理意见', code: 'MISSING_OPINION' });
            return;
        }
        const success = await (0, taskService_1.updateManualOpinion)(taskId, opinion, resolved || false);
        if (!success) {
            res.status(400).json({ error: '更新失败，任务可能不处于待人工处理状态', code: 'UPDATE_FAILED' });
            return;
        }
        res.json({
            success: true,
            message: resolved ? '已重新提交处理' : '已记录人工意见'
        });
    }
    catch (error) {
        console.error('更新人工意见失败:', error);
        res.status(500).json({
            error: '更新人工意见失败',
            code: 'OPINION_UPDATE_FAILED'
        });
    }
});
router.post('/:taskId/assign', auth_1.authenticate, (0, auth_1.requirePermission)('manage_tasks'), async (req, res) => {
    try {
        const { taskId } = req.params;
        const { assignedTo } = req.body;
        if (!assignedTo) {
            res.status(400).json({ error: '缺少处理人', code: 'MISSING_ASSIGNEE' });
            return;
        }
        const success = await (0, taskService_1.assignTask)(taskId, assignedTo);
        res.json({ success });
    }
    catch (error) {
        console.error('分配任务失败:', error);
        res.status(500).json({
            error: '分配任务失败',
            code: 'ASSIGN_FAILED'
        });
    }
});
exports.default = router;
