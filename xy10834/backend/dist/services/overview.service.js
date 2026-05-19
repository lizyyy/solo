"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverviewService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const types_1 = require("../types");
class OverviewService {
    async getStatistics() {
        const [configCount, instanceCount, pullRecords, effectiveStates, recentVersions,] = await Promise.all([
            prisma_1.default.configItem.count(),
            prisma_1.default.serviceInstance.count(),
            prisma_1.default.pullRecord.findMany({
                take: 1000,
                orderBy: { pulledAt: 'desc' },
            }),
            prisma_1.default.effectiveState.findMany(),
            prisma_1.default.distributionVersion.findMany({
                take: 10,
                orderBy: { releasedAt: 'desc' },
                include: { configItem: true },
            }),
        ]);
        const pullStats = {
            total: pullRecords.length,
            success: pullRecords.filter((r) => r.pullStatus === types_1.PullStatus.SUCCESS).length,
            failed: pullRecords.filter((r) => r.pullStatus === types_1.PullStatus.FAILED).length,
            pending: pullRecords.filter((r) => r.pullStatus === types_1.PullStatus.PENDING).length,
            timeout: pullRecords.filter((r) => r.pullStatus === types_1.PullStatus.TIMEOUT).length,
        };
        const effectiveStats = {
            total: effectiveStates.length,
            effective: effectiveStates.filter((s) => s.effectiveStatus === types_1.EffectiveStatus.EFFECTIVE).length,
            notEffective: effectiveStates.filter((s) => s.effectiveStatus === types_1.EffectiveStatus.NOT_EFFECTIVE).length,
            partial: effectiveStates.filter((s) => s.effectiveStatus === types_1.EffectiveStatus.PARTIAL).length,
            unknown: effectiveStates.filter((s) => s.effectiveStatus === types_1.EffectiveStatus.UNKNOWN).length,
        };
        const compensateStats = {
            total: effectiveStates.length,
            completed: effectiveStates.filter((s) => s.compensateStatus === types_1.CompensateStatus.COMPLETED).length,
            pending: effectiveStates.filter((s) => s.compensateStatus === types_1.CompensateStatus.PENDING).length,
            inProgress: effectiveStates.filter((s) => s.compensateStatus === types_1.CompensateStatus.IN_PROGRESS).length,
            failed: effectiveStates.filter((s) => s.compensateStatus === types_1.CompensateStatus.FAILED).length,
            notNeeded: effectiveStates.filter((s) => s.compensateStatus === types_1.CompensateStatus.NOT_NEEDED).length,
        };
        const oldValueCount = await this.detectAllOldValues();
        return {
            config: {
                total: configCount,
                published: await prisma_1.default.configItem.count({ where: { status: types_1.ConfigStatus.PUBLISHED } }),
                draft: await prisma_1.default.configItem.count({ where: { status: types_1.ConfigStatus.DRAFT } }),
            },
            instance: {
                total: instanceCount,
                online: await prisma_1.default.serviceInstance.count({ where: { status: types_1.InstanceStatus.ONLINE } }),
                offline: await prisma_1.default.serviceInstance.count({ where: { status: types_1.InstanceStatus.OFFLINE } }),
            },
            pull: pullStats,
            effective: effectiveStats,
            compensate: compensateStats,
            oldValueCount,
            recentVersions,
        };
    }
    async detectAllOldValues() {
        const configs = await prisma_1.default.configItem.findMany({
            where: { status: types_1.ConfigStatus.PUBLISHED },
        });
        let totalOldValues = 0;
        for (const config of configs) {
            const count = await prisma_1.default.effectiveState.count({
                where: {
                    configId: config.id,
                    currentVersion: { lt: config.version },
                },
            });
            totalOldValues += count;
        }
        return totalOldValues;
    }
    async getRecentActivity(limit = 20) {
        const [pullRecords, versions] = await Promise.all([
            prisma_1.default.pullRecord.findMany({
                take: limit,
                orderBy: { pulledAt: 'desc' },
                include: {
                    configItem: { select: { key: true } },
                    serviceInstance: { select: { instanceId: true, serviceName: true } },
                },
            }),
            prisma_1.default.distributionVersion.findMany({
                take: limit,
                orderBy: { releasedAt: 'desc' },
                include: { configItem: { select: { key: true } } },
            }),
        ]);
        const activities = [
            ...pullRecords.map((r) => ({
                type: 'PULL',
                time: r.pulledAt,
                data: r,
            })),
            ...versions.map((v) => ({
                type: 'PUBLISH',
                time: v.releasedAt,
                data: v,
            })),
        ];
        return activities
            .sort((a, b) => b.time.getTime() - a.time.getTime())
            .slice(0, limit);
    }
    async getFailedDetails() {
        const failedPulls = await prisma_1.default.pullRecord.findMany({
            where: {
                pullStatus: { in: [types_1.PullStatus.FAILED, types_1.PullStatus.TIMEOUT] },
            },
            include: {
                configItem: true,
                serviceInstance: true,
            },
            orderBy: { pulledAt: 'desc' },
        });
        const compensationPending = await prisma_1.default.effectiveState.findMany({
            where: {
                compensateStatus: { in: [types_1.CompensateStatus.PENDING, types_1.CompensateStatus.IN_PROGRESS] },
            },
            include: {
                configItem: true,
                serviceInstance: true,
            },
        });
        return {
            failedPulls,
            compensationPending,
        };
    }
}
exports.OverviewService = OverviewService;
exports.default = new OverviewService();
