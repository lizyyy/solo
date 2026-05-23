"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dao_1 = require("../database/dao");
const exportService_1 = require("../services/exportService");
const router = (0, express_1.Router)();
function getOperatorInfo(req) {
    return {
        operatorId: req.headers['x-operator-id'] || 'system',
        operatorName: req.headers['x-operator-name'] || '系统管理员'
    };
}
router.get('/summary', async (req, res) => {
    try {
        const summary = await dao_1.SummaryDAO.getFinancialSummary();
        res.json({
            success: true,
            data: summary
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/summary/export', async (req, res) => {
    try {
        const filePath = await exportService_1.ExportService.exportFinancialSummaryToCSV();
        res.json({
            success: true,
            data: { filePath },
            message: '财务汇总导出成功'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/failed-records', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const resolved = req.query.resolved === 'true' ? true :
            req.query.resolved === 'false' ? false : undefined;
        const { data, total } = await dao_1.FailedRecordDAO.findAll(resolved, page, pageSize);
        res.json({
            success: true,
            data: {
                data,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/failed-records/:id/resolve', async (req, res) => {
    try {
        const { operatorId } = getOperatorInfo(req);
        const { notes } = req.body;
        await dao_1.FailedRecordDAO.resolve(req.params.id, operatorId, notes);
        res.json({
            success: true,
            message: '失败记录已标记为已解决'
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/export-files', async (req, res) => {
    try {
        const files = await exportService_1.ExportService.getExportFiles();
        res.json({
            success: true,
            data: files
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
exports.default = router;
//# sourceMappingURL=finance.js.map