"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.delayRouter = delayRouter;
const express_1 = require("express");
const database_1 = require("../database");
const DelayRequest_1 = require("../entities/DelayRequest");
const RiskItem_1 = require("../entities/RiskItem");
const Vulnerability_1 = require("../entities/Vulnerability");
const DelayService_1 = require("../services/DelayService");
const logger_1 = require("../logger");
const logger = (0, logger_1.createAuditLogger)('DelayRoutes');
function delayRouter() {
    const router = (0, express_1.Router)();
    const getService = () => {
        return new DelayService_1.DelayService(database_1.AppDataSource.getRepository(DelayRequest_1.DelayRequest), database_1.AppDataSource.getRepository(RiskItem_1.RiskItem), database_1.AppDataSource.getRepository(Vulnerability_1.Vulnerability));
    };
    router.post('/', async (req, res) => {
        try {
            const service = getService();
            const { vulnerabilityId, requesterId, requesterName, newDueDate, reason, riskMitigation, isManualOverride } = req.body;
            const result = await service.createDelayRequest(vulnerabilityId, requesterId, requesterName, new Date(newDueDate), reason, riskMitigation, isManualOverride || false);
            logger.info('API: 创建延期申请成功', {
                requestId: result.request.id
            });
            res.status(201).json({
                success: true,
                data: result.request,
                warnings: result.warnings,
                additionalRisk: result.additionalRisk
            });
        }
        catch (error) {
            logger.error('API: 创建延期申请失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    router.get('/', async (req, res) => {
        try {
            const service = getService();
            const requests = await service.getDelayRequests(req.query.vulnerabilityId, req.query.status);
            res.json({
                success: true,
                data: requests
            });
        }
        catch (error) {
            logger.error('API: 查询延期申请失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    router.post('/:id/approve', async (req, res) => {
        try {
            const service = getService();
            const { approverId, approverName, comment } = req.body;
            const request = await service.approveDelayRequest(req.params.id, approverId, approverName, comment);
            logger.info('API: 审批延期申请成功', { requestId: req.params.id });
            res.json({
                success: true,
                data: request
            });
        }
        catch (error) {
            logger.error('API: 审批延期申请失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    router.post('/:id/reject', async (req, res) => {
        try {
            const service = getService();
            const { approverId, approverName, comment } = req.body;
            const request = await service.rejectDelayRequest(req.params.id, approverId, approverName, comment);
            logger.info('API: 拒绝延期申请成功', { requestId: req.params.id });
            res.json({
                success: true,
                data: request
            });
        }
        catch (error) {
            logger.error('API: 拒绝延期申请失败', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    });
    return router;
}
//# sourceMappingURL=delays.js.map