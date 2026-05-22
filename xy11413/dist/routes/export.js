"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const exportService_1 = require("../services/exportService");
const router = (0, express_1.Router)();
router.post('/reconciliation/:taskId', auth_1.authenticate, (0, auth_1.requirePermission)('export'), async (req, res) => {
    try {
        const { taskId } = req.params;
        const exportedBy = req.user?.username || 'system';
        const result = await (0, exportService_1.exportReconciliationResults)(taskId, exportedBy);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('导出对账结果失败:', error);
        res.status(500).json({
            error: '导出对账结果失败',
            code: 'EXPORT_FAILED',
            message: error instanceof Error ? error.message : '未知错误'
        });
    }
});
router.post('/raw/:sourceType', auth_1.authenticate, (0, auth_1.requirePermission)('export'), async (req, res) => {
    try {
        const { sourceType } = req.params;
        const { franchiseeId } = req.body;
        const exportedBy = req.user?.username || 'system';
        if (!['order', 'waste', 'price', 'supplement'].includes(sourceType)) {
            res.status(400).json({ error: '无效的数据源类型', code: 'INVALID_SOURCE_TYPE' });
            return;
        }
        const result = await (0, exportService_1.exportRawData)(sourceType, exportedBy, franchiseeId);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('导出原始数据失败:', error);
        res.status(500).json({
            error: '导出原始数据失败',
            code: 'EXPORT_FAILED',
            message: error instanceof Error ? error.message : '未知错误'
        });
    }
});
router.get('/history', auth_1.authenticate, async (req, res) => {
    try {
        const history = await (0, exportService_1.getExportHistory)();
        res.json({
            success: true,
            data: history
        });
    }
    catch (error) {
        console.error('获取导出历史失败:', error);
        res.status(500).json({
            error: '获取导出历史失败',
            code: 'EXPORT_HISTORY_FAILED'
        });
    }
});
router.get('/verify/:exportId', auth_1.authenticate, async (req, res) => {
    try {
        const { exportId } = req.params;
        const isValid = await (0, exportService_1.verifyExportIntegrity)(exportId);
        res.json({
            success: true,
            data: { exportId, isValid }
        });
    }
    catch (error) {
        console.error('验证导出文件失败:', error);
        res.status(500).json({
            error: '验证导出文件失败',
            code: 'VERIFY_FAILED'
        });
    }
});
exports.default = router;
