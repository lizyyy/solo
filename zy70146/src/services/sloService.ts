import { SLOType, TimeWindowType, SLOTypeValues, TimeWindowTypeValues } from '../types/enums';
import prisma from '../lib/prisma';
import { processTraceService } from './processTraceService';

export const sloService = {
  async create(
    tenantId: string,
    name: string,
    type: SLOType,
    targetValue: number,
    timeWindowType: TimeWindowType,
    options: {
      serviceId?: string;
      endpointId?: string;
      description?: string;
      operator?: string;
    } = {}
  ) {
    const trace = await processTraceService.create({
      tenantId,
      step: 'SLO_CONFIG_REVIEW',
      status: 'IN_PROGRESS',
      currentCheckpoint: 'CREATION',
      checkpointMessage: `正在创建 SLO 配置: ${name}`,
      operator: options.operator,
    });

    try {
      if (targetValue <= 0 || targetValue > 100) {
        await processTraceService.update(trace.id, {
          status: 'REJECTED',
          currentCheckpoint: 'VALIDATION_FAILED',
          checkpointMessage: `SLO 目标值无效: ${targetValue}，应在 0-100 之间`,
        });
        throw new Error('SLO 目标值应在 0-100 之间');
      }

      const sloConfig = await prisma.sLOConfiguration.create({
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

      await processTraceService.update(trace.id, {
        sloConfigId: sloConfig.id,
        status: 'APPROVED',
        currentCheckpoint: 'CREATED',
        checkpointMessage: `SLO 配置创建成功: ${name}`,
      });

      return sloConfig;
    } catch (error) {
      await processTraceService.update(trace.id, {
        status: 'REJECTED',
        currentCheckpoint: 'CREATION_FAILED',
        checkpointMessage: error instanceof Error ? error.message : '创建失败',
      });
      throw error;
    }
  },

  async list(tenantId: string, options: { isActive?: boolean; serviceId?: string; endpointId?: string } = {}) {
    const where: any = { tenantId };
    if (options.isActive !== undefined) where.isActive = options.isActive;
    if (options.serviceId) where.serviceId = options.serviceId;
    if (options.endpointId) where.endpointId = options.endpointId;

    return prisma.sLOConfiguration.findMany({
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

  async getById(id: string) {
    return prisma.sLOConfiguration.findUnique({
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

  async update(id: string, data: { name?: string; targetValue?: number; description?: string; isActive?: boolean }) {
    return prisma.sLOConfiguration.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return prisma.sLOConfiguration.delete({
      where: { id },
    });
  },

  async activate(id: string) {
    return prisma.sLOConfiguration.update({
      where: { id },
      data: { isActive: true },
    });
  },

  async deactivate(id: string) {
    return prisma.sLOConfiguration.update({
      where: { id },
      data: { isActive: false },
    });
  },
};
