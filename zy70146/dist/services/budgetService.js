"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.budgetService = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const timeWindow_1 = require("../lib/timeWindow");
const budgetCalculator_1 = require("../lib/budgetCalculator");
const processTraceService_1 = require("./processTraceService");
function asSLOType(type) {
    return type;
}
function asTimeWindowType(type) {
    return type;
}
exports.budgetService = {
    async getOrCreateBudget(sloConfigId, referenceTime) {
        const sloConfig = await prisma_1.default.sLOConfiguration.findUnique({
            where: { id: sloConfigId },
        });
        if (!sloConfig) {
            throw new Error('SLO 配置不存在');
        }
        if (!sloConfig.isActive) {
            throw new Error('SLO 配置已停用');
        }
        const { start, end } = (0, timeWindow_1.getTimeWindowRange)(asTimeWindowType(sloConfig.timeWindowType), referenceTime);
        let budget = await prisma_1.default.timeWindowBudget.findFirst({
            where: {
                sloConfigId,
                windowStart: start,
            },
        });
        if (!budget) {
            const totalBudget = (0, budgetCalculator_1.calculateTotalBudget)(asSLOType(sloConfig.type), sloConfig.targetValue, asTimeWindowType(sloConfig.timeWindowType));
            budget = await prisma_1.default.timeWindowBudget.create({
                data: {
                    tenantId: sloConfig.tenantId,
                    sloConfigId,
                    windowStart: start,
                    windowEnd: end,
                    windowType: sloConfig.timeWindowType,
                    totalBudget,
                    remainingBudget: totalBudget,
                },
            });
        }
        return budget;
    },
    async deductFromBudget(sloConfigId, errorSampleId, options = {}) {
        const sloConfigPre = await prisma_1.default.sLOConfiguration.findUnique({
            where: { id: sloConfigId },
        });
        if (!sloConfigPre) {
            throw new Error('SLO 配置不存在');
        }
        const trace = await processTraceService_1.processTraceService.create({
            tenantId: sloConfigPre.tenantId,
            sloConfigId,
            step: 'BUDGET_DEDUCTION',
            status: 'IN_PROGRESS',
            currentCheckpoint: 'DEDUCTION_START',
            checkpointMessage: '开始执行预算扣减',
            operator: options.operator,
            metadata: { errorSampleId, reason: options.reason },
        });
        try {
            const budget = await this.getOrCreateBudget(sloConfigId);
            if (budget.isFrozen) {
                await processTraceService_1.processTraceService.update(trace.id, {
                    status: 'REJECTED',
                    currentCheckpoint: 'BUDGET_FROZEN',
                    checkpointMessage: `预算已被冻结: ${budget.frozenReason || '未知原因'}，无法扣减`,
                });
                throw new Error('预算已被冻结，无法扣减');
            }
            const sloConfig = await prisma_1.default.sLOConfiguration.findUnique({
                where: { id: sloConfigId },
            });
            const errorSample = await prisma_1.default.errorSample.findUnique({
                where: { id: errorSampleId },
            });
            if (!sloConfig || !errorSample) {
                await processTraceService_1.processTraceService.update(trace.id, {
                    status: 'REJECTED',
                    currentCheckpoint: 'DATA_MISSING',
                    checkpointMessage: 'SLO 配置或错误样本不存在',
                });
                throw new Error('SLO 配置或错误样本不存在');
            }
            if (errorSample.isDeducted) {
                await processTraceService_1.processTraceService.update(trace.id, {
                    status: 'REJECTED',
                    currentCheckpoint: 'ALREADY_DEDUCTED',
                    checkpointMessage: '该错误样本已被扣减过',
                });
                throw new Error('该错误样本已被扣减过');
            }
            const deductionAmount = (0, budgetCalculator_1.calculateDeductionAmount)(asSLOType(sloConfig.type), options.metadata);
            const actualDeduction = Math.min(deductionAmount, budget.remainingBudget);
            if (actualDeduction <= 0) {
                await prisma_1.default.errorSample.update({
                    where: { id: errorSampleId },
                    data: {
                        isDeducted: true,
                        deductedAt: new Date(),
                    },
                });
                await processTraceService_1.processTraceService.update(trace.id, {
                    status: 'APPROVED',
                    currentCheckpoint: 'NO_DEDUCTION_NEEDED',
                    checkpointMessage: '错误样本无需扣减预算（如延迟未超标）',
                });
                return {
                    budget,
                    deductionAmount: 0,
                    reason: '无需扣减',
                };
            }
            const newUsedBudget = budget.usedBudget + actualDeduction;
            const newRemainingBudget = budget.totalBudget - newUsedBudget;
            const updatedBudget = await prisma_1.default.timeWindowBudget.update({
                where: { id: budget.id },
                data: {
                    usedBudget: newUsedBudget,
                    remainingBudget: newRemainingBudget,
                },
            });
            await prisma_1.default.budgetDeduction.create({
                data: {
                    budgetId: budget.id,
                    errorSampleId,
                    deductedAmount: actualDeduction,
                    reason: options.reason,
                },
            });
            await prisma_1.default.errorSample.update({
                where: { id: errorSampleId },
                data: {
                    isDeducted: true,
                    deductedAt: new Date(),
                },
            });
            const remainingPercentage = (0, budgetCalculator_1.calculateBudgetPercentage)(newRemainingBudget, updatedBudget.totalBudget);
            await processTraceService_1.processTraceService.update(trace.id, {
                status: 'APPROVED',
                currentCheckpoint: 'DEDUCTION_COMPLETED',
                checkpointMessage: `预算扣减完成: 扣减 ${actualDeduction}，剩余 ${newRemainingBudget}/${updatedBudget.totalBudget} (${remainingPercentage}%)`,
            });
            return {
                budget: updatedBudget,
                deductionAmount: actualDeduction,
                remainingPercentage,
            };
        }
        catch (error) {
            await processTraceService_1.processTraceService.update(trace.id, {
                status: 'REJECTED',
                currentCheckpoint: 'DEDUCTION_FAILED',
                checkpointMessage: error instanceof Error ? error.message : '扣减失败',
            });
            throw error;
        }
    },
    async getBudgetStatus(sloConfigId, referenceTime) {
        const budget = await this.getOrCreateBudget(sloConfigId);
        const freezes = await prisma_1.default.budgetFreeze.findMany({
            where: {
                budgetId: budget.id,
                isActive: true,
            },
            orderBy: { frozenAt: 'desc' },
        });
        const suppressions = await prisma_1.default.alertSuppression.findMany({
            where: {
                budgetId: budget.id,
                isActive: true,
            },
            orderBy: { suppressedAt: 'desc' },
        });
        const recentDeductions = await prisma_1.default.budgetDeduction.findMany({
            where: { budgetId: budget.id },
            orderBy: { deductedAt: 'desc' },
            take: 10,
            include: { errorSample: true },
        });
        return {
            budget,
            freezes,
            suppressions,
            recentDeductions,
            utilization: {
                percentage: (budget.usedBudget / budget.totalBudget) * 100,
                remainingPercentage: (budget.remainingBudget / budget.totalBudget) * 100,
                isDepleted: budget.remainingBudget <= 0,
                isWarning: budget.remainingBudget <= budget.totalBudget * 0.2,
            },
        };
    },
    async listBudgets(tenantId, options = {}) {
        const where = { tenantId };
        if (options.isFrozen !== undefined)
            where.isFrozen = options.isFrozen;
        if (options.windowType)
            where.windowType = options.windowType;
        return prisma_1.default.timeWindowBudget.findMany({
            where,
            orderBy: { windowStart: 'desc' },
            take: options.limit || 50,
            include: {
                sloConfig: {
                    include: {
                        service: true,
                        endpoint: true,
                    },
                },
            },
        });
    },
};
//# sourceMappingURL=budgetService.js.map