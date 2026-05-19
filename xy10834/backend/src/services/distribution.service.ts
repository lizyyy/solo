import prisma from '../prisma';
import { AppError } from '../middleware/errorHandler';
import { ConfigStatus, PullStatus, EffectiveStatus, CompensateStatus } from '../types';

export interface PublishVersionDTO {
  configId: string;
  releasedBy?: string;
  releaseNote?: string;
  isForce?: boolean;
}

export class DistributionService {
  async publishVersion(dto: PublishVersionDTO) {
    const config = await prisma.configItem.findUnique({
      where: { id: dto.configId },
    });

    if (!config) {
      throw new AppError('配置项不存在', 404);
    }

    if (config.status !== ConfigStatus.DRAFT) {
      throw new AppError('只有草稿状态的配置才能发布', 400);
    }

    const lastVersion = await prisma.distributionVersion.findFirst({
      where: { configId: dto.configId },
      orderBy: { version: 'desc' },
    });

    const newVersion = lastVersion ? lastVersion.version + 1 : 1;

    const result = await prisma.$transaction(async (tx) => {
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
        data: { status: ConfigStatus.PUBLISHED },
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
            pullStatus: PullStatus.PENDING,
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
            effectiveStatus: EffectiveStatus.NOT_EFFECTIVE,
          },
          update: {},
        });
      }

      return distribution;
    });

    return result;
  }

  async getAllVersions(params: { page?: number; pageSize?: number; configId?: string }) {
    const { page = 1, pageSize = 20, configId } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (configId) where.configId = configId;

    const [items, total] = await Promise.all([
      prisma.distributionVersion.findMany({
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
      prisma.distributionVersion.count({ where }),
    ]);

    return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async getVersions(configId: string) {
    return prisma.distributionVersion.findMany({
      where: { configId },
      orderBy: { version: 'desc' },
      include: {
        _count: {
          select: { pullRecords: true },
        },
      },
    });
  }

  async getVersionDetail(versionId: string) {
    const version = await prisma.distributionVersion.findUnique({
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
      throw new AppError('分发版本不存在', 404);
    }

    const successCount = version.pullRecords.filter(
      (r) => r.pullStatus === PullStatus.SUCCESS
    ).length;
    const failedCount = version.pullRecords.filter(
      (r) => r.pullStatus === PullStatus.FAILED
    ).length;
    const pendingCount = version.pullRecords.filter(
      (r) => r.pullStatus === PullStatus.PENDING
    ).length;

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

  async forceRefresh(configId: string) {
    const config = await prisma.configItem.findUnique({
      where: { id: configId },
    });

    if (!config) {
      throw new AppError('配置项不存在', 404);
    }

    const latestVersion = await prisma.distributionVersion.findFirst({
      where: { configId },
      orderBy: { version: 'desc' },
    });

    if (!latestVersion) {
      throw new AppError('该配置尚未发布过', 400);
    }

    const instances = await prisma.serviceInstance.findMany({
      where: { status: 'ONLINE' },
    });

    const result = await prisma.$transaction(async (tx) => {
      for (const instance of instances) {
        await tx.pullRecord.create({
          data: {
            configId,
            instanceId: instance.id,
            distributionId: latestVersion.id,
            requestedVersion: latestVersion.version,
            pullStatus: PullStatus.PENDING,
          },
        });

        await tx.effectiveState.update({
          where: {
            configId_instanceId: { configId, instanceId: instance.id },
          },
          data: {
            compensateStatus: CompensateStatus.IN_PROGRESS,
          },
        });
      }

      return { refreshed: instances.length };
    });

    return result;
  }
}

export default new DistributionService();
