"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const errorHandler_1 = require("../middlewares/errorHandler");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const result = await (0, auditService_1.getAuditLogs)({
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        entityType: req.query.entityType,
        entityId: req.query.entityId,
        userId: req.query.userId,
        action: req.query.action,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
    });
    res.json(result);
}));
router.get('/timeline/:entityType/:entityId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const timeline = await (0, auditService_1.getEntityTimeline)(req.params.entityType, req.params.entityId);
    res.json(timeline);
}));
exports.default = router;
//# sourceMappingURL=audit.js.map