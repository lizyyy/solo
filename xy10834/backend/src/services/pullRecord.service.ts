import prisma from '../prisma';
import { AppError } from '../middleware/errorHandler';
import { PullStatus, EffectiveStatus, CompensateStatus } from '../types';

export interface ReportPullResultDTO {
  configId: string;
  instanceId: string;
  distributionId?: string;
  actualVersion: number;
  pullStatus: PullStatus;
  errorMessage?: string;
}

export class PullRecordService {
  async reportPullResult(dto: ReportPullResultDTO) {
    const config = await prisma.configItem.findUnique({
      where: { id: dto.configId },
    });

    if (!config) {
      throw new AppError('配置项不存在', 404);
    }

    const instance = await prisma.serviceInstance.findUnique({
      where: { id: dto.instanceId },
    });

    if (!instance) {
      throw new AppError('服务实例不存在', 404);
    }

    const result = await prisma.$transaction(async (tx) => {
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

      if (dto.pullStatus === PullStatus.SUCCESS) {
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
              ? EffectiveStatus.EFFECTIVE
              : EffectiveStatus.NOT_EFFECTIVE,
            lastConfirmedAt: new Date(),
            pullRecordId: pullRecord.id,
          },
          update: {
            currentVersion: dto.actualVersion,
            effectiveStatus: dto.actualVersion >= config.version
              ? EffectiveStatus.EFFECTIVE
              : EffectiveStatus.NOT_EFFECTIVE,
            lastConfirmedAt: new Date(),
            pullRecordId: pullRecord.id,
            compensateStatus: dto.actualVersion >= config.version
              ? CompensateStatus.COMPLETED
              : CompensateStatus.PENDING,
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

  async findAll(params: {
    page?: number;
    pageSize?: number;
    configId?: string;
    instanceId?: string;
    pullStatus?: PullStatus;
  }) {
    const { page = 1, pageSize = 20, configId, instanceId, pullStatus } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (configId) where.configId = configId;
    if (instanceId) where.instanceId = instanceId;
    if (pullStatus) where.pullStatus = pullStatus;

    const [records, total] = await Promise.all([
      prisma.pullRecord.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { pulledAt: 'desc' },
        include: {
          configItem: { select: { key: true, version: true } },
          serviceInstance: { select: { instanceId: true, serviceName: true, ipAddress: true } },
        },
      }),
      prisma.pullRecord.count({ where }),
    ]);

    return {
      records,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getFailedRecords(configId?: string) {
    const where: any = {
      pullStatus: { in: [PullStatus.FAILED, PullStatus.TIMEOUT] },
    };
    if (configId) where.configId = configId;

    return prisma.pullRecord.findMany({
      where,
      include: {
        configItem: true,
        serviceInstance: true,
      },
      orderBy: { pulledAt: 'desc' },
    });
  }

  async retryFailed(recordId: string) {
    const record = await prisma.pullRecord.findUnique({
      where: { id: recordId },
      include: { distributionVersion: true },
    });

    if (!record) {
      throw new AppError('拉取记录不存在', 404);
    }

    if (record.retryCount >= 3) {
      throw new AppError('已达到最大重试次数', 400);
    }

    return prisma.pullRecord.update({
      where: { id: recordId },
      data: {
        retryCount: { increment: 1 },
        pullStatus: PullStatus.PENDING,
        nextRetryAt: new Date(Date.now() + 60000),
      },
    });
  }

  async detectOldValues(configId: string) {
    const config = await prisma.configItem.findUnique({
      where: { id: configId },
    });

    if (!config) {
      throw new AppError('配置项不存在', 404);
    }

    const oldValueInstances = await prisma.effectiveState.findMany({
      where: {
        configId,
        currentVersion: { lt: config.version },
        effectiveStatus: { not: EffectiveStatus.EFFECTIVE },
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

export default new PullRecordService();
