"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const errorHandler_1 = require("../middlewares/errorHandler");
const reagentService_1 = require("../services/reagentService");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.post('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const batch = await (0, reagentService_1.createBatch)({
        ...req.body,
        createdBy: req.user.id,
    });
    res.status(201).json(batch);
}));
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const result = await (0, reagentService_1.getBatches)({
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        reagentId: req.query.reagentId,
        status: req.query.status,
        search: req.query.search,
    });
    res.json(result);
}));
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const batch = await (0, reagentService_1.getBatchById)(req.params.id);
    if (!batch) {
        return res.status(404).json({ error: '批号不存在' });
    }
    res.json(batch);
}));
router.get('/:id/timeline', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const timeline = await (0, auditService_1.getEntityTimeline)('BATCH', req.params.id);
    res.json(timeline);
}));
exports.default = router;
//# sourceMappingURL=batches.js.map