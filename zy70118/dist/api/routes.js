"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRouter = createRouter;
const express_1 = require("express");
function createRouter(service) {
    const router = (0, express_1.Router)();
    router.get('/batches', async (req, res) => {
        const { supplierId, status, materialCode } = req.query;
        const batches = await service.listBatches({
            supplierId,
            status,
            materialCode
        });
        res.json({ success: true, data: batches });
    });
    router.get('/batches/:batchId', async (req, res) => {
        const { batchId } = req.params;
        const batch = await service.getBatch(batchId);
        if (!batch) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'BATCH_NOT_FOUND',
                    message: `批次不存在: ${batchId}`
                }
            });
            return;
        }
        res.json({ success: true, data: batch });
    });
    router.post('/batches', async (req, res) => {
        const request = req.body;
        const batch = await service.createBatch(request);
        res.status(201).json({ success: true, data: batch });
    });
    router.post('/batches/:batchId/temperature-check', async (req, res) => {
        const { batchId } = req.params;
        const request = { batchId, ...req.body };
        const result = await service.performTemperatureCheck(request);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '温度检查失败',
                    details: { errors: result.errors }
                }
            });
            return;
        }
        res.json({ success: true, data: result.batch });
    });
    router.post('/batches/:batchId/weight-check', async (req, res) => {
        const { batchId } = req.params;
        const request = { batchId, ...req.body };
        const result = await service.performWeightCheck(request);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '重量检查失败',
                    details: { errors: result.errors }
                }
            });
            return;
        }
        res.json({ success: true, data: result.batch });
    });
    router.post('/batches/:batchId/ticket-check', async (req, res) => {
        const { batchId } = req.params;
        const request = { batchId, ...req.body };
        const result = await service.performTicketCheck(request);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '票证检查失败',
                    details: { errors: result.errors }
                }
            });
            return;
        }
        res.json({ success: true, data: result.batch });
    });
    router.post('/batches/:batchId/reject', async (req, res) => {
        const { batchId } = req.params;
        const request = { batchId, ...req.body };
        const result = await service.rejectBatch(request);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '拒收失败',
                    details: { errors: result.errors }
                }
            });
            return;
        }
        res.json({ success: true, data: result.batch });
    });
    router.post('/batches/:batchId/replenish', async (req, res) => {
        const { batchId } = req.params;
        const request = { batchId, ...req.body };
        const result = await service.replenishBatch(request);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '补货登记失败',
                    details: { errors: result.errors }
                }
            });
            return;
        }
        res.json({ success: true, data: result.batch });
    });
    router.post('/batches/:batchId/accept', async (req, res) => {
        const { batchId } = req.params;
        const request = { batchId, ...req.body };
        const result = await service.acceptBatch(request);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: '验收失败',
                    details: { errors: result.errors }
                }
            });
            return;
        }
        res.json({ success: true, data: result.batch });
    });
    router.get('/batches/:batchId/report', async (req, res) => {
        const { batchId } = req.params;
        const report = await service.generateReport(batchId);
        res.json({ success: true, data: report });
    });
    return router;
}
//# sourceMappingURL=routes.js.map