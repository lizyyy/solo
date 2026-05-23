"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const stateMachine_1 = require("../services/stateMachine");
const dao_1 = require("../database/dao");
const exportService_1 = require("../services/exportService");
const types_1 = require("../types");
const router = (0, express_1.Router)();
function getOperatorInfo(req) {
    return {
        operatorId: req.headers['x-operator-id'] || 'system',
        operatorName: req.headers['x-operator-name'] || '系统管理员'
    };
}
router.post('/', async (req, res) => {
    try {
        const { operatorId, operatorName } = getOperatorInfo(req);
        const { batchData, equipmentItems } = req.body;
        const batch = await stateMachine_1.StateMachineService.createBatch(batchData, equipmentItems.map((item) => ({
            ...item,
            expectedReturnDate: new Date(item.expectedReturnDate),
            actualReturnDate: item.actualReturnDate ? new Date(item.actualReturnDate) : undefined
        })), operatorId, operatorName);
        res.json({
            success: true,
            data: batch,
            message: '批次创建成功'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message,
            traceId: (0, uuid_1.v4)()
        });
    }
});
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const status = req.query.status;
        const customerId = req.query.customerId;
        const isArchived = req.query.isArchived === 'true';
        const { data, total } = await dao_1.BatchDAO.findAll({ status, customerId, isArchived }, page, pageSize);
        res.json({
            success: true,
            data: {
                data,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const batch = await stateMachine_1.StateMachineService.getBatchDetail(req.params.id);
        if (!batch) {
            return res.status(404).json({
                success: false,
                error: '批次不存在'
            });
        }
        const consistency = stateMachine_1.StateMachineService.validateDataConsistency(batch);
        res.json({
            success: true,
            data: {
                ...batch,
                dataConsistency: consistency
            }
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/:id/transition', async (req, res) => {
    try {
        const { operatorId, operatorName } = getOperatorInfo(req);
        const { transitionKey, reason, context } = req.body;
        const batch = await stateMachine_1.StateMachineService.transition(req.params.id, transitionKey, reason, operatorId, operatorName, context);
        res.json({
            success: true,
            data: batch,
            message: `状态变更成功: ${transitionKey}`
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/:id/attachments', async (req, res) => {
    try {
        const { operatorId, operatorName } = getOperatorInfo(req);
        const { type, fileName, fileUrl, fileSize } = req.body;
        const attachment = await dao_1.AttachmentDAO.create({
            batchId: req.params.id,
            type,
            fileName,
            fileUrl,
            fileSize,
            uploadedBy: operatorId
        });
        const batch = await dao_1.BatchDAO.findById(req.params.id);
        if (batch && batch.status === types_1.ReturnStatus.BATCH_CREATED) {
            await stateMachine_1.StateMachineService.transition(req.params.id, 'UPLOAD_ATTACHMENTS', '上传附件', operatorId, operatorName);
        }
        res.json({
            success: true,
            data: attachment,
            message: '附件上传成功'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/:id/attachments/:attachmentId/verify', async (req, res) => {
    try {
        const { operatorId } = getOperatorInfo(req);
        const { notes } = req.body;
        await dao_1.AttachmentDAO.verify(req.params.attachmentId, operatorId, notes);
        res.json({
            success: true,
            message: '附件审核成功'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/:id/deductions', async (req, res) => {
    try {
        const { operatorId } = getOperatorInfo(req);
        const { equipmentId, deductionType, amount, reason, evidenceAttachmentIds } = req.body;
        const deduction = await dao_1.DeductionDAO.create({
            batchId: req.params.id,
            equipmentId,
            deductionType,
            amount,
            reason,
            evidenceAttachmentIds,
            createdBy: operatorId
        });
        res.json({
            success: true,
            data: deduction,
            message: '扣款记录创建成功'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/:id/deductions/:deductionId/approve', async (req, res) => {
    try {
        const { operatorId } = getOperatorInfo(req);
        await dao_1.DeductionDAO.approve(req.params.deductionId, operatorId);
        res.json({
            success: true,
            message: '扣款记录批准成功'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/:id/history', async (req, res) => {
    try {
        const logs = await dao_1.AuditLogDAO.findByBatchId(req.params.id);
        res.json({
            success: true,
            data: logs
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/:id/transitions/available', async (req, res) => {
    try {
        const batch = await dao_1.BatchDAO.findById(req.params.id);
        if (!batch) {
            return res.status(404).json({
                success: false,
                error: '批次不存在'
            });
        }
        const transitions = await stateMachine_1.StateMachineService.getAvailableTransitions(batch.status);
        const transitionsWithDesc = transitions.map(key => ({
            key,
            description: stateMachine_1.StateMachineService.getTransitionDescription(key)
        }));
        res.json({
            success: true,
            data: transitionsWithDesc
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/export', async (req, res) => {
    try {
        const { startDate, endDate, status, includeArchived } = req.body;
        const filePath = await exportService_1.ExportService.exportBatchesToCSV({
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            status: status,
            includeArchived
        });
        res.json({
            success: true,
            data: { filePath },
            message: '导出成功'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/:id/export', async (req, res) => {
    try {
        const filePath = await exportService_1.ExportService.exportBatchDetailToCSV(req.params.id);
        res.json({
            success: true,
            data: { filePath },
            message: '导出成功'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
exports.default = router;
//# sourceMappingURL=batches.js.map