import prisma from '../prisma';
import { PullStatus, EffectiveStatus, CompensateStatus, ConfigStatus, InstanceStatus } from '../types';

export class OverviewService {
  async getStatistics() {
    const [
      configCount,
      instanceCount,
      pullRecords,
      effectiveStates,
      recentVersions,
    ] = await Promise.all([
      prisma.configItem.count(),
      prisma.serviceInstance.count(),
      prisma.pullRecord.findMany({
        take: 1000,
        orderBy: { pulledAt: 'desc' },
      }),
      prisma.effectiveState.findMany(),
      prisma.distributionVersion.findMany({
        take: 10,
        orderBy: { releasedAt: 'desc' },
        include: { configItem: true },
      }),
    ]);

    const pullStats = {
      total: pullRecords.length,
      success: pullRecords.filter((r) => r.pullStatus === PullStatus.SUCCESS).length,
      failed: pullRecords.filter((r) => r.pullStatus === PullStatus.FAILED).length,
      pending: pullRecords.filter((r) => r.pullStatus === PullStatus.PENDING).length,
      timeout: pullRecords.filter((r) => r.pullStatus === PullStatus.TIMEOUT).length,
    };

    const effectiveStats = {
      total: effectiveStates.length,
      effective: effectiveStates.filter((s) => s.effectiveStatus === EffectiveStatus.EFFECTIVE).length,
      notEffective: effectiveStates.filter((s) => s.effectiveStatus === EffectiveStatus.NOT_EFFECTIVE).length,
      partial: effectiveStates.filter((s) => s.effectiveStatus === EffectiveStatus.PARTIAL).length,
      unknown: effectiveStates.filter((s) => s.effectiveStatus === EffectiveStatus.UNKNOWN).length,
    };

    const compensateStats = {
      total: effectiveStates.length,
      completed: effectiveStates.filter((s) => s.compensateStatus === CompensateStatus.COMPLETED).length,
      pending: effectiveStates.filter((s) => s.compensateStatus === CompensateStatus.PENDING).length,
      inProgress: effectiveStates.filter((s) => s.compensateStatus === CompensateStatus.IN_PROGRESS).length,
      failed: effectiveStates.filter((s) => s.compensateStatus === CompensateStatus.FAILED).length,
      notNeeded: effectiveStates.filter((s) => s.compensateStatus === CompensateStatus.NOT_NEEDED).length,
    };

    const oldValueCount = await this.detectAllOldValues();

    return {
      config: {
        total: configCount,
        published: await prisma.configItem.count({ where: { status: ConfigStatus.PUBLISHED } }),
        draft: await prisma.configItem.count({ where: { status: ConfigStatus.DRAFT } }),
      },
      instance: {
        total: instanceCount,
        online: await prisma.serviceInstance.count({ where: { status: InstanceStatus.ONLINE } }),
        offline: await prisma.serviceInstance.count({ where: { status: InstanceStatus.OFFLINE } }),
      },
      pull: pullStats,
      effective: effectiveStats,
      compensate: compensateStats,
      oldValueCount,
      recentVersions,
    };
  }

  private async detectAllOldValues() {
    const configs = await prisma.configItem.findMany({
      where: { status: ConfigStatus.PUBLISHED },
    });

    let totalOldValues = 0;

    for (const config of configs) {
      const count = await prisma.effectiveState.count({
        where: {
          configId: config.id,
          currentVersion: { lt: config.version },
        },
      });
      totalOldValues += count;
    }

    return totalOldValues;
  }

  async getRecentActivity(limit: number = 20) {
    const [pullRecords, versions] = await Promise.all([
      prisma.pullRecord.findMany({
        take: limit,
        orderBy: { pulledAt: 'desc' },
        include: {
          configItem: { select: { key: true } },
          serviceInstance: { select: { instanceId: true, serviceName: true } },
        },
      }),
      prisma.distributionVersion.findMany({
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
    const failedPulls = await prisma.pullRecord.findMany({
      where: {
        pullStatus: { in: [PullStatus.FAILED, PullStatus.TIMEOUT] },
      },
      include: {
        configItem: true,
        serviceInstance: true,
      },
      orderBy: { pulledAt: 'desc' },
    });

    const compensationPending = await prisma.effectiveState.findMany({
      where: {
        compensateStatus: { in: [CompensateStatus.PENDING, CompensateStatus.IN_PROGRESS] },
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

export default new OverviewService();
