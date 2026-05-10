"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertSuppressionService = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const processTraceService_1 = require("./processTraceService");
exports.alertSuppressionService = {
    async suppressAlert(budgetId, alertType, reason, options = {}) {
        const budget = await prisma_1.default.timeWindowBudget.findUnique({
            where: { id: budgetId },
            include: { sloConfig: true },
        });
        if (!budget) {
            throw new Error('预算记录不存在');
        }
        const trace = await processTraceService_1.processTraceService.create({
            tenantId: budget.tenantId,
            sloConfigId: budget.sloConfigId,
            step: 'ALERT_SUPPRESSION',
            status: 'IN_PROGRESS',
            currentCheckpoint: 'SUPPRESSION_START',
            checkpointMessage: `开始执行告警抑制`,
            operator: options.operator,
            metadata: { alertType, reason, expiresAt: options.expiresAt },
        });
        try {
            const existingSuppression = await prisma_1.default.alertSuppression.findFirst({
                where: {
                    budgetId,
                    alertType,
                    isActive: true,
                },
            });
            if (existingSuppression) {
                await processTraceService_1.processTraceService.update(trace.id, {
                    status: 'REJECTED',
                    currentCheckpoint: 'ALREADY_SUPPRESSED',
                    checkpointMessage: `该告警类型 ${alertType} 已被抑制`,
                });
                throw new Error(`告警类型 ${alertType} 已被抑制`);
            }
            const suppression = await prisma_1.default.alertSuppression.create({
                data: {
                    tenantId: budget.tenantId,
                    budgetId,
                    alertType,
                    reason,
                    suppressedBy: options.operator,
                    expiresAt: options.expiresAt,
                },
            });
            await processTraceService_1.processTraceService.update(trace.id, {
                status: 'APPROVED',
                currentCheckpoint: 'SUPPRESSED',
                checkpointMessage: `告警 ${alertType} 已被抑制`,
            });
            return suppression;
        }
        catch (error) {
            await processTraceService_1.processTraceService.update(trace.id, {
                status: 'REJECTED',
                currentCheckpoint: 'SUPPRESSION_FAILED',
                checkpointMessage: error instanceof Error ? error.message : '抑制失败',
            });
            throw error;
        }
    },
    async unsuppressAlert(suppressionId, options = {}) {
        const suppression = await prisma_1.default.alertSuppression.findUnique({
            where: { id: suppressionId },
        });
        if (!suppression) {
            throw new Error('告警抑制记录不存在');
        }
        if (!suppression.isActive) {
            throw new Error('该告警抑制已失效');
        }
        return prisma_1.default.alertSuppression.update({
            where: { id: suppressionId },
            data: {
                isActive: false,
                unsuppressedAt: new Date(),
            },
        });
    },
    async listSuppressions(tenantId, options = {}) {
        const where = { tenantId };
        if (options.isActive !== undefined)
            where.isActive = options.isActive;
        if (options.budgetId)
            where.budgetId = options.budgetId;
        if (options.alertType)
            where.alertType = options.alertType;
        return prisma_1.default.alertSuppression.findMany({
            where,
            orderBy: { suppressedAt: 'desc' },
            take: options.limit || 50,
            include: {
                budget: {
                    include: {
                        sloConfig: true,
                    },
                },
            },
        });
    },
    async isAlertSuppressed(budgetId, alertType) {
        const now = new Date();
        const suppression = await prisma_1.default.alertSuppression.findFirst({
            where: {
                budgetId,
                alertType,
                isActive: true,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gte: now } },
                ],
            },
        });
        return !!suppression;
    },
    async getActiveSuppressions(budgetId) {
        const now = new Date();
        return prisma_1.default.alertSuppression.findMany({
            where: {
                budgetId,
                isActive: true,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gte: now } },
                ],
            },
            orderBy: { suppressedAt: 'desc' },
        });
    },
};
//# sourceMappingURL=alertSuppressionService.js.map