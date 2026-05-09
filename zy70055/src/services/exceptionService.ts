import { Prisma } from '@prisma/client';
import { prisma } from '../config';
import { ExceptionType } from '../constants';
import { ResourceNotFoundError } from '../utils/error';
import { generateExceptionNo, generateOperationNo } from '../utils/generator';
import { logger } from '../utils/logger';

interface CreateExceptionParams {
  batchId: string;
  exceptionType: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  detail?: string;
  operator?: string;
  ipAddress?: string;
}

class ExceptionService {
  async createException(params: CreateExceptionParams) {
    const exceptionNo = generateExceptionNo();

    const exception = await prisma.exceptionRecord.create({
      data: {
        exceptionNo,
        batchId: params.batchId,
        exceptionType: params.exceptionType,
        severity: params.severity,
        message: params.message,
        detail: params.detail,
      },
    });

    await prisma.operationLog.create({
      data: {
        operationNo: generateOperationNo(),
        batchId: params.batchId,
        operator: params.operator || 'system',
        operationType: 'CREATE_EXCEPTION',
        detail: `创建异常记录: ${exceptionNo} - ${params.message}`,
        ipAddress: params.ipAddress,
      },
    });

    logger.warn(`异常记录创建: ${exceptionNo}`, { batchId: params.batchId, type: params.exceptionType });
    return exception;
  }

  async getExceptionsByBatch(batchId: string, includeResolved: boolean = false) {
    const where: Prisma.ExceptionRecordWhereInput = { batchId };
    if (!includeResolved) {
      where.isResolved = false;
    }

    return prisma.exceptionRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingExceptions() {
    return prisma.exceptionRecord.findMany({
      where: { isResolved: false },
      include: {
        batch: {
          include: { merchant: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveException(
    exceptionNo: string,
    resolvedBy: string,
    resolutionNote: string
  ) {
    const exception = await prisma.exceptionRecord.findUnique({
      where: { exceptionNo },
    });

    if (!exception) {
      throw new ResourceNotFoundError(`异常记录不存在: ${exceptionNo}`);
    }

    if (exception.isResolved) {
      return { message: '该异常已处于已解决状态', exception };
    }

    const resolved = await prisma.exceptionRecord.update({
      where: { exceptionNo },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy,
        resolutionNote,
      },
    });

    await prisma.operationLog.create({
      data: {
        operationNo: generateOperationNo(),
        batchId: exception.batchId,
        operator: resolvedBy,
        operationType: 'RESOLVE_EXCEPTION',
        detail: `解决异常: ${exceptionNo} - ${resolutionNote}`,
      },
    });

    logger.info(`异常已解决: ${exceptionNo}`, { resolvedBy });
    return resolved;
  }

  async getBatchExceptionSummary(batchId: string) {
    const exceptions = await prisma.exceptionRecord.findMany({
      where: { batchId },
    });

    const pending = exceptions.filter(e => !e.isResolved);
    const resolved = exceptions.filter(e => e.isResolved);

    const byType: Record<string, number> = {};
    for (const ex of exceptions) {
      byType[ex.exceptionType] = (byType[ex.exceptionType] || 0) + 1;
    }

    const bySeverity: Record<string, number> = {};
    for (const ex of exceptions) {
      bySeverity[ex.severity] = (bySeverity[ex.severity] || 0) + 1;
    }

    return {
      total: exceptions.length,
      pending: pending.length,
      resolved: resolved.length,
      byType,
      bySeverity,
      pendingTypes: [...new Set(pending.map(e => e.exceptionType))],
    };
  }

  async batchResolveExceptions(
    exceptionNos: string[],
    resolvedBy: string,
    resolutionNote: string
  ) {
    const results: { exceptionNo: string; success: boolean; message?: string }[] = [];

    for (const no of exceptionNos) {
      try {
        await this.resolveException(no, resolvedBy, resolutionNote);
        results.push({ exceptionNo: no, success: true });
      } catch (e: any) {
        results.push({ exceptionNo: no, success: false, message: e.message });
      }
    }

    return results;
  }
}

export const exceptionService = new ExceptionService();
