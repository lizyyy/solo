"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cardService_1 = require("./services/cardService");
const importService_1 = require("./services/importService");
const conflictService_1 = require("./services/conflictService");
const selfCheckService_1 = require("./services/selfCheckService");
const revenueService_1 = require("./services/revenueService");
const withdrawService_1 = require("./services/withdrawService");
const router = (0, express_1.Router)();
const cardService = new cardService_1.CardService();
const importService = new importService_1.ImportService();
const conflictService = new conflictService_1.ConflictService();
const selfCheckService = new selfCheckService_1.SelfCheckService();
const revenueService = new revenueService_1.RevenueService();
const withdrawService = new withdrawService_1.WithdrawService();
router.post('/cards', (req, res) => {
    try {
        const { playlistName, createdBy } = req.body;
        if (!playlistName || !createdBy) {
            return res.status(400).json({ error: 'playlistName 和 createdBy 必填' });
        }
        const card = cardService.createCard(playlistName, createdBy);
        res.json(card);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/cards', (req, res) => {
    try {
        const cards = cardService.listCards();
        res.json(cards);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/cards/:cardId', (req, res) => {
    try {
        const card = cardService.getCard(req.params.cardId);
        if (!card) {
            return res.status(404).json({ error: '卡片不存在' });
        }
        res.json(card);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/cards/:cardId/import-attendance', (req, res) => {
    try {
        const { records, importedBy } = req.body;
        if (!records || !importedBy) {
            return res.status(400).json({ error: 'records 和 importedBy 必填' });
        }
        const result = importService.importAttendance(req.params.cardId, records, importedBy);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/cards/:cardId/supplement-tickets', (req, res) => {
    try {
        const { records, supplementedBy } = req.body;
        if (!records || !supplementedBy) {
            return res.status(400).json({ error: 'records 和 supplementedBy 必填' });
        }
        const result = importService.supplementTickets(req.params.cardId, records, supplementedBy);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/cards/:cardId/attendance', (req, res) => {
    try {
        const records = importService.getAttendanceByCardId(req.params.cardId);
        res.json(records);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/cards/:cardId/tickets', (req, res) => {
    try {
        const records = importService.getTicketsByCardId(req.params.cardId);
        res.json(records);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/cards/:cardId/detect-conflicts', (req, res) => {
    try {
        const conflicts = conflictService.detectConflicts(req.params.cardId);
        res.json({ conflicts, count: conflicts.length });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/cards/:cardId/conflicts', (req, res) => {
    try {
        const conflicts = conflictService.getConflictsByCardId(req.params.cardId);
        res.json(conflicts);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/conflicts/:conflictId/resolve', (req, res) => {
    try {
        const { resolution, resolvedBy } = req.body;
        if (!resolution || !resolvedBy) {
            return res.status(400).json({ error: 'resolution 和 resolvedBy 必填' });
        }
        const conflict = conflictService.resolveConflict(req.params.conflictId, resolution, resolvedBy);
        if (!conflict) {
            return res.status(404).json({ error: '冲突记录不存在' });
        }
        res.json(conflict);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/cards/:cardId/self-check', (req, res) => {
    try {
        const results = selfCheckService.runAllChecks(req.params.cardId);
        const hasErrors = results.some((r) => r.severity === 'ERROR' && !r.passed);
        const hasWarnings = results.some((r) => r.severity === 'WARNING' && !r.passed);
        res.json({
            results,
            summary: {
                passed: results.filter((r) => r.passed).length,
                errors: hasErrors ? results.filter((r) => r.severity === 'ERROR' && !r.passed).length : 0,
                warnings: hasWarnings ? results.filter((r) => r.severity === 'WARNING' && !r.passed).length : 0,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/cards/:cardId/calculate-revenue', (req, res) => {
    try {
        const { calculatedBy } = req.body;
        if (!calculatedBy) {
            return res.status(400).json({ error: 'calculatedBy 必填' });
        }
        const result = revenueService.calculateRevenue(req.params.cardId, calculatedBy);
        res.json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/cards/:cardId/revenue', (req, res) => {
    try {
        const version = req.query.version ? parseInt(req.query.version) : undefined;
        const details = revenueService.getRevenueByCardId(req.params.cardId, version);
        const summary = details.reduce((acc, d) => {
            acc.totalBase += d.baseAmount;
            acc.totalAdjustment += d.adjustmentAmount;
            acc.totalFinal += d.finalAmount;
            return acc;
        }, { totalBase: 0, totalAdjustment: 0, totalFinal: 0 });
        res.json({ details, summary, version: version || 'latest' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/cards/:cardId/revenue/export', (req, res) => {
    try {
        const exportData = revenueService.getRevenueExportData(req.params.cardId);
        res.json({ exportData, count: exportData.length });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/cards/:cardId/withdraw', (req, res) => {
    try {
        const { withdrawnBy } = req.body;
        if (!withdrawnBy) {
            return res.status(400).json({ error: 'withdrawnBy 必填' });
        }
        const result = withdrawService.withdrawToPreviousVersion(req.params.cardId, withdrawnBy);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/cards/:cardId/withdraw-revenue', (req, res) => {
    try {
        const { withdrawnBy } = req.body;
        if (!withdrawnBy) {
            return res.status(400).json({ error: 'withdrawnBy 必填' });
        }
        const result = withdrawService.withdrawRevenueVersion(req.params.cardId, withdrawnBy);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/cards/:cardId/version-history', (req, res) => {
    try {
        const history = withdrawService.getVersionHistory(req.params.cardId);
        res.json(history);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/cards/:cardId/full-details', (req, res) => {
    try {
        const cardId = req.params.cardId;
        const card = cardService.getCard(cardId);
        if (!card) {
            return res.status(404).json({ error: '卡片不存在' });
        }
        const attendance = importService.getAttendanceByCardId(cardId);
        const tickets = importService.getTicketsByCardId(cardId);
        const conflicts = conflictService.getConflictsByCardId(cardId);
        const revenue = revenueService.getLatestRevenue(cardId);
        const versionHistory = withdrawService.getVersionHistory(cardId);
        res.json({
            card,
            attendance,
            tickets,
            conflicts,
            revenue,
            versionHistory,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
