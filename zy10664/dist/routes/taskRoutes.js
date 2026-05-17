"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const json2csv_1 = require("json2csv");
const taskService_1 = require("../services/taskService");
const router = express_1.default.Router();
router.post('/', async (req, res) => {
    try {
        const request = req.body;
        const result = taskService_1.taskService.createTask(request);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.status(201).json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = taskService_1.taskService.getTaskDetail(id);
        if (!result.success) {
            return res.status(404).json(result);
        }
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const request = req.body;
        const result = taskService_1.taskService.updateTask(id, request);
        if (!result.success) {
            return res.status(result.message ? 404 : 400).json(result);
        }
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});
router.get('/', async (req, res) => {
    try {
        const query = {
            status: req.query.status,
            taskCode: req.query.taskCode,
            schedulerName: req.query.schedulerName,
            page: req.query.page ? parseInt(req.query.page, 10) : undefined,
            pageSize: req.query.pageSize ? parseInt(req.query.pageSize, 10) : undefined
        };
        const result = taskService_1.taskService.listTasks(query);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});
router.post('/:id/failure', async (req, res) => {
    try {
        const { id } = req.params;
        const request = req.body;
        const result = taskService_1.taskService.recordFailure(id, request);
        if (!result.success) {
            return res.status(result.message ? 404 : 400).json(result);
        }
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});
router.post('/:id/apply-recovery', async (req, res) => {
    try {
        const { id } = req.params;
        const request = req.body;
        const result = taskService_1.taskService.applyRecovery(id, request);
        if (!result.success) {
            return res.status(result.message ? 404 : 400).json(result);
        }
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});
router.post('/:id/audit-recovery', async (req, res) => {
    try {
        const { id } = req.params;
        const request = req.body;
        const result = taskService_1.taskService.auditRecovery(id, request);
        if (!result.success) {
            return res.status(result.message ? 404 : 400).json(result);
        }
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});
router.post('/:id/withdraw', async (req, res) => {
    try {
        const { id } = req.params;
        const request = req.body;
        const result = taskService_1.taskService.withdraw(id, request);
        if (!result.success) {
            return res.status(result.message ? 404 : 400).json(result);
        }
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});
router.post('/:id/manual-remark', async (req, res) => {
    try {
        const { id } = req.params;
        const request = req.body;
        const result = taskService_1.taskService.addManualRemark(id, request);
        if (!result.success) {
            return res.status(result.message ? 404 : 400).json(result);
        }
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});
router.put('/:taskId/conditions/:conditionId/meet', async (req, res) => {
    try {
        const { taskId, conditionId } = req.params;
        const { operator } = req.body;
        const result = taskService_1.taskService.meetRecoveryCondition(taskId, conditionId, operator);
        if (!result.success) {
            return res.status(404).json(result);
        }
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});
router.get('/export/csv', async (req, res) => {
    try {
        const result = taskService_1.taskService.exportTasks();
        const fields = [
            { label: '任务ID', value: 'id' },
            { label: '任务名称', value: 'taskName' },
            { label: '任务编码', value: 'taskCode' },
            { label: '调度器名称', value: 'schedulerName' },
            { label: '状态', value: 'status' },
            { label: '失败次数', value: 'failureCount' },
            { label: '熔断原因', value: 'fuseReason' },
            { label: '熔断时间', value: 'fusedAt' },
            { label: '恢复申请时间', value: 'recoveryApplyAt' },
            { label: '恢复完成时间', value: 'recoveredAt' },
            { label: '恢复申请人', value: 'recoveryApplicant' },
            { label: '恢复审核人', value: 'recoveryAuditor' },
            { label: '恢复说明', value: 'recoveryRemark' },
            { label: '人工备注', value: 'manualRemark' },
            { label: '是否有队列重试', value: 'hasQueuedRetry' },
            { label: '创建时间', value: 'createdAt' },
            { label: '更新时间', value: 'updatedAt' }
        ];
        const json2csvParser = new json2csv_1.Parser({ fields });
        const csv = json2csvParser.parse(result.data);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=tasks.csv');
        res.send('\uFEFF' + csv);
    }
    catch (error) {
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});
router.post('/import', async (req, res) => {
    try {
        const data = req.body;
        if (!Array.isArray(data)) {
            return res.status(400).json({ success: false, message: '导入数据必须是数组' });
        }
        const result = taskService_1.taskService.importTasks(data);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});
exports.default = router;
