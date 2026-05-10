import { ErrorSource } from '../types/enums';
import prisma from '../lib/prisma';
import { processTraceService } from './processTraceService';

interface CreateErrorSampleOptions {
  tenantId: string;
  serviceId?: string;
  endpointId?: string;
  source: ErrorSource;
  errorType?: string;
  errorMessage?: string;
  statusCode?: number;
  timestamp?: Date;
  durationMs?: number;
  requestId?: string;
  userId?: string;
  metadata?: Record<string, any>;
  operator?: string;
}

export const errorSampleService = {
  async create(options: CreateErrorSampleOptions) {
    const trace = await processTraceService.create({
      tenantId: options.tenantId,
      step: 'ERROR_SAMPLE_VALIDATION',
      status: 'IN_PROGRESS',
      currentCheckpoint: 'RECORDING',
      checkpointMessage: `正在记录错误样本`,
      operator: options.operator,
      metadata: { source: options.source, errorType: options.errorType },
    });

    try {
      const errorSample = await prisma.errorSample.create({
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

      await processTraceService.update(trace.id, {
        status: 'APPROVED',
        currentCheckpoint: 'RECORDED',
        checkpointMessage: `错误样本已记录: ${options.errorType || options.source}`,
      });

      return errorSample;
    } catch (error) {
      await processTraceService.update(trace.id, {
        status: 'REJECTED',
        currentCheckpoint: 'RECORD_FAILED',
        checkpointMessage: error instanceof Error ? error.message : '记录失败',
      });
      throw error;
    }
  },

  async list(tenantId: string, options: {
    isDeducted?: boolean; serviceId?: string; endpointId?: string; source?: ErrorSource; startDate?: Date; endDate?: Date; limit?: number } = {}) {
    const where: any = { tenantId };
    if (options.isDeducted !== undefined) where.isDeducted = options.isDeducted;
    if (options.serviceId) where.serviceId = options.serviceId;
    if (options.endpointId) where.endpointId = options.endpointId;
    if (options.source) where.source = options.source;
    if (options.startDate || options.endDate) {
      where.timestamp = {};
      if (options.startDate) where.timestamp.gte = options.startDate;
      if (options.endDate) where.timestamp.lte = options.endDate;
    }

    const samples = await prisma.errorSample.findMany({
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

  async getById(id: string) {
    const sample = await prisma.errorSample.findUnique({
      where: { id },
      include: {
        service: true,
        endpoint: true,
        budgetDeductions: {
          include: { budget: true },
        },
      },
    });

    if (!sample) return null;

    return {
      ...sample,
      metadata: sample.metadata ? JSON.parse(sample.metadata) : null,
    };
  },

  async getPendingDeductions(tenantId: string) {
    return prisma.errorSample.findMany({
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

  async getMatchingSLOConfig(tenantId: string, serviceId?: string, endpointId?: string) {
    const where: any = { tenantId, isActive: true };
    if (endpointId) where.endpointId = endpointId;
    else if (serviceId) where.serviceId = serviceId;

    return prisma.sLOConfiguration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },

  async batchRecordAndDeduct(
    tenantId: string,
    serviceId: string | undefined,
    endpointId: string | undefined,
    errorData: Omit<CreateErrorSampleOptions, 'tenantId' | 'serviceId' | 'endpointId'>
  ) {
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

      const { budgetService } = await import('./budgetService');
      const result = await budgetService.deductFromBudget(
        sloConfig.id,
        errorSample.id,
        {
          reason: `自动扣减错误样本: ${errorData.errorType || errorData.source}`,
          metadata: {
            statusCode: errorData.statusCode,
            durationMs: errorData.durationMs,
          },
          operator: errorData.operator,
        }
      );

      results.push({
        sloConfig,
        errorSample,
        deductionResult: result,
      });
    }

    return results;
  },
};
