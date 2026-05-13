"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const memberService_1 = require("../services/memberService");
const transactionService_1 = require("../services/transactionService");
const pointRuleService_1 = require("../services/pointRuleService");
const redemptionService_1 = require("../services/redemptionService");
const pointLogService_1 = require("../services/pointLogService");
const recalculationService_1 = require("../services/recalculationService");
const router = express_1.default.Router();
router.post('/members', async (req, res) => {
    try {
        const { name, phone } = req.body;
        const member = await (0, memberService_1.createMember)(name, phone);
        res.json(member);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/members', async (req, res) => {
    try {
        const members = await (0, memberService_1.getAllMembers)();
        res.json(members);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/members/:id', async (req, res) => {
    try {
        const member = await (0, memberService_1.getMemberById)(req.params.id);
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        res.json(member);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/point-rules', async (req, res) => {
    try {
        const { version, name, rules, effectiveAt, description } = req.body;
        const ruleVersion = await (0, pointRuleService_1.createPointRuleVersion)(version, name, rules, effectiveAt, description);
        res.json(ruleVersion);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/point-rules', async (req, res) => {
    try {
        const rules = await (0, pointRuleService_1.getAllPointRuleVersions)();
        res.json(rules);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/point-rules/:id/freeze', async (req, res) => {
    try {
        await (0, pointRuleService_1.freezePointRuleVersion)(req.params.id);
        const rule = await (0, pointRuleService_1.getPointRuleVersionById)(req.params.id);
        res.json(rule);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/transactions', async (req, res) => {
    try {
        const { memberId, amount, category, ruleVersionId, createdAt } = req.body;
        const transaction = await (0, transactionService_1.createTransaction)(memberId, amount, category, createdAt);
        if (ruleVersionId) {
            const ruleVersion = await (0, pointRuleService_1.getPointRuleVersionById)(ruleVersionId);
            if (ruleVersion) {
                const points = await (0, pointRuleService_1.calculatePointsForTransaction)(amount, category, ruleVersion.rules);
                if (points > 0) {
                    await (0, pointLogService_1.createPointLog)(memberId, points, 'earn', `消费获得积分: ${category} x ${amount}元`, { transactionId: transaction.id });
                }
            }
        }
        res.json(transaction);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/members/:memberId/transactions', async (req, res) => {
    try {
        const { memberId } = req.params;
        const { startTime, endTime } = req.query;
        const transactions = await (0, transactionService_1.getTransactionsByMemberId)(memberId, startTime, endTime);
        res.json(transactions);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/redemptions', async (req, res) => {
    try {
        const { memberId, points, giftName, giftId } = req.body;
        const redemption = await (0, redemptionService_1.createRedemption)(memberId, points, giftName, giftId);
        res.json(redemption);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/redemptions/:id/confirm', async (req, res) => {
    try {
        await (0, redemptionService_1.confirmRedemption)(req.params.id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/members/:memberId/locked-points', async (req, res) => {
    try {
        const { memberId } = req.params;
        const lockedPoints = await (0, redemptionService_1.getTotalLockedPoints)(memberId);
        res.json({ memberId, lockedPoints });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/members/:memberId/point-logs', async (req, res) => {
    try {
        const { memberId } = req.params;
        const logs = await (0, pointLogService_1.getPointLogsByMemberId)(memberId);
        res.json(logs);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/recalculation-tasks', async (req, res) => {
    try {
        const { name, ruleVersionId, description, memberIds, startTime, endTime, autoExecute } = req.body;
        const task = await (0, recalculationService_1.createRecalculationTask)(name, ruleVersionId, description, memberIds, startTime, endTime);
        if (autoExecute && task.status === 'pending') {
            await (0, recalculationService_1.executeRecalculationTask)(task.id);
            const updatedTask = await (0, recalculationService_1.getRecalculationTaskById)(task.id);
            return res.json({
                task: updatedTask,
                isExisting: task.status !== 'pending'
            });
        }
        res.json({
            task,
            isExisting: task.status !== 'pending'
        });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/recalculation-tasks/:id/execute', async (req, res) => {
    try {
        await (0, recalculationService_1.executeRecalculationTask)(req.params.id);
        const task = await (0, recalculationService_1.getRecalculationTaskById)(req.params.id);
        res.json(task);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/recalculation-tasks', async (req, res) => {
    try {
        const { memberId, startTime, endTime, status } = req.query;
        const tasks = await (0, recalculationService_1.searchRecalculationTasks)({
            memberId: memberId,
            startTime: startTime,
            endTime: endTime,
            status: status
        });
        res.json(tasks);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/recalculation-tasks/:id', async (req, res) => {
    try {
        const task = await (0, recalculationService_1.getRecalculationTaskById)(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Recalculation task not found' });
        }
        res.json(task);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/recalculation-tasks/:taskId/results', async (req, res) => {
    try {
        const { taskId } = req.params;
        const results = await (0, recalculationService_1.getMemberRecalculationResultsByTaskId)(taskId);
        res.json(results);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/recalculation-tasks/:taskId/results/:memberId', async (req, res) => {
    try {
        const { taskId, memberId } = req.params;
        const result = await (0, recalculationService_1.getMemberRecalculationResult)(taskId, memberId);
        if (!result) {
            return res.status(404).json({ error: 'Member recalculation result not found' });
        }
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/recalculation-tasks/:taskId/report', async (req, res) => {
    try {
        const { taskId } = req.params;
        const task = await (0, recalculationService_1.getRecalculationTaskById)(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Recalculation task not found' });
        }
        const results = await (0, recalculationService_1.getMemberRecalculationResultsByTaskId)(taskId);
        const adjustments = await (0, recalculationService_1.getCompensationAdjustmentsByTaskId)(taskId);
        const report = {
            task,
            summary: task.summary,
            memberCount: results.length,
            positiveDiffMembers: results.filter(r => r.difference > 0).length,
            negativeDiffMembers: results.filter(r => r.difference < 0).length,
            lockedPointsMembers: results.filter(r => r.lockedPoints > 0).length,
            pendingReviewMembers: results.filter(r => r.status === 'pending_review').length,
            completedMembers: results.filter(r => r.status === 'completed').length,
            totalCompensations: adjustments.filter(a => a.type === 'credit').reduce((sum, a) => sum + a.amount, 0),
            totalDeductions: adjustments.filter(a => a.type === 'debit').reduce((sum, a) => sum + a.amount, 0),
            adjustments
        };
        res.json(report);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/recalculation-tasks/:taskId/adjustments', async (req, res) => {
    try {
        const { taskId } = req.params;
        const adjustments = await (0, recalculationService_1.getCompensationAdjustmentsByTaskId)(taskId);
        res.json(adjustments);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/compensations/:id/confirm', async (req, res) => {
    try {
        const { operator } = req.body;
        await (0, recalculationService_1.confirmCompensationAdjustment)(req.params.id, operator || 'system');
        const adjustment = await (0, recalculationService_1.getCompensationAdjustmentById)(req.params.id);
        res.json(adjustment);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/recalculation-tasks/:taskId/apply-positive', async (req, res) => {
    try {
        await (0, recalculationService_1.applyPositiveCompensations)(req.params.taskId);
        const task = await (0, recalculationService_1.getRecalculationTaskById)(req.params.taskId);
        res.json(task);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
