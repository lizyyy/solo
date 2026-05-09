import { prisma } from '../config';
import { SettlementBatchStatus } from '../constants';
import { ResourceNotFoundError, StatusTransitionError, ValidationError } from '../utils/error';
import { generateReportNo, generateOperationNo } from '../utils/generator';
import { logger } from '../utils/logger';

class SettlementReportService {
  async approveForPayment(batchId: string, approver: string, ipAddress?: string) {
    const batch = await prisma.settlementBatch.findUnique({
      where: { id: batchId },
      include: {
        merchant: true,
        transactions: true,
        exceptions: { where: { isResolved: false } },
      },
    });

    if (!batch) {
      throw new ResourceNotFoundError(`清算批次不存在: ${batchId}`);
    }

    if (batch.status !== SettlementBatchStatus.PROCESSING) {
      throw new StatusTransitionError(`只有 PROCESSING 状态才能审批，当前: ${batch.status}`);
    }

    if (batch.exceptions.length > 0) {
      return {
        success: false,
        message: '存在未解决的异常，无法审批通过',
        exceptionCount: batch.exceptions.length,
        nextStep: '处理异常记录后重试',
      };
    }

    const approved = await prisma.$transaction(async (tx) => {
      const b = await tx.settlementBatch.update({
        where: { id: batchId },
        data: {
          status: SettlementBatchStatus.APPROVED,
          approvedBy: approver,
          approvedAt: new Date(),
        },
      });

      await tx.operationLog.create({
        data: {
          operationNo: generateOperationNo(),
          batchId,
          operator: approver,
          operationType: 'APPROVE_PAYMENT',
          detail: '审批通过，批次进入可出款状态',
          ipAddress,
        },
      });

      return b;
    });

    logger.info(`[${approver}] 审批通过: 批次 ${batch.batchNo}`);
    return {
      success: true,
      batch: approved,
      netAmount: approved.netAmount,
      nextStep: '生成出款报表',
    };
  }

  async generatePaymentReport(batchId: string, generatedBy: string, ipAddress?: string) {
    const batch = await prisma.settlementBatch.findUnique({
      where: { id: batchId },
      include: {
        merchant: true,
        transactions: true,
        exceptions: { where: { isResolved: false } },
      },
    });

    if (!batch) {
      throw new ResourceNotFoundError(`清算批次不存在: ${batchId}`);
    }

    if (batch.status !== SettlementBatchStatus.APPROVED) {
      throw new StatusTransitionError(`只有 APPROVED 状态才能生成报表，当前: ${batch.status}`);
    }

    if (batch.exceptions.length > 0) {
      throw new ValidationError('存在未解决的异常，无法生成出款报表');
    }

    const report = this.buildPaymentReport(batch);
    const reportNo = generateReportNo();

    const created = await prisma.$transaction(async (tx) => {
      const r = await tx.settlementReport.create({
        data: {
          reportNo,
          batchId,
          reportDate: new Date(),
          reportType: 'PAYMENT',
          content: JSON.stringify(report),
          generatedBy,
        },
      });

      await tx.operationLog.create({
        data: {
          operationNo: generateOperationNo(),
          batchId,
          operator: generatedBy,
          operationType: 'GENERATE_REPORT',
          detail: `生成出款报表 ${reportNo}`,
          ipAddress,
        },
      });

      return r;
    });

    logger.info(`[${generatedBy}] 生成出款报表: ${reportNo}`);
    return { report: created, reportData: report };
  }

  async markAsPaid(batchId: string, operator: string, ipAddress?: string) {
    const batch = await prisma.settlementBatch.findUnique({
      where: { id: batchId },
      include: { reports: true },
    });

    if (!batch) {
      throw new ResourceNotFoundError(`清算批次不存在: ${batchId}`);
    }

    if (batch.status === SettlementBatchStatus.PAID) {
      return { message: '批次已处于已出款状态', batch };
    }

    if (batch.status !== SettlementBatchStatus.APPROVED) {
      throw new StatusTransitionError(`只有 APPROVED 状态才能标记已出款，当前: ${batch.status}`);
    }

    const hasReport = batch.reports.some(r => r.reportType === 'PAYMENT');
    if (!hasReport) {
      throw new ValidationError('出款前必须先生成出款报表');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.settlementBatch.update({
        where: { id: batchId },
        data: {
          status: SettlementBatchStatus.PAID,
          paidAt: new Date(),
        },
      });

      await tx.operationLog.create({
        data: {
          operationNo: generateOperationNo(),
          batchId,
          operator,
          operationType: 'MARK_PAID',
          detail: '标记批次已出款',
          ipAddress,
        },
      });

      return b;
    });

    logger.info(`[${operator}] 标记已出款: 批次 ${batch.batchNo}`);
    return updated;
  }

  async getReportsByBatch(batchId: string) {
    return prisma.settlementReport.findMany({
      where: { batchId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDashboardStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalBatches, pendingBatches, suspendedBatches, approvedBatches, paidBatches, pendingExceptions] = await Promise.all([
      prisma.settlementBatch.count(),
      prisma.settlementBatch.count({ where: { status: SettlementBatchStatus.PENDING } }),
      prisma.settlementBatch.count({ where: { status: SettlementBatchStatus.SUSPENDED } }),
      prisma.settlementBatch.count({ where: { status: SettlementBatchStatus.APPROVED } }),
      prisma.settlementBatch.count({ where: { status: SettlementBatchStatus.PAID } }),
      prisma.exceptionRecord.count({ where: { isResolved: false } }),
    ]);

    const totalAmount = await prisma.settlementBatch.aggregate({
      _sum: {
        totalAmount: true,
        netAmount: true,
        refundAmount: true,
        chargebackAmount: true,
      },
      where: { createdAt: { gte: todayStart } },
    });

    return {
      overview: {
        totalBatches,
        pendingBatches,
        suspendedBatches,
        approvedBatches,
        paidBatches,
        pendingExceptions,
      },
      todaySummary: {
        totalAmount: totalAmount._sum.totalAmount ?? 0,
        netAmount: totalAmount._sum.netAmount ?? 0,
        refundAmount: totalAmount._sum.refundAmount ?? 0,
        chargebackAmount: totalAmount._sum.chargebackAmount ?? 0,
      },
    };
  }

  private buildPaymentReport(batch: any) {
    return {
      header: {
        reportType: 'PAYMENT_SETTLEMENT',
        reportDate: new Date().toISOString(),
        batchNo: batch.batchNo,
        merchant: {
          merchantNo: batch.merchant.merchantNo,
          name: batch.merchant.name,
        },
        settlementDate: batch.settlementDate,
      },
      amounts: {
        totalAmount: batch.totalAmount,
        refundAmount: batch.refundAmount,
        chargebackAmount: batch.chargebackAmount,
        feeAmount: batch.feeAmount,
        netAmount: batch.netAmount,
      },
      transactions: batch.transactions.map((t: any) => ({
        transactionNo: t.transactionNo,
        transactionDate: t.transactionDate,
        amount: t.amount,
        refundAmount: t.refundAmount,
        chargebackAmount: t.chargebackAmount,
        feeAmount: t.feeAmount,
      })),
      summary: {
        transactionCount: batch.transactions.length,
        status: batch.status,
        approvedAt: batch.approvedAt,
        approvedBy: batch.approvedBy,
      },
    };
  }
}

export const settlementReportService = new SettlementReportService();
