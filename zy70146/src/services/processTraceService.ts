import { ProcessStatus, ProcessStep } from '../types/enums';
import prisma from '../lib/prisma';

interface CreateTraceOptions {
  tenantId: string;
  sloConfigId?: string;
  step: ProcessStep;
  status: ProcessStatus;
  currentCheckpoint?: string;
  checkpointMessage?: string;
  previousTraceId?: string;
  operator?: string;
  metadata?: Record<string, any>;
}

export const processTraceService = {
  async create(options: CreateTraceOptions) {
    return prisma.processTrace.create({
      data: {
        tenantId: options.tenantId,
        sloConfigId: options.sloConfigId,
        step: options.step,
        status: options.status,
        currentCheckpoint: options.currentCheckpoint,
        checkpointMessage: options.checkpointMessage,
        previousTraceId: options.previousTraceId,
        operator: options.operator,
        metadata: options.metadata ? JSON.stringify(options.metadata) : null,
      },
    });
  },

  async update(id: string, data: Partial<Omit<CreateTraceOptions, 'tenantId' | 'step'>>) {
    const updateData: any = {
      status: data.status,
      currentCheckpoint: data.currentCheckpoint,
      checkpointMessage: data.checkpointMessage,
      operator: data.operator,
    };
    if (data.sloConfigId !== undefined) updateData.sloConfigId = data.sloConfigId;
    if (data.metadata !== undefined) updateData.metadata = data.metadata ? JSON.stringify(data.metadata) : null;

    return prisma.processTrace.update({
      where: { id },
      data: updateData,
    });
  },

  async getById(id: string) {
    const trace = await prisma.processTrace.findUnique({
      where: { id },
    });
    if (!trace) return null;

    let previousTrace = null;
    if (trace.previousTraceId) {
      previousTrace = await prisma.processTrace.findUnique({
        where: { id: trace.previousTraceId },
      });
    }

    return {
      ...trace,
      metadata: trace.metadata ? JSON.parse(trace.metadata) : null,
      previousTrace,
    };
  },

  async list(tenantId: string, options: { step?: ProcessStep; status?: ProcessStatus; sloConfigId?: string; limit?: number } = {}) {
    const where: any = { tenantId };
    if (options.step) where.step = options.step;
    if (options.status) where.status = options.status;
    if (options.sloConfigId) where.sloConfigId = options.sloConfigId;

    const traces = await prisma.processTrace.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
    });

    return traces.map(trace => ({
      ...trace,
      metadata: trace.metadata ? JSON.parse(trace.metadata) : null,
    }));
  },

  async getCurrentBlocker(tenantId: string, sloConfigId?: string) {
    const blockers = await prisma.processTrace.findMany({
      where: {
        tenantId,
        ...(sloConfigId ? { sloConfigId } : {}),
        status: {
          in: ['REJECTED', 'PENDING'] as ProcessStatus[],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (blockers.length === 0) {
      return {
        hasBlocker: false,
      };
    }

    const blocker = blockers[0];
    let previousTrace = null;
    if (blocker.previousTraceId) {
      previousTrace = await prisma.processTrace.findUnique({
        where: { id: blocker.previousTraceId },
      });
    }

    return {
      hasBlocker: true,
      currentBlocker: {
        ...blocker,
        metadata: blocker.metadata ? JSON.parse(blocker.metadata) : null,
      },
      previousTrace: previousTrace ? {
        ...previousTrace,
        metadata: previousTrace.metadata ? JSON.parse(previousTrace.metadata) : null,
      } : null,
    };
  },

  async getTraceChain(traceId: string) {
    const chain: any[] = [];
    let currentId: string | null = traceId;

    while (currentId) {
      const traceRecord: any = await prisma.processTrace.findUnique({
        where: { id: currentId },
      });
      if (!traceRecord) break;
      
      chain.unshift({
        ...traceRecord,
        metadata: traceRecord.metadata ? JSON.parse(traceRecord.metadata) : null,
      });
      
      currentId = traceRecord.previousTraceId;
    }

    return chain;
  },
};
