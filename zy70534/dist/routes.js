"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRouter = createRouter;
const express_1 = require("express");
const types_1 = require("./types");
function createRouter(service) {
    const router = (0, express_1.Router)();
    router.post('/quotas', (req, res) => {
        try {
            const { teamName, modelName, usageTag, limit, window, createdBy } = req.body;
            if (!teamName || !modelName || !usageTag || !limit || !window || !createdBy) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    required: ['teamName', 'modelName', 'usageTag', 'limit', 'window', 'createdBy']
                });
            }
            if (!Object.values(types_1.QuotaWindow).includes(window)) {
                return res.status(400).json({
                    error: 'Invalid window',
                    validValues: Object.values(types_1.QuotaWindow)
                });
            }
            const quota = service.createQuota(teamName, modelName, usageTag, limit, window, createdBy);
            res.status(201).json(quota);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    router.get('/quotas', (req, res) => {
        const quotas = service.getAllQuotas();
        res.json(quotas);
    });
    router.get('/quotas/:id', (req, res) => {
        const quota = service.getQuota(req.params.id);
        if (!quota) {
            return res.status(404).json({ error: 'Quota not found' });
        }
        res.json(quota);
    });
    router.get('/quotas/:id/summary', (req, res) => {
        try {
            const summary = service.getSummary(req.params.id);
            res.json(summary);
        }
        catch (error) {
            res.status(404).json({ error: error.message });
        }
    });
    router.post('/validate', (req, res) => {
        try {
            const { teamName, modelName, usageTag, tokens, requestId } = req.body;
            if (!teamName || !modelName || !usageTag || !tokens || !requestId) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    required: ['teamName', 'modelName', 'usageTag', 'tokens', 'requestId']
                });
            }
            const result = service.validateUsage(teamName, modelName, usageTag, tokens, requestId);
            if (result.success) {
                res.json({
                    success: true,
                    quota: result.config
                });
            }
            else {
                res.status(403).json({
                    success: false,
                    rejectEvent: result.rejectEvent
                });
            }
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    router.post('/quotas/:id/bonus', (req, res) => {
        try {
            const { bonusAmount, operator, reason } = req.body;
            if (!bonusAmount || !operator || !reason) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    required: ['bonusAmount', 'operator', 'reason']
                });
            }
            const quota = service.addTempBonus(req.params.id, bonusAmount, operator, reason);
            res.json(quota);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    router.patch('/quotas/:id/status', (req, res) => {
        try {
            const { status, operator, reason } = req.body;
            if (!status || !operator || !reason) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    required: ['status', 'operator', 'reason']
                });
            }
            if (!Object.values(types_1.QuotaStatus).includes(status)) {
                return res.status(400).json({
                    error: 'Invalid status',
                    validValues: Object.values(types_1.QuotaStatus)
                });
            }
            const quota = service.updateQuotaStatus(req.params.id, status, operator, reason);
            res.json(quota);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    router.patch('/quotas/:id/adjust', (req, res) => {
        try {
            const { limit, used, operator, reason } = req.body;
            if (!operator || !reason) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    required: ['operator', 'reason']
                });
            }
            const adjustments = {};
            if (limit !== undefined)
                adjustments.limit = limit;
            if (used !== undefined)
                adjustments.used = used;
            if (Object.keys(adjustments).length === 0) {
                return res.status(400).json({
                    error: 'No adjustments provided',
                    fields: ['limit', 'used']
                });
            }
            const quota = service.manualAdjust(req.params.id, adjustments, operator, reason);
            res.json(quota);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    router.get('/rejects', (req, res) => {
        const quotaId = req.query.quotaId;
        const rejects = service.getRejectEvents(quotaId);
        res.json(rejects);
    });
    router.get('/audit', (req, res) => {
        const quotaId = req.query.quotaId;
        const logs = service.getAuditLogs(quotaId);
        res.json(logs);
    });
    router.get('/export/:id', (req, res) => {
        try {
            const exportBy = req.query.exportBy || 'system';
            const exported = service.exportQuota(req.params.id, exportBy);
            res.json(exported);
        }
        catch (error) {
            res.status(404).json({ error: error.message });
        }
    });
    router.get('/export', (req, res) => {
        const exportBy = req.query.exportBy || 'system';
        const exported = service.exportAll(exportBy);
        res.json(exported);
    });
    router.get('/usage-tags', (req, res) => {
        res.json(service.getValidUsageTags());
    });
    return router;
}
