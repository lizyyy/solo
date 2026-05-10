"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const report_service_1 = require("../services/report-service");
const router = (0, express_1.Router)();
router.post('/export', async (req, res) => {
    try {
        const options = {
            format: req.body.format,
            groupId: req.body.groupId,
            startDate: req.body.startDate,
            endDate: req.body.endDate,
            includeDetails: req.body.includeDetails ?? true,
            includeAuditLog: req.body.includeAuditLog ?? false,
        };
        const buffer = await report_service_1.reportService.generateReport(options);
        const contentType = {
            excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            pdf: 'application/pdf',
            markdown: 'text/markdown',
        }[options.format];
        const extension = {
            excel: 'xlsx',
            pdf: 'pdf',
            markdown: 'md',
        }[options.format];
        const filename = `bill-split-report-${Date.now()}.${extension}`;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
