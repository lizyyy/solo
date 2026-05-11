"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const audit_1 = require("../services/audit");
const router = (0, express_1.Router)();
router.get('/', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const entityType = req.query.entityType;
        const entityId = req.query.entityId;
        const operatorId = req.query.operatorId;
        const action = req.query.action;
        const startTime = req.query.startTime;
        const endTime = req.query.endTime;
        const result = await (0, audit_1.getAuditLogs)({
            entityType,
            entityId,
            operatorId,
            action,
            startTime,
            endTime,
            page,
            pageSize
        });
        res.json({
            success: true,
            data: {
                items: result.items,
                total: result.total,
                page,
                pageSize,
                totalPages: Math.ceil(result.total / pageSize)
            },
            requestId: req.idempotency.requestId,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=audit.js.map