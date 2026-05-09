const express = require('express');
const router = express.Router();
const ReportService = require('../services/reportService');

const getAuditContext = (req) => ({
    userId: req.headers['x-user-id'] || 'anonymous',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
});

router.get('/logs', async (req, res) => {
    try {
        const filters = {
            level: req.query.level,
            source_type: req.query.source_type,
            status: req.query.status,
            startTime: req.query.startTime ? parseInt(req.query.startTime) : undefined,
            endTime: req.query.endTime ? parseInt(req.query.endTime) : undefined
        };

        const auditContext = getAuditContext(req);
        const report = await ReportService.generateLogReport(filters, auditContext);

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('生成日志报告失败:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

router.get('/logs/export', async (req, res) => {
    try {
        const filters = {
            level: req.query.level,
            source_type: req.query.source_type,
            status: req.query.status,
            startTime: req.query.startTime ? parseInt(req.query.startTime) : undefined,
            endTime: req.query.endTime ? parseInt(req.query.endTime) : undefined
        };

        const auditContext = getAuditContext(req);
        const report = await ReportService.generateCSVReport(filters, auditContext);

        res.setHeader('Content-Type', report.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
        res.send(report.content);
    } catch (error) {
        console.error('导出CSV失败:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

router.get('/audit', async (req, res) => {
    try {
        const filters = {
            userId: req.query.userId,
            action: req.query.action,
            entityType: req.query.entityType,
            entityId: req.query.entityId,
            startTime: req.query.startTime ? parseInt(req.query.startTime) : undefined,
            endTime: req.query.endTime ? parseInt(req.query.endTime) : undefined
        };

        const auditContext = getAuditContext(req);
        const report = await ReportService.generateAuditReport(filters, auditContext);

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('生成审计报告失败:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

router.get('/statistics', async (req, res) => {
    try {
        const filters = {
            level: req.query.level,
            source_type: req.query.source_type,
            status: req.query.status,
            startTime: req.query.startTime ? parseInt(req.query.startTime) : undefined,
            endTime: req.query.endTime ? parseInt(req.query.endTime) : undefined
        };

        const auditContext = getAuditContext(req);
        const report = await ReportService.generateStatisticsReport(filters, auditContext);

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('生成统计报告失败:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

module.exports = router;
