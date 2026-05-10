"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.freezeService = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const processTraceService_1 = require("./processTraceService");
exports.freezeService = {
    async freezeBudget(budgetId, reason, options = {}) {
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
            step: 'BUDGET_FREEZE',
            status: 'IN_PROGRESS',
            currentCheckpoint: 'FREEZE_START',
            checkpointMessage: `开始执行预算冻结`,
            operator: options.operator,
            metadata: { reason, description: options.description },
        });
        try {
            if (budget.isFrozen) {
                await processTraceService_1.processTraceService.update(trace.id, {
                    status: 'REJECTED',
                    currentCheckpoint: 'ALREADY_FROZEN',
                    checkpointMessage: '该预算已处于冻结状态',
                });
                throw new Error('该预算已处于冻结状态');
            }
            const freeze = await prisma_1.default.budgetFreeze.create({
                data: {
                    tenantId: budget.tenantId,
                    budgetId,
                    reason,
                    description: options.description,
                    frozenBy: options.operator,
                },
            });
            const updatedBudget = await prisma_1.default.timeWindowBudget.update({
                where: { id: budgetId },
                data: {
                    isFrozen: true,
                    frozenAt: new Date(),
                    frozenReason: reason,
                },
            });
            await processTraceService_1.processTraceService.update(trace.id, {
                status: 'APPROVED',
                currentCheckpoint: 'FROZEN',
                checkpointMessage: `预算已冻结: ${reason}`,
            });
            return {
                freeze,
                budget: updatedBudget,
            };
        }
        catch (error) {
            await processTraceService_1.processTraceService.update(trace.id, {
                status: 'REJECTED',
                currentCheckpoint: 'FREEZE_FAILED',
                checkpointMessage: error instanceof Error ? error.message : '冻结失败',
            });
            throw error;
        }
    },
    async unfreezeBudget(budgetId, options = {}) {
        const budget = await prisma_1.default.timeWindowBudget.findUnique({
            where: { id: budgetId },
            include: { sloConfig: true },
        });
        if (!budget) {
            throw new Error('预算记录不存在');
        }
        if (!budget.isFrozen) {
            throw new Error('该预算未处于冻结状态');
        }
        const activeFreezes = await prisma_1.default.budgetFreeze.findMany({
            where: {
                budgetId,
                isActive: true,
            },
        });
        for (const freeze of activeFreezes) {
            await prisma_1.default.budgetFreeze.update({
                where: { id: freeze.id },
                data: {
                    isActive: false,
                    unfrozenAt: new Date(),
                    unfrozenBy: options.operator,
                    unfreezeReason: options.reason,
                },
            });
        }
        const updatedBudget = await prisma_1.default.timeWindowBudget.update({
            where: { id: budgetId },
            data: {
                isFrozen: false,
                frozenAt: null,
                frozenReason: null,
            },
        });
        return {
            unfrozenFreezes: activeFreezes,
            budget: updatedBudget,
        };
    },
    async listFreezes(tenantId, options = {}) {
        const where = { tenantId };
        if (options.isActive !== undefined)
            where.isActive = options.isActive;
        if (options.budgetId)
            where.budgetId = options.budgetId;
        return prisma_1.default.budgetFreeze.findMany({
            where,
            orderBy: { frozenAt: 'desc' },
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
    async getActiveFreeze(budgetId) {
        return prisma_1.default.budgetFreeze.findFirst({
            where: {
                budgetId,
                isActive: true,
            },
            orderBy: { frozenAt: 'desc' },
        });
    },
};
//# sourceMappingURL=freezeService.js.map