"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.riskRouter = riskRouter;
const express_1 = require("express");
const database_1 = require("../database");
const RiskItem_1 = require("../entities/RiskItem");
const Vulnerability_1 = require("../entities/Vulnerability");
const RiskService_1 = require("../services/RiskService");
const logger_1 = require("../logger");
const logger = (0, logger_1.createAuditLogger)('RiskRoutes');
function riskRouter() {
    const router = (0, express_1.Router)();
    const getService = () => {
        return new RiskService_1.RiskService(database_1.AppDataSource.getRepository(RiskItem_1.RiskItem), database_1.AppDataSource.getRepository(Vulnerability_1.Vulnerability));
    };
    router.post('/', async (req, res) => {
        try {
            const service = getService();
            const riskItem = await service.createRiskItem({
                ...req.body,
                dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined
            });
            logger.info('API: 创建风险项成功', { riskId: riskItem.id });
            res.status(201).json({
                success: true,
                data: riskItem
            });
        }
        catch (error) {
            logger.error('API: 创建风险项失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    router.get('/', async (req, res) => {
        try {
            const service = getService();
            const filters = {
                status: req.query.status,
                level: req.query.level,
                vulnerabilityId: req.query.vulnerabilityId,
                ownerId: req.query.ownerId
            };
            const risks = await service.listRiskItems(filters);
            res.json({
                success: true,
                data: risks
            });
        }
        catch (error) {
            logger.error('API: 查询风险项失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    router.get('/dashboard', async (req, res) => {
        try {
            const service = getService();
            const dashboard = await service.getRiskDashboard();
            res.json({
                success: true,
                data: dashboard
            });
        }
        catch (error) {
            logger.error('API: 获取风险看板失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    router.get('/:id', async (req, res) => {
        try {
            const service = getService();
            const riskItem = await service.getRiskItem(req.params.id);
            if (!riskItem) {
                res.status(404).json({
                    success: false,
                    error: '风险项不存在'
                });
                return;
            }
            res.json({
                success: true,
                data: riskItem
            });
        }
        catch (error) {
            logger.error('API: 查询风险项详情失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    router.post('/:id/status', async (req, res) => {
        try {
            const service = getService();
            const { newStatus, resolutionNote, operatorId, operatorName } = req.body;
            const riskItem = await service.updateRiskStatus(req.params.id, newStatus, resolutionNote, operatorId, operatorName);
            logger.info('API: 更新风险项状态成功', { riskId: req.params.id, newStatus });
            res.json({
                success: true,
                data: riskItem
            });
        }
        catch (error) {
            logger.error('API: 更新风险项状态失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    return router;
}
//# sourceMappingURL=risks.js.map