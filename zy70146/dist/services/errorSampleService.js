"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorSampleService = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const processTraceService_1 = require("./processTraceService");
exports.errorSampleService = {
    async create(options) {
        const trace = await processTraceService_1.processTraceService.create({
            tenantId: options.tenantId,
            step: 'ERROR_SAMPLE_VALIDATION',
            status: 'IN_PROGRESS',
            currentCheckpoint: 'RECORDING',
            checkpointMessage: `正在记录错误样本`,
            operator: options.operator,
            metadata: { source: options.source, errorType: options.errorType },
        });
        try {
            const errorSample = await prisma_1.default.errorSample.create({
                data: {
                    tenantId: options.tenantId,
                    serviceId: options.serviceId,
                    endpointId: options.endpointId,
                    source: options.source,
                    errorType: options.errorType,
                    errorMessage: options.errorMessage,
                    statusCode: options.statusCode,
                    timestamp: options.timestamp || new Date(),
                    durationMs: options.durationMs,
                    requestId: options.requestId,
                    userId: options.userId,
                    metadata: options.metadata ? JSON.stringify(options.metadata) : null,
                },
            });
            await processTraceService_1.processTraceService.update(trace.id, {
                status: 'APPROVED',
                currentCheckpoint: 'RECORDED',
                checkpointMessage: `错误样本已记录: ${options.errorType || options.source}`,
            });
            return errorSample;
        }
        catch (error) {
            await processTraceService_1.processTraceService.update(trace.id, {
                status: 'REJECTED',
                currentCheckpoint: 'RECORD_FAILED',
                checkpointMessage: error instanceof Error ? error.message : '记录失败',
            });
            throw error;
        }
    },
    async list(tenantId, options = {}) {
        const where = { tenantId };
        if (options.isDeducted !== undefined)
            where.isDeducted = options.isDeducted;
        if (options.serviceId)
            where.serviceId = options.serviceId;
        if (options.endpointId)
            where.endpointId = options.endpointId;
        if (options.source)
            where.source = options.source;
        if (options.startDate || options.endDate) {
            where.timestamp = {};
            if (options.startDate)
                where.timestamp.gte = options.startDate;
            if (options.endDate)
                where.timestamp.lte = options.endDate;
        }
        const samples = await prisma_1.default.errorSample.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: options.limit || 100,
            include: {
                service: true,
                endpoint: true,
                budgetDeductions: true,
            },
        });
        return samples.map(sample => ({
            ...sample,
            metadata: sample.metadata ? JSON.parse(sample.metadata) : null,
        }));
    },
    async getById(id) {
        const sample = await prisma_1.default.errorSample.findUnique({
            where: { id },
            include: {
                service: true,
                endpoint: true,
                budgetDeductions: {
                    include: { budget: true },
                },
            },
        });
        if (!sample)
            return null;
        return {
            ...sample,
            metadata: sample.metadata ? JSON.parse(sample.metadata) : null,
        };
    },
    async getPendingDeductions(tenantId) {
        return prisma_1.default.errorSample.findMany({
            where: {
                tenantId,
                isDeducted: false,
            },
            orderBy: { timestamp: 'asc' },
            include: {
                service: true,
                endpoint: true,
            },
        });
    },
    async getMatchingSLOConfig(tenantId, serviceId, endpointId) {
        const where = { tenantId, isActive: true };
        if (endpointId)
            where.endpointId = endpointId;
        else if (serviceId)
            where.serviceId = serviceId;
        return prisma_1.default.sLOConfiguration.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
    },
    async batchRecordAndDeduct(tenantId, serviceId, endpointId, errorData) {
        const sloConfigs = await this.getMatchingSLOConfig(tenantId, serviceId, endpointId);
        if (sloConfigs.length === 0) {
            throw new Error('未找到匹配的 SLO 配置');
        }
        const results = [];
        for (const sloConfig of sloConfigs) {
            const errorSample = await this.create({
                tenantId,
                serviceId,
                endpointId,
                ...errorData,
            });
            const { budgetService } = await Promise.resolve().then(() => __importStar(require('./budgetService')));
            const result = await budgetService.deductFromBudget(sloConfig.id, errorSample.id, {
                reason: `自动扣减错误样本: ${errorData.errorType || errorData.source}`,
                metadata: {
                    statusCode: errorData.statusCode,
                    durationMs: errorData.durationMs,
                },
                operator: errorData.operator,
            });
            results.push({
                sloConfig,
                errorSample,
                deductionResult: result,
            });
        }
        return results;
    },
};
//# sourceMappingURL=errorSampleService.js.map