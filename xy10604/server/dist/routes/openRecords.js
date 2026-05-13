"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const errorHandler_1 = require("../middlewares/errorHandler");
const openRecordService_1 = require("../services/openRecordService");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.post('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const record = await (0, openRecordService_1.createOpenRecord)({
        ...req.body,
        createdBy: req.user.id,
    });
    res.status(201).json(record);
}));
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const result = await (0, openRecordService_1.getOpenRecords)({
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        batchId: req.query.batchId,
        isOpened: req.query.isOpened === 'true' ? true : req.query.isOpened === 'false' ? false : undefined,
    });
    res.json(result);
}));
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const record = await (0, openRecordService_1.getOpenRecordById)(req.params.id);
    if (!record) {
        return res.status(404).json({ error: '开封记录不存在' });
    }
    res.json(record);
}));
router.put('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const record = await (0, openRecordService_1.updateOpenRecord)(req.params.id, req.body, req.user.id);
    res.json(record);
}));
router.post('/:id/close', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const record = await (0, openRecordService_1.closeOpenRecord)(req.params.id, req.user.id);
    res.json(record);
}));
router.get('/:id/timeline', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const timeline = await (0, auditService_1.getEntityTimeline)('OPEN_RECORD', req.params.id);
    res.json(timeline);
}));
exports.default = router;
//# sourceMappingURL=openRecords.js.map