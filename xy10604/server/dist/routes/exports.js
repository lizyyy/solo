"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const errorHandler_1 = require("../middlewares/errorHandler");
const exportService_1 = require("../services/exportService");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get('/statistics', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const stats = await (0, exportService_1.getStatistics)({
        startDate: req.query.startDate,
        endDate: req.query.endDate,
    });
    res.json(stats);
}));
router.get('/excel', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const buffer = await (0, exportService_1.generateExport)({
        format: 'excel',
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        reviewerId: req.query.reviewerId,
        includeAuditLogs: req.query.includeAuditLogs !== 'false',
        includeReviews: req.query.includeReviews !== 'false',
        includeDiscards: req.query.includeDiscards !== 'false',
    });
    const fileName = `reagent_report_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
}));
router.get('/review/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const details = await (0, exportService_1.getReviewDetailsForExport)(req.params.id);
    res.json(details);
}));
exports.default = router;
//# sourceMappingURL=exports.js.map