"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reviewService_1 = require("../services/reviewService");
const router = (0, express_1.Router)();
router.post('/records/:id/approve', async (req, res) => {
    try {
        const { userId, userName, comment } = req.body;
        const updated = await reviewService_1.reviewService.approveRecord(req.params.id, userId, userName, comment || '');
        if (!updated) {
            return res.status(404).json({ success: false, error: '账单记录不存在' });
        }
        res.json({ success: true, data: updated });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/records/:id/reject', async (req, res) => {
    try {
        const { userId, userName, comment } = req.body;
        const updated = await reviewService_1.reviewService.rejectRecord(req.params.id, userId, userName, comment || '');
        if (!updated) {
            return res.status(404).json({ success: false, error: '账单记录不存在' });
        }
        res.json({ success: true, data: updated });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/records/:id/request-info', async (req, res) => {
    try {
        const { userId, userName, comment } = req.body;
        const updated = await reviewService_1.reviewService.requestMoreInfo(req.params.id, userId, userName, comment || '');
        if (!updated) {
            return res.status(404).json({ success: false, error: '账单记录不存在' });
        }
        res.json({ success: true, data: updated });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/records/:id/modify', async (req, res) => {
    try {
        const { userId, userName, comment, modifications } = req.body;
        const updated = await reviewService_1.reviewService.modifyRecord(req.params.id, userId, userName, comment || '', modifications);
        if (!updated) {
            return res.status(404).json({ success: false, error: '账单记录不存在' });
        }
        res.json({ success: true, data: updated });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.post('/records/:id/comment', async (req, res) => {
    try {
        const { userId, userName, comment } = req.body;
        const updated = await reviewService_1.reviewService.addComment(req.params.id, userId, userName, comment || '');
        if (!updated) {
            return res.status(404).json({ success: false, error: '账单记录不存在' });
        }
        res.json({ success: true, data: updated });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/records/:id/history', async (req, res) => {
    try {
        const history = reviewService_1.reviewService.getReviewHistory(req.params.id);
        if (!history) {
            return res.status(404).json({ success: false, error: '账单记录不存在' });
        }
        res.json({ success: true, data: history });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/pending', async (req, res) => {
    try {
        const records = reviewService_1.reviewService.getPendingRecords();
        res.json({ success: true, data: records });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/statistics', async (req, res) => {
    try {
        const stats = reviewService_1.reviewService.getStatistics();
        res.json({ success: true, data: stats });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=reviewRoutes.js.map