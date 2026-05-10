const express = require('express');
const services = require('./services');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

router.post('/weighing', asyncHandler(async (req, res) => {
    const record = await services.createWeighingRecord(req.body);
    res.status(201).json({
        success: true,
        data: record,
        message: '称重记录创建成功'
    });
}));

router.get('/weighing/:id', asyncHandler(async (req, res) => {
    const record = await services.getWeighingRecord(req.params.id);
    if (!record) {
        return res.status(404).json({
            success: false,
            message: '称重记录不存在'
        });
    }
    res.json({
        success: true,
        data: record
    });
}));

router.post('/reprint', asyncHandler(async (req, res) => {
    const request = await services.createReprintRequest(req.body);
    res.status(201).json({
        success: true,
        data: request,
        message: '重打申请创建成功'
    });
}));

router.get('/reprint/:id', asyncHandler(async (req, res) => {
    const request = await services.getReprintRequest(req.params.id);
    if (!request) {
        return res.status(404).json({
            success: false,
            message: '申请不存在'
        });
    }
    res.json({
        success: true,
        data: request
    });
}));

router.post('/reprint/:id/approve', asyncHandler(async (req, res) => {
    const { operator_id } = req.body;
    const result = await services.approveRequest(req.params.id, operator_id);
    res.json({
        success: true,
        data: result,
        message: '申请已批准'
    });
}));

router.post('/reprint/:id/reject', asyncHandler(async (req, res) => {
    const { operator_id, reason } = req.body;
    const result = await services.rejectRequest(req.params.id, operator_id, reason);
    res.json({
        success: true,
        data: result,
        message: '申请已拒绝'
    });
}));

router.post('/reprint/:id/cancel', asyncHandler(async (req, res) => {
    const { operator_id } = req.body;
    const result = await services.cancelRequest(req.params.id, operator_id);
    res.json({
        success: true,
        data: result,
        message: '申请已取消'
    });
}));

router.post('/reprint/:id/execute', asyncHandler(async (req, res) => {
    const { operator_id } = req.body;
    const result = await services.executeReprint(req.params.id, operator_id);
    res.json({
        success: true,
        data: result,
        message: '标签重打成功'
    });
}));

router.post('/reprint/:id/modify', asyncHandler(async (req, res) => {
    const { operator_id, ...modifications } = req.body;
    const result = await services.modifyRequest(req.params.id, operator_id, modifications);
    res.json({
        success: true,
        data: result,
        message: '申请已修改'
    });
}));

router.post('/batch/lock', asyncHandler(async (req, res) => {
    const { batch_number, counter_code, operator_id, reason, expires_at } = req.body;
    const result = await services.lockBatch(batch_number, counter_code, operator_id, reason, expires_at);
    res.json({
        success: true,
        data: result,
        message: '批次已锁定'
    });
}));

router.post('/batch/unlock', asyncHandler(async (req, res) => {
    const { batch_number, counter_code, operator_id } = req.body;
    const result = await services.unlockBatch(batch_number, counter_code, operator_id);
    res.json({
        success: true,
        data: result,
        message: '批次已解锁'
    });
}));

router.get('/summary', asyncHandler(async (req, res) => {
    const summary = await services.getSummary(req.query);
    res.json({
        success: true,
        data: summary
    });
}));

router.get('/audit', asyncHandler(async (req, res) => {
    const logs = await services.getAuditLogs(req.query);
    res.json({
        success: true,
        data: logs
    });
}));

module.exports = router;
