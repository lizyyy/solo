"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportService = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const processTraceService_1 = require("./processTraceService");
const budgetCalculator_1 = require("../lib/budgetCalculator");
exports.reportService = {
    async generateBudgetReport(tenantId, options = {}) {
        const trace = await processTraceService_1.processTraceService.create({
            tenantId,
            step: 'REPORT_GENERATION',
            status: 'IN_PROGRESS',
            currentCheckpoint: 'GENERATING',
            checkpointMessage: '正在生成预算报表',
        });
        try {
            const where = { tenantId };
            if (options.startDate)
                where.windowStart = { gte: options.startDate };
            if (options.endDate)
                where.windowEnd = { lte: options.endDate };
            const budgets = await prisma_1.default.timeWindowBudget.findMany({
                where,
                orderBy: { windowStart: 'desc' },
                take: options.limit || 100,
                include: {
                    sloConfig: {
                        include: {
                            service: true,
                            endpoint: true,
                        },
                    },
                    deductions: {
                        orderBy: { deductedAt: 'desc' },
                    },
                },
            });
            const report = {
                generatedAt: new Date(),
                tenantId,
                totalBudgets: budgets.length,
                frozenBudgets: budgets.filter(b => b.isFrozen).length,
                exhaustedBudgets: budgets.filter(b => b.remainingBudget <= 0).length,
                warningBudgets: budgets.filter(b => b.remainingBudget > 0 && b.remainingBudget <= b.totalBudget * 0.2).length,
                healthyBudgets: budgets.filter(b => b.remainingBudget > b.totalBudget * 0.2).length,
                details: budgets.map(budget => ({
                    id: budget.id,
                    sloConfig: {
                        id: budget.sloConfig.id,
                        name: budget.sloConfig.name,
                        type: budget.sloConfig.type,
                        targetValue: budget.sloConfig.targetValue,
                    },
                    service: budget.sloConfig.service ? {
                        id: budget.sloConfig.service.id,
                        name: budget.sloConfig.service.name,
                    } : null,
                    endpoint: budget.sloConfig.endpoint ? {
                        id: budget.sloConfig.endpoint.id,
                        method: budget.sloConfig.endpoint.method,
                        path: budget.sloConfig.endpoint.path,
                    } : null,
                    window: {
                        type: budget.windowType,
                        start: budget.windowStart,
                        end: budget.windowEnd,
                    },
                    budget: {
                        total: budget.totalBudget,
                        used: budget.usedBudget,
                        remaining: budget.remainingBudget,
                        utilizationPercent: (0, budgetCalculator_1.calculateBudgetUtilization)(budget.usedBudget, budget.totalBudget),
                    },
                    isFrozen: budget.isFrozen,
                    frozenReason: budget.frozenReason,
                    deductionCount: budget.deductions.length,
                })),
            };
            await processTraceService_1.processTraceService.update(trace.id, {
                status: 'APPROVED',
                currentCheckpoint: 'GENERATED',
                checkpointMessage: `预算报表生成完成，共 ${budgets.length} 条记录`,
            });
            return report;
        }
        catch (error) {
            await processTraceService_1.processTraceService.update(trace.id, {
                status: 'REJECTED',
                currentCheckpoint: 'GENERATION_FAILED',
                checkpointMessage: error instanceof Error ? error.message : '生成失败',
            });
            throw error;
        }
    },
    async getErrorTrend(tenantId, options = {}) {
        const days = options.days || 7;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const where = {
            tenantId,
            timestamp: {
                gte: startDate,
                lte: endDate,
            },
        };
        if (options.serviceId)
            where.serviceId = options.serviceId;
        if (options.endpointId)
            where.endpointId = options.endpointId;
        const errors = await prisma_1.default.errorSample.findMany({
            where,
            orderBy: { timestamp: 'asc' },
        });
        const dailyStats = {};
        for (const error of errors) {
            const dayKey = error.timestamp.toISOString().split('T')[0];
            if (!dailyStats[dayKey]) {
                dailyStats[dayKey] = { total: 0, deducted: 0, sources: {} };
            }
            dailyStats[dayKey].total++;
            if (error.isDeducted)
                dailyStats[dayKey].deducted++;
            dailyStats[dayKey].sources[error.source] = (dailyStats[dayKey].sources[error.source] || 0) + 1;
        }
        return {
            period: { start: startDate, end: endDate },
            totalErrors: errors.length,
            deductedErrors: errors.filter(e => e.isDeducted).length,
            dailyStats,
        };
    },
    async getSLOCompliance(tenantId, sloConfigId) {
        const sloConfig = await prisma_1.default.sLOConfiguration.findUnique({
            where: { id: sloConfigId },
            include: {
                budgets: {
                    orderBy: { windowStart: 'desc' },
                    take: 10,
                },
            },
        });
        if (!sloConfig) {
            throw new Error('SLO 配置不存在');
        }
        const totalBudget = sloConfig.budgets.reduce((sum, b) => sum + b.totalBudget, 0);
        const usedBudget = sloConfig.budgets.reduce((sum, b) => sum + b.usedBudget, 0);
        const achievedRate = totalBudget > 0 ? (1 - usedBudget / totalBudget) * 100 : 100;
        return {
            sloConfig: {
                id: sloConfig.id,
                name: sloConfig.name,
                type: sloConfig.type,
                targetValue: sloConfig.targetValue,
                timeWindowType: sloConfig.timeWindowType,
            },
            compliance: {
                target: sloConfig.targetValue,
                achieved: Math.round(achievedRate * 100) / 100,
                isCompliant: achievedRate >= sloConfig.targetValue,
                delta: Math.round((achievedRate - sloConfig.targetValue) * 100) / 100,
            },
            history: sloConfig.budgets.map(budget => ({
                windowStart: budget.windowStart,
                windowEnd: budget.windowEnd,
                totalBudget: budget.totalBudget,
                usedBudget: budget.usedBudget,
                remainingBudget: budget.remainingBudget,
                achievementRate: budget.totalBudget > 0 ? (1 - budget.usedBudget / budget.totalBudget) * 100 : 100,
            })),
        };
    },
    async getProcessBlockers(tenantId) {
        const blockers = await prisma_1.default.processTrace.findMany({
            where: {
                tenantId,
                status: {
                    in: ['REJECTED', 'PENDING'],
                },
            },
            orderBy: { createdAt: 'desc' },
            include: {
                sloConfig: true,
            },
        });
        return {
            totalBlockers: blockers.length,
            blockers: blockers.map(blocker => ({
                id: blocker.id,
                step: blocker.step,
                status: blocker.status,
                checkpoint: blocker.currentCheckpoint,
                message: blocker.checkpointMessage,
                createdAt: blocker.createdAt,
                operator: blocker.operator,
                sloConfig: blocker.sloConfig ? {
                    id: blocker.sloConfig.id,
                    name: blocker.sloConfig.name,
                } : null,
                metadata: blocker.metadata ? JSON.parse(blocker.metadata) : null,
            })),
        };
    },
};
//# sourceMappingURL=reportService.js.map