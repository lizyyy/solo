"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const errorHandler_1 = require("../middlewares/errorHandler");
const discardService_1 = require("../services/discardService");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.post('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const discard = await (0, discardService_1.createDiscard)({
        ...req.body,
        createdBy: req.user.id,
    });
    res.status(201).json(discard);
}));
router.get('/statistics', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const stats = await (0, discardService_1.getDiscardStatistics)({
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        reagentId: req.query.reagentId,
    });
    res.json(stats);
}));
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const result = await (0, discardService_1.getDiscardRecords)({
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        batchId: req.query.batchId,
        reason: req.query.reason,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
    });
    res.json(result);
}));
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const discard = await (0, discardService_1.getDiscardById)(req.params.id);
    if (!discard) {
        return res.status(404).json({ error: '废弃记录不存在' });
    }
    res.json(discard);
}));
exports.default = router;
//# sourceMappingURL=discards.js.map