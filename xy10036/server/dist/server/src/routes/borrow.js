"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const borrow_1 = require("../services/borrow");
const idempotency_1 = require("../middleware/idempotency");
const router = (0, express_1.Router)();
const CURRENT_USER = {
    id: 'demo-user-id',
    name: '演示用户'
};
router.get('/', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const status = req.query.status;
        const deviceId = req.query.deviceId;
        const userId = req.query.userId;
        const startTime = req.query.startTime;
        const endTime = req.query.endTime;
        const result = await (0, borrow_1.getBorrowRecords)({
            page,
            pageSize,
            status,
            deviceId,
            userId,
            startTime,
            endTime
        });
        res.json({
            success: true,
            data: result,
            requestId: req.idempotency.requestId,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/report', async (req, res, next) => {
    try {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            deviceId: req.query.deviceId,
            userId: req.query.userId,
            status: req.query.status
        };
        const records = await (0, borrow_1.getBorrowRecordsForReport)(filters);
        res.json({
            success: true,
            data: records,
            requestId: req.idempotency.requestId,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        const record = await (0, borrow_1.getBorrowRecordById)(req.params.id);
        if (!record) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: '借用记录不存在'
                },
                requestId: req.idempotency.requestId,
                timestamp: new Date().toISOString()
            });
            return;
        }
        res.json({
            success: true,
            data: record,
            requestId: req.idempotency.requestId,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/borrow', async (req, res, next) => {
    try {
        if (req.idempotency.isRetry && req.idempotency.cachedResponse) {
            res.json(req.idempotency.cachedResponse);
            return;
        }
        const record = await (0, borrow_1.borrowDevice)({
            deviceId: req.body.deviceId,
            userId: CURRENT_USER.id,
            userName: CURRENT_USER.name,
            purpose: req.body.purpose,
            expectedReturnTime: req.body.expectedReturnTime,
            requestId: req.body.requestId || req.idempotency.requestId,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        const response = {
            success: true,
            data: record,
            requestId: req.idempotency.requestId,
            timestamp: new Date().toISOString()
        };
        await (0, idempotency_1.cacheIdempotentResponse)(req.idempotency.requestId, (0, idempotency_1.getEndpointKey)(req.method, req.originalUrl), response);
        res.status(201).json(response);
    }
    catch (error) {
        next(error);
    }
});
router.post('/return', async (req, res, next) => {
    try {
        if (req.idempotency.isRetry && req.idempotency.cachedResponse) {
            res.json(req.idempotency.cachedResponse);
            return;
        }
        const record = await (0, borrow_1.returnDevice)({
            borrowRecordId: req.body.borrowRecordId,
            userId: CURRENT_USER.id,
            userName: CURRENT_USER.name,
            notes: req.body.notes,
            version: req.body.version,
            requestId: req.body.requestId || req.idempotency.requestId,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        const response = {
            success: true,
            data: record,
            requestId: req.idempotency.requestId,
            timestamp: new Date().toISOString()
        };
        await (0, idempotency_1.cacheIdempotentResponse)(req.idempotency.requestId, (0, idempotency_1.getEndpointKey)(req.method, req.originalUrl), response);
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=borrow.js.map