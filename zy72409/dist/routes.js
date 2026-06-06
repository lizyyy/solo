"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const importService_1 = require("./services/importService");
const conflictService_1 = require("./services/conflictService");
const revenueService_1 = require("./services/revenueService");
const selfCheckService_1 = require("./services/selfCheckService");
const unifiedResultService_1 = require("./services/unifiedResultService");
const types_1 = require("./types");
const router = (0, express_1.Router)();
router.get('/batches', (req, res) => {
    try {
        const batches = (0, unifiedResultService_1.getBatchList)();
        res.json({ success: true, data: batches });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/batches', (req, res) => {
    try {
        const { batchDate, showName } = req.body;
        if (!batchDate || !showName) {
            return res.status(400).json({ success: false, error: 'batchDate 和 showName 必填' });
        }
        const batchId = (0, importService_1.createBatch)(batchDate, showName);
        res.json({ success: true, data: { batchId } });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/batches/:batchId', (req, res) => {
    try {
        const batchId = parseInt(req.params.batchId);
        const result = (0, unifiedResultService_1.getUnifiedBatchResult)(batchId);
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/batches/:batchId/import/sound-engineer', (req, res) => {
    try {
        const batchId = parseInt(req.params.batchId);
        const { tickets } = req.body;
        if (!tickets || !Array.isArray(tickets)) {
            return res.status(400).json({ success: false, error: 'tickets 数组必填' });
        }
        const result = (0, importService_1.importSoundEngineerRecords)(batchId, tickets);
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/batches/:batchId/import/rehearsal-group', (req, res) => {
    try {
        const batchId = parseInt(req.params.batchId);
        const { tickets } = req.body;
        if (!tickets || !Array.isArray(tickets)) {
            return res.status(400).json({ success: false, error: 'tickets 数组必填' });
        }
        const result = (0, importService_1.importRehearsalGroupRecords)(batchId, tickets);
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/batches/:batchId/conflicts', (req, res) => {
    try {
        const batchId = parseInt(req.params.batchId);
        const conflicts = (0, conflictService_1.getConflicts)(batchId);
        res.json({ success: true, data: conflicts });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/conflicts/:conflictId/resolve', (req, res) => {
    try {
        const conflictId = parseInt(req.params.conflictId);
        const { resolution, resolvedBy, customValue } = req.body;
        if (!resolution || !resolvedBy) {
            return res.status(400).json({ success: false, error: 'resolution 和 resolvedBy 必填' });
        }
        const result = (0, conflictService_1.resolveConflict)(conflictId, resolution, resolvedBy, customValue);
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/batches/:batchId/calculate', (req, res) => {
    try {
        const batchId = parseInt(req.params.batchId);
        const { useSource } = req.body;
        const result = (0, revenueService_1.calculateRevenueSplit)(batchId, useSource);
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/batches/:batchId/revenue', (req, res) => {
    try {
        const batchId = parseInt(req.params.batchId);
        const result = (0, revenueService_1.getLatestRevenueSplit)(batchId);
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/batches/:batchId/revenue/history', (req, res) => {
    try {
        const batchId = parseInt(req.params.batchId);
        const result = (0, revenueService_1.getRevenueSplitHistory)(batchId);
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/batches/:batchId/self-check', (req, res) => {
    try {
        const batchId = parseInt(req.params.batchId);
        const result = (0, selfCheckService_1.runAllChecks)(batchId);
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/batches/:batchId/export', (req, res) => {
    try {
        const batchId = parseInt(req.params.batchId);
        const result = (0, unifiedResultService_1.exportBatchData)(batchId);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="batch-${batchId}-export.json"`);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/batches/:batchId/status', (req, res) => {
    try {
        const batchId = parseInt(req.params.batchId);
        const { status, updatedBy } = req.body;
        if (!status) {
            return res.status(400).json({ success: false, error: 'status 必填' });
        }
        const validStatuses = Object.values(types_1.BatchStatus);
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: `无效的状态值，有效值: ${validStatuses.join(', ')}` });
        }
        const dbModule = require('./db');
        dbModule.db.prepare(`
      UPDATE show_batches 
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, batchId);
        res.json({ success: true, data: { batchId, status } });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});
exports.default = router;
