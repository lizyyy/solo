"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sloService = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const processTraceService_1 = require("./processTraceService");
exports.sloService = {
    async create(tenantId, name, type, targetValue, timeWindowType, options = {}) {
        const trace = await processTraceService_1.processTraceService.create({
            tenantId,
            step: 'SLO_CONFIG_REVIEW',
            status: 'IN_PROGRESS',
            currentCheckpoint: 'CREATION',
            checkpointMessage: `正在创建 SLO 配置: ${name}`,
            operator: options.operator,
        });
        try {
            if (targetValue <= 0 || targetValue > 100) {
                await processTraceService_1.processTraceService.update(trace.id, {
                    status: 'REJECTED',
                    currentCheckpoint: 'VALIDATION_FAILED',
                    checkpointMessage: `SLO 目标值无效: ${targetValue}，应在 0-100 之间`,
                });
                throw new Error('SLO 目标值应在 0-100 之间');
            }
            const sloConfig = await prisma_1.default.sLOConfiguration.create({
                data: {
                    tenantId,
                    name,
                    type,
                    targetValue,
                    timeWindowType,
                    serviceId: options.serviceId,
                    endpointId: options.endpointId,
                    description: options.description,
                },
            });
            await processTraceService_1.processTraceService.update(trace.id, {
                sloConfigId: sloConfig.id,
                status: 'APPROVED',
                currentCheckpoint: 'CREATED',
                checkpointMessage: `SLO 配置创建成功: ${name}`,
            });
            return sloConfig;
        }
        catch (error) {
            await processTraceService_1.processTraceService.update(trace.id, {
                status: 'REJECTED',
                currentCheckpoint: 'CREATION_FAILED',
                checkpointMessage: error instanceof Error ? error.message : '创建失败',
            });
            throw error;
        }
    },
    async list(tenantId, options = {}) {
        const where = { tenantId };
        if (options.isActive !== undefined)
            where.isActive = options.isActive;
        if (options.serviceId)
            where.serviceId = options.serviceId;
        if (options.endpointId)
            where.endpointId = options.endpointId;
        return prisma_1.default.sLOConfiguration.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                service: true,
                endpoint: true,
                _count: {
                    select: { budgets: true },
                },
            },
        });
    },
    async getById(id) {
        return prisma_1.default.sLOConfiguration.findUnique({
            where: { id },
            include: {
                service: true,
                endpoint: true,
                budgets: {
                    orderBy: { windowStart: 'desc' },
                    take: 5,
                },
            },
        });
    },
    async update(id, data) {
        return prisma_1.default.sLOConfiguration.update({
            where: { id },
            data,
        });
    },
    async delete(id) {
        return prisma_1.default.sLOConfiguration.delete({
            where: { id },
        });
    },
    async activate(id) {
        return prisma_1.default.sLOConfiguration.update({
            where: { id },
            data: { isActive: true },
        });
    },
    async deactivate(id) {
        return prisma_1.default.sLOConfiguration.update({
            where: { id },
            data: { isActive: false },
        });
    },
};
//# sourceMappingURL=sloService.js.map