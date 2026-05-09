const express = require('express');
const router = express.Router();
const AuditLogger = require('../utils/auditLogger');

const getAuditContext = (req) => ({
    userId: req.headers['x-user-id'] || 'anonymous',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
});

router.get('/', async (req, res) => {
    try {
        const filters = {
            userId: req.query.userId,
            action: req.query.action,
            entityType: req.query.entityType,
            entityId: req.query.entityId,
            startTime: req.query.startTime ? parseInt(req.query.startTime) : undefined,
            endTime: req.query.endTime ? parseInt(req.query.endTime) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit) : 100,
            offset: req.query.offset ? parseInt(req.query.offset) : 0
        };

        const logs = await AuditLogger.getAuditLogs(filters);

        res.json({
            success: true,
            data: logs
        });
    } catch (error) {
        console.error('获取审计日志失败:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

router.get('/actions', async (req, res) => {
    try {
        const actions = [
            { code: 'CREATE_LOG', name: '创建日志' },
            { code: 'UPDATE_LOG', name: '更新日志' },
            { code: 'DELETE_LOG', name: '删除日志' },
            { code: 'GENERATE_REPORT', name: '生成日志报告' },
            { code: 'GENERATE_AUDIT_REPORT', name: '生成审计报告' },
            { code: 'GENERATE_STATS_REPORT', name: '生成统计报告' },
            { code: 'EXPORT_CSV', name: '导出CSV' }
        ];

        res.json({
            success: true,
            data: actions
        });
    } catch (error) {
        console.error('获取操作类型失败:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

module.exports = router;
