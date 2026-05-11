"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const device_1 = require("../services/device");
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
        const type = req.query.type;
        const search = req.query.search;
        const result = await (0, device_1.getDevices)({
            page,
            pageSize,
            status: status,
            type,
            search
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
router.get('/:id', async (req, res, next) => {
    try {
        const device = await (0, device_1.getDeviceById)(req.params.id);
        if (!device) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: '设备不存在'
                },
                requestId: req.idempotency.requestId,
                timestamp: new Date().toISOString()
            });
            return;
        }
        res.json({
            success: true,
            data: device,
            requestId: req.idempotency.requestId,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/', async (req, res, next) => {
    try {
        if (req.idempotency.isRetry && req.idempotency.cachedResponse) {
            res.json(req.idempotency.cachedResponse);
            return;
        }
        const device = await (0, device_1.createDevice)({
            name: req.body.name,
            code: req.body.code,
            type: req.body.type,
            model: req.body.model,
            serialNumber: req.body.serialNumber,
            description: req.body.description,
            operatorId: CURRENT_USER.id,
            operatorName: CURRENT_USER.name,
            requestId: req.idempotency.requestId,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        const response = {
            success: true,
            data: device,
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
router.put('/:id', async (req, res, next) => {
    try {
        if (req.idempotency.isRetry && req.idempotency.cachedResponse) {
            res.json(req.idempotency.cachedResponse);
            return;
        }
        const device = await (0, device_1.updateDevice)({
            id: req.params.id,
            name: req.body.name,
            code: req.body.code,
            type: req.body.type,
            model: req.body.model,
            serialNumber: req.body.serialNumber,
            description: req.body.description,
            status: req.body.status,
            operatorId: CURRENT_USER.id,
            operatorName: CURRENT_USER.name,
            requestId: req.idempotency.requestId,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        const response = {
            success: true,
            data: device,
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
router.delete('/:id', async (req, res, next) => {
    try {
        if (req.idempotency.isRetry && req.idempotency.cachedResponse) {
            res.json(req.idempotency.cachedResponse);
            return;
        }
        await (0, device_1.deleteDevice)(req.params.id, CURRENT_USER.id, CURRENT_USER.name, req.idempotency.requestId, req.ip, req.headers['user-agent']);
        const response = {
            success: true,
            data: null,
            requestId: req.idempotency.requestId,
            timestamp: new Date().toISOString()
        };
        await (0, idempotency_1.cacheIdempotentResponse)(req.idempotency.requestId, (0, idempotency_1.getEndpointKey)(req.method, req.originalUrl), response);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=devices.js.map