"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PullRecordService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const errorHandler_1 = require("../middleware/errorHandler");
const types_1 = require("../types");
class PullRecordService {
    async reportPullResult(dto) {
        const config = await prisma_1.default.configItem.findUnique({
            where: { id: dto.configId },
        });
        if (!config) {
            throw new errorHandler_1.AppError('配置项不存在', 404);
        }
        const instance = await prisma_1.default.serviceInstance.findUnique({
            where: { id: dto.instanceId },
        });
        if (!instance) {
            throw new errorHandler_1.AppError('服务实例不存在', 404);
        }
        const result = await prisma_1.default.$transaction(async (tx) => {
            const pullRecord = await tx.pullRecord.create({
                data: {
                    configId: dto.configId,
                    instanceId: dto.instanceId,
                    distributionId: dto.distributionId,
                    requestedVersion: dto.actualVersion,
                    actualVersion: dto.actualVersion,
                    pullStatus: dto.pullStatus,
                    errorMessage: dto.errorMessage,
                },
            });
            if (dto.pullStatus === types_1.PullStatus.SUCCESS) {
                const effectiveState = await tx.effectiveState.upsert({
                    where: {
                        configId_instanceId: {
                            configId: dto.configId,
                            instanceId: dto.instanceId,
                        },
                    },
                    create: {
                        configId: dto.configId,
                        instanceId: dto.instanceId,
                        currentVersion: dto.actualVersion,
                        effectiveStatus: dto.actualVersion >= config.version
                            ? types_1.EffectiveStatus.EFFECTIVE
                            : types_1.EffectiveStatus.NOT_EFFECTIVE,
                        lastConfirmedAt: new Date(),
                        pullRecordId: pullRecord.id,
                    },
                    update: {
                        currentVersion: dto.actualVersion,
                        effectiveStatus: dto.actualVersion >= config.version
                            ? types_1.EffectiveStatus.EFFECTIVE
                            : types_1.EffectiveStatus.NOT_EFFECTIVE,
                        lastConfirmedAt: new Date(),
                        pullRecordId: pullRecord.id,
                        compensateStatus: dto.actualVersion >= config.version
                            ? types_1.CompensateStatus.COMPLETED
                            : types_1.CompensateStatus.PENDING,
                        compensatedAt: dto.actualVersion >= config.version
                            ? new Date()
                            : null,
                    },
                });
                return { pullRecord, effectiveState };
            }
            return { pullRecord };
        });
        return result;
    }
    async findAll(params) {
        const { page = 1, pageSize = 20, configId, instanceId, pullStatus } = params;
        const skip = (page - 1) * pageSize;
        const where = {};
        if (configId)
            where.configId = configId;
        if (instanceId)
            where.instanceId = instanceId;
        if (pullStatus)
            where.pullStatus = pullStatus;
        const [records, total] = await Promise.all([
            prisma_1.default.pullRecord.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { pulledAt: 'desc' },
                include: {
                    configItem: { select: { key: true, version: true } },
                    serviceInstance: { select: { instanceId: true, serviceName: true, ipAddress: true } },
                },
            }),
            prisma_1.default.pullRecord.count({ where }),
        ]);
        return {
            records,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        };
    }
    async getFailedRecords(configId) {
        const where = {
            pullStatus: { in: [types_1.PullStatus.FAILED, types_1.PullStatus.TIMEOUT] },
        };
        if (configId)
            where.configId = configId;
        return prisma_1.default.pullRecord.findMany({
            where,
            include: {
                configItem: true,
                serviceInstance: true,
            },
            orderBy: { pulledAt: 'desc' },
        });
    }
    async retryFailed(recordId) {
        const record = await prisma_1.default.pullRecord.findUnique({
            where: { id: recordId },
            include: { distributionVersion: true },
        });
        if (!record) {
            throw new errorHandler_1.AppError('拉取记录不存在', 404);
        }
        if (record.retryCount >= 3) {
            throw new errorHandler_1.AppError('已达到最大重试次数', 400);
        }
        return prisma_1.default.pullRecord.update({
            where: { id: recordId },
            data: {
                retryCount: { increment: 1 },
                pullStatus: types_1.PullStatus.PENDING,
                nextRetryAt: new Date(Date.now() + 60000),
            },
        });
    }
    async detectOldValues(configId) {
        const config = await prisma_1.default.configItem.findUnique({
            where: { id: configId },
        });
        if (!config) {
            throw new errorHandler_1.AppError('配置项不存在', 404);
        }
        const oldValueInstances = await prisma_1.default.effectiveState.findMany({
            where: {
                configId,
                currentVersion: { lt: config.version },
                effectiveStatus: { not: types_1.EffectiveStatus.EFFECTIVE },
            },
            include: {
                serviceInstance: true,
            },
        });
        return {
            configVersion: config.version,
            oldValueCount: oldValueInstances.length,
            instances: oldValueInstances,
        };
    }
}
exports.PullRecordService = PullRecordService;
exports.default = new PullRecordService();
