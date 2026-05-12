"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRouter = void 0;
const express_1 = require("express");
const benefitService_1 = require("../services/benefitService");
const router = (0, express_1.Router)();
exports.reportRouter = router;
router.get('/export', (req, res) => {
    const { memberId, benefitId, format } = req.query;
    const result = benefitService_1.benefitService.exportReport({
        memberId: memberId,
        benefitId: benefitId
    });
    if (format === 'csv' && result.success && result.data) {
        const headers = Object.keys(result.data[0] || {}).join(',');
        const rows = result.data.map((row) => Object.values(row).map(val => {
            const str = String(val);
            return str.includes(',') || str.includes('"')
                ? `"${str.replace(/"/g, '""')}"`
                : str;
        }).join(','));
        const csv = [headers, ...rows].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=benefit_report.csv');
        return res.send('\uFEFF' + csv);
    }
    res.json(result);
});
router.get('/all', (req, res) => {
    const data = benefitService_1.benefitService.getAllData();
    res.json({
        success: true,
        data,
        message: '查询成功'
    });
});
//# sourceMappingURL=reportRoutes.js.map