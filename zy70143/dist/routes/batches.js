"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchRouter = batchRouter;
const express_1 = require("express");
const database_1 = require("../database");
const Batch_1 = require("../entities/Batch");
const Vulnerability_1 = require("../entities/Vulnerability");
const UpgradeTask_1 = require("../entities/UpgradeTask");
const BatchService_1 = require("../services/BatchService");
const logger_1 = require("../logger");
const logger = (0, logger_1.createAuditLogger)('BatchRoutes');
function batchRouter() {
    const router = (0, express_1.Router)();
    const getService = () => {
        return new BatchService_1.BatchService(database_1.AppDataSource.getRepository(Batch_1.Batch), database_1.AppDataSource.getRepository(Vulnerability_1.Vulnerability), database_1.AppDataSource.getRepository(UpgradeTask_1.UpgradeTask));
    };
    router.post('/', async (req, res) => {
        try {
            const service = getService();
            const batch = await service.createBatch({
                ...req.body,
                plannedDate: new Date(req.body.plannedDate)
            });
            logger.info('API: 创建批次成功', { batchId: batch.id });
            res.status(201).json({
                success: true,
                data: batch
            });
        }
        catch (error) {
            logger.error('API: 创建批次失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    router.get('/', async (req, res) => {
        try {
            const service = getService();
            const batches = await service.listBatches(req.query.status);
            res.json({
                success: true,
                data: batches
            });
        }
        catch (error) {
            logger.error('API: 查询批次失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    router.get('/:id', async (req, res) => {
        try {
            const service = getService();
            const batch = await service.getBatch(req.params.id);
            if (!batch) {
                res.status(404).json({
                    success: false,
                    error: '批次不存在'
                });
                return;
            }
            res.json({
                success: true,
                data: batch
            });
        }
        catch (error) {
            logger.error('API: 查询批次详情失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    router.post('/:id/add-vulnerability', async (req, res) => {
        try {
            const service = getService();
            const { vulnerabilityId } = req.body;
            await service.addVulnerabilityToBatch(req.params.id, vulnerabilityId);
            logger.info('API: 漏洞加入批次成功', { batchId: req.params.id, vulnerabilityId });
            res.json({
                success: true,
                message: '漏洞已成功加入批次'
            });
        }
        catch (error) {
            logger.error('API: 漏洞加入批次失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    router.get('/:id/vulnerabilities', async (req, res) => {
        try {
            const service = getService();
            const vulnerabilities = await service.getBatchVulnerabilities(req.params.id);
            res.json({
                success: true,
                data: vulnerabilities
            });
        }
        catch (error) {
            logger.error('API: 查询批次漏洞失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    router.get('/:id/health', async (req, res) => {
        try {
            const service = getService();
            const health = await service.checkBatchHealth(req.params.id);
            res.json({
                success: true,
                data: health
            });
        }
        catch (error) {
            logger.error('API: 查询批次健康状态失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    router.post('/:id/deploy', async (req, res) => {
        try {
            const service = getService();
            const batch = await service.deployBatch(req.params.id, req.body.deployedAt ? new Date(req.body.deployedAt) : undefined);
            logger.info('API: 批次上线成功', { batchId: req.params.id });
            res.json({
                success: true,
                data: batch
            });
        }
        catch (error) {
            logger.error('API: 批次上线失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    router.post('/tasks', async (req, res) => {
        try {
            const service = getService();
            const task = await service.createUpgradeTask(req.body);
            logger.info('API: 创建升级任务成功', { taskId: task.id });
            res.status(201).json({
                success: true,
                data: task
            });
        }
        catch (error) {
            logger.error('API: 创建升级任务失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    router.get('/tasks', async (req, res) => {
        try {
            const service = getService();
            const tasks = await service.getUpgradeTasks(req.query.vulnerabilityId, req.query.status);
            res.json({
                success: true,
                data: tasks
            });
        }
        catch (error) {
            logger.error('API: 查询升级任务失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    router.post('/tasks/:id/complete', async (req, res) => {
        try {
            const service = getService();
            const task = await service.completeUpgradeTask(req.params.id, req.body.notes);
            logger.info('API: 完成升级任务成功', { taskId: req.params.id });
            res.json({
                success: true,
                data: task
            });
        }
        catch (error) {
            logger.error('API: 完成升级任务失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    return router;
}
//# sourceMappingURL=batches.js.map