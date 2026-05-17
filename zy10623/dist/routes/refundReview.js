"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const refundReviewService_1 = require("../services/refundReviewService");
const exportService_1 = require("../services/exportService");
const router = (0, express_1.Router)();
router.post('/', (req, res) => {
    const result = refundReviewService_1.refundReviewService.createRefundReview(req.body);
    res.json(result);
});
router.get('/:id', (req, res) => {
    const result = refundReviewService_1.refundReviewService.getRefundReview(req.params.id);
    res.json(result);
});
router.get('/:id/detail', (req, res) => {
    const result = refundReviewService_1.refundReviewService.getReviewDetailWithLabels(req.params.id);
    res.json(result);
});
router.get('/', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const filters = {
        status: req.query.status,
        userId: req.query.userId,
        orderNo: req.query.orderNo
    };
    const result = refundReviewService_1.refundReviewService.listRefundReviews(page, pageSize, filters);
    res.json(result);
});
router.post('/:id/review', (req, res) => {
    const result = refundReviewService_1.refundReviewService.review(req.params.id, req.body);
    res.json(result);
});
router.post('/:id/remark', (req, res) => {
    const result = refundReviewService_1.refundReviewService.addManualRemark(req.params.id, req.body);
    res.json(result);
});
router.get('/:id/audit', (req, res) => {
    const result = refundReviewService_1.refundReviewService.getAuditLogs(req.params.id);
    res.json(result);
});
router.get('/export/fields', async (req, res) => {
    const result = exportService_1.exportService.getExportFieldConfig();
    res.json(result);
});
router.post('/export', async (req, res) => {
    const result = await exportService_1.exportService.exportToCsv(req.body);
    res.json(result);
});
exports.default = router;
