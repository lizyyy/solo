const express = require('express');
const router = express.Router();
const Joi = require('joi');
const LogService = require('../services/logService');
const IdempotencyChecker = require('../utils/idempotencyChecker');
const ConcurrencyControl = require('../utils/concurrencyControl');

const logSchema = Joi.object({
    source_type: Joi.string().required().valid('file', 'database', 'api', 'other'),
    level: Joi.string().required().valid('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'),
    message: Joi.string().required(),
    timestamp: Joi.number().positive(),
    metadata: Joi.object()
});

const updateSchema = Joi.object({
    message: Joi.string(),
    level: Joi.string().valid('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'),
    status: Joi.string().valid('pending', 'processed', 'ignored'),
    metadata: Joi.object()
}).min(1);

const getAuditContext = (req) => ({
    userId: req.headers['x-user-id'] || 'anonymous',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
});

router.post('/', async (req, res) => {
    try {
        const requestId = req.requestId;
        const endpoint = req.originalUrl;
        const method = req.method;

        const requestStatus = await IdempotencyChecker.markRequestStart(requestId, method, endpoint);

        if (requestStatus.exists && requestStatus.status === 'completed') {
            return res.status(200).json({
                success: true,
                message: '请求已处理',
                duplicate: true,
                requestId
            });
        }

        if (requestStatus.exists && requestStatus.status === 'processing') {
            return res.status(429).json({
                success: false,
                error: 'PROCESSING',
                message: '请求正在处理中，请稍后再试',
                requestId
            });
        }

        const { error, value } = logSchema.validate(req.body);
        if (error) {
            await IdempotencyChecker.markRequestFailed(requestId);
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: error.details[0].message
            });
        }

        const auditContext = getAuditContext(req);
        const log = await LogService.createLog(value, auditContext);

        await IdempotencyChecker.markRequestComplete(requestId);

        res.status(201).json({
            success: true,
            data: log,
            requestId
        });
    } catch (error) {
        console.error('创建日志失败:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

router.post('/batch', async (req, res) => {
    try {
        const { logs } = req.body;
        
        if (!Array.isArray(logs) || logs.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: '必须提供日志数组'
            });
        }

        const auditContext = getAuditContext(req);
        const result = await LogService.batchCreateLogs(logs, auditContext);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('批量创建日志失败:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

router.get('/', async (req, res) => {
    try {
        const filters = {
            level: req.query.level,
            source_type: req.query.source_type,
            status: req.query.status,
            startTime: req.query.startTime ? parseInt(req.query.startTime) : undefined,
            endTime: req.query.endTime ? parseInt(req.query.endTime) : undefined,
            search: req.query.search,
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            offset: req.query.offset ? parseInt(req.query.offset) : 0,
            sortBy: req.query.sortBy,
            sortOrder: req.query.sortOrder
        };

        const logs = await LogService.getLogs(filters);

        res.json({
            success: true,
            data: logs
        });
    } catch (error) {
        console.error('获取日志失败:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const filters = {
            startTime: req.query.startTime ? parseInt(req.query.startTime) : undefined,
            endTime: req.query.endTime ? parseInt(req.query.endTime) : undefined,
            level: req.query.level,
            source_type: req.query.source_type
        };

        const stats = await LogService.getLogStats(filters);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('获取统计失败:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const log = await LogService.getLog(req.params.id);
        res.json({
            success: true,
            data: log
        });
    } catch (error) {
        if (error.message === '日志不存在') {
            return res.status(404).json({
                success: false,
                error: 'NOT_FOUND',
                message: '日志不存在'
            });
        }
        console.error('获取日志详情失败:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

router.put('/:id', ConcurrencyControl.wrapRoute(async (req, res) => {
    try {
        const { error, value } = updateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: error.details[0].message
            });
        }

        const expectedVersion = parseInt(req.headers['x-expected-version']);
        if (!expectedVersion) {
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: '必须提供预期版本号 (X-Expected-Version 头)'
            });
        }

        const auditContext = getAuditContext(req);
        const result = await LogService.updateLog(
            req.params.id,
            value,
            expectedVersion,
            auditContext
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('更新日志失败:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
}));

router.delete('/:id', async (req, res) => {
    try {
        const auditContext = getAuditContext(req);
        await LogService.deleteLog(req.params.id, auditContext);

        res.json({
            success: true,
            message: '日志已删除'
        });
    } catch (error) {
        if (error.message === '日志不存在') {
            return res.status(404).json({
                success: false,
                error: 'NOT_FOUND',
                message: '日志不存在'
            });
        }
        console.error('删除日志失败:', error);
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

module.exports = router;
