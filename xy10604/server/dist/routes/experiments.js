"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const errorHandler_1 = require("../middlewares/errorHandler");
const experimentService_1 = require("../services/experimentService");
const auditService_1 = require("../services/auditService");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.post('/validate', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const validation = await (0, experimentService_1.validateExperiment)(req.body.batchId, req.body.scheduledDate);
    res.json(validation);
}));
router.post('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const result = await (0, experimentService_1.createExperiment)({
        ...req.body,
        createdBy: req.user.id,
    }, req.body.applyValidation !== false);
    res.status(201).json(result);
}));
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const result = await (0, experimentService_1.getExperiments)({
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        batchId: req.query.batchId,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
    });
    res.json(result);
}));
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const experiment = await (0, experimentService_1.getExperimentById)(req.params.id);
    if (!experiment) {
        return res.status(404).json({ error: '实验不存在' });
    }
    res.json(experiment);
}));
router.put('/:id/status', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const experiment = await (0, experimentService_1.updateExperimentStatus)(req.params.id, req.body.status, req.user.id);
    res.json(experiment);
}));
router.get('/:id/timeline', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const timeline = await (0, auditService_1.getEntityTimeline)('EXPERIMENT', req.params.id);
    res.json(timeline);
}));
exports.default = router;
//# sourceMappingURL=experiments.js.map