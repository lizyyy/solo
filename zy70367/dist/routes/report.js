"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reportService_1 = require("../services/reportService");
const router = (0, express_1.Router)();
router.get('/batches/:batchId/report', (req, res) => {
    try {
        const { batchId } = req.params;
        const report = reportService_1.reportService.generateBatchReport(batchId);
        res.json({
            success: true,
            data: report
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error?.message || '生成批次报告失败'
        });
    }
});
router.get('/users', (req, res) => {
    try {
        const users = reportService_1.reportService.getUsersWithBatchSource();
        res.json({
            success: true,
            data: users
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error?.message || '获取用户列表失败'
        });
    }
});
router.get('/users/:email', (req, res) => {
    try {
        const { email } = req.params;
        const user = reportService_1.reportService.getUserDetailWithBatchInfo(decodeURIComponent(email));
        if (!user) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        res.json({
            success: true,
            data: user
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error?.message || '获取用户详情失败'
        });
    }
});
router.get('/batches/:batchId/reimport-context', (req, res) => {
    try {
        const { batchId } = req.params;
        const context = reportService_1.reportService.getReimportContext(batchId);
        res.json({
            success: true,
            data: context
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error?.message || '获取重新导入上下文失败'
        });
    }
});
exports.default = router;
