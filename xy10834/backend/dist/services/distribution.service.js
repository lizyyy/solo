"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistributionService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const errorHandler_1 = require("../middleware/errorHandler");
const types_1 = require("../types");
class DistributionService {
    async publishVersion(dto) {
        const config = await prisma_1.default.configItem.findUnique({
            where: { id: dto.configId },
        });
        if (!config) {
            throw new errorHandler_1.AppError('配置项不存在', 404);
        }
        if (config.status !== types_1.ConfigStatus.DRAFT) {
            throw new errorHandler_1.AppError('只有草稿状态的配置才能发布', 400);
        }
        const lastVersion = await prisma_1.default.distributionVersion.findFirst({
            where: { configId: dto.configId },
            orderBy: { version: 'desc' },
        });
        const newVersion = lastVersion ? lastVersion.version + 1 : 1;
        const result = await prisma_1.default.$transaction(async (tx) => {
            const distribution = await tx.distributionVersion.create({
                data: {
                    configId: dto.configId,
                    version: newVersion,
                    releasedBy: dto.releasedBy,
                    releaseNote: dto.releaseNote,
                    isForce: dto.isForce || false,
                },
            });
            await tx.configItem.update({
                where: { id: dto.configId },
                data: { status: types_1.ConfigStatus.PUBLISHED },
            });
            const instances = await tx.serviceInstance.findMany({
                where: { status: 'ONLINE' },
            });
            for (const instance of instances) {
                await tx.pullRecord.create({
                    data: {
                        configId: dto.configId,
                        instanceId: instance.id,
                        distributionId: distribution.id,
                        requestedVersion: newVersion,
                        pullStatus: types_1.PullStatus.PENDING,
                    },
                });
                await tx.effectiveState.upsert({
                    where: {
                        configId_instanceId: {
                            configId: dto.configId,
                            instanceId: instance.id,
                        },
                    },
                    create: {
                        configId: dto.configId,
                        instanceId: instance.id,
                        currentVersion: 0,
                        effectiveStatus: types_1.EffectiveStatus.NOT_EFFECTIVE,
                    },
                    update: {},
                });
            }
            return distribution;
        });
        return result;
    }
    async getAllVersions(params) {
        const { page = 1, pageSize = 20, configId } = params;
        const skip = (page - 1) * pageSize;
        const where = {};
        if (configId)
            where.configId = configId;
        const [items, total] = await Promise.all([
            prisma_1.default.distributionVersion.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { releasedAt: 'desc' },
                include: {
                    configItem: { select: { key: true, version: true } },
                    _count: {
                        select: { pullRecords: true },
                    },
                },
            }),
            prisma_1.default.distributionVersion.count({ where }),
        ]);
        return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
    }
    async getVersions(configId) {
        return prisma_1.default.distributionVersion.findMany({
            where: { configId },
            orderBy: { version: 'desc' },
            include: {
                _count: {
                    select: { pullRecords: true },
                },
            },
        });
    }
    async getVersionDetail(versionId) {
        const version = await prisma_1.default.distributionVersion.findUnique({
            where: { id: versionId },
            include: {
                configItem: true,
                pullRecords: {
                    include: { serviceInstance: true },
                    orderBy: { pulledAt: 'desc' },
                },
            },
        });
        if (!version) {
            throw new errorHandler_1.AppError('分发版本不存在', 404);
        }
        const successCount = version.pullRecords.filter((r) => r.pullStatus === types_1.PullStatus.SUCCESS).length;
        const failedCount = version.pullRecords.filter((r) => r.pullStatus === types_1.PullStatus.FAILED).length;
        const pendingCount = version.pullRecords.filter((r) => r.pullStatus === types_1.PullStatus.PENDING).length;
        return {
            ...version,
            stats: {
                total: version.pullRecords.length,
                success: successCount,
                failed: failedCount,
                pending: pendingCount,
            },
        };
    }
    async forceRefresh(configId) {
        const config = await prisma_1.default.configItem.findUnique({
            where: { id: configId },
        });
        if (!config) {
            throw new errorHandler_1.AppError('配置项不存在', 404);
        }
        const latestVersion = await prisma_1.default.distributionVersion.findFirst({
            where: { configId },
            orderBy: { version: 'desc' },
        });
        if (!latestVersion) {
            throw new errorHandler_1.AppError('该配置尚未发布过', 400);
        }
        const instances = await prisma_1.default.serviceInstance.findMany({
            where: { status: 'ONLINE' },
        });
        const result = await prisma_1.default.$transaction(async (tx) => {
            for (const instance of instances) {
                await tx.pullRecord.create({
                    data: {
                        configId,
                        instanceId: instance.id,
                        distributionId: latestVersion.id,
                        requestedVersion: latestVersion.version,
                        pullStatus: types_1.PullStatus.PENDING,
                    },
                });
                await tx.effectiveState.update({
                    where: {
                        configId_instanceId: { configId, instanceId: instance.id },
                    },
                    data: {
                        compensateStatus: types_1.CompensateStatus.IN_PROGRESS,
                    },
                });
            }
            return { refreshed: instances.length };
        });
        return result;
    }
}
exports.DistributionService = DistributionService;
exports.default = new DistributionService();
