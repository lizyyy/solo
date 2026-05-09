import { prisma, SUSPEND_THRESHOLDS } from '../config';
import { SettlementBatchStatus, SuspendReason, ExceptionType } from '../constants';
import {
  ValidationError,
  ResourceNotFoundError,
  DuplicateOperationError,
  StatusTransitionError,
} from '../utils/error';
import { generateBatchNo, generateOperationNo } from '../utils/generator';
import { logger } from '../utils/logger';
import { feeRuleService } from './feeRuleService';
import { exceptionService } from './exceptionService';

interface TransactionInput {
  transactionNo: string;
  transactionDate: Date;
  amount: number;
  refundAmount?: number;
  chargebackAmount?: number;
  hasPendingRefund?: boolean;
  hasPendingChargeback?: boolean;
  isSuspicious?: boolean;
}

interface CreateBatchParams {
  merchantId: string;
  settlementDate: Date;
  transactions: TransactionInput[];
  operator: string;
  ipAddress?: string;
}

interface BatchValidationResult {
  canProceed: boolean;
  shouldSuspend: boolean;
  suspendReasons: SuspendReason[];
  warnings: string[];
  feeValidation?: {
    expectedFee: number;
    actualFee: number;
    isMismatch: boolean;
  };
}

class SettlementBatchService {
  async createBatch(params: CreateBatchParams) {
    const { merchantId, settlementDate, transactions, operator, ipAddress } = params;

    if (!transactions || transactions.length === 0) {
      throw new ValidationError('清算批次至少需要包含一笔交易');
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { feeRule: true },
    });

    if (!merchant) {
      throw new ResourceNotFoundError(`商户不存在: ${merchantId}`);
    }

    if (merchant.status !== 'ACTIVE') {
      throw new ValidationError(`商户状态非活跃: ${merchant.merchantNo}`);
    }

    const batchNo = generateBatchNo();

    const summary = this.calculateBatchSummary(transactions);

    let feeAmount = 0;
    if (merchant.feeRule) {
      const feeResult = await feeRuleService.calculateFee(summary.totalAmount, merchantId);
      feeAmount = feeResult.feeAmount;
    } else {
      feeAmount = this.sumTransactionFees(transactions);
    }

    const netAmount = summary.totalAmount - summary.refundAmount - summary.chargebackAmount - feeAmount;

    const batch = await prisma.$transaction(async (tx) => {
      const createdBatch = await tx.settlementBatch.create({
        data: {
          batchNo,
          merchantId,
          settlementDate,
          totalAmount: summary.totalAmount,
          refundAmount: summary.refundAmount,
          chargebackAmount: summary.chargebackAmount,
          feeAmount,
          netAmount,
          status: SettlementBatchStatus.PENDING,
        },
      });

      for (const txn of transactions) {
        const txnFee = merchant.feeRule
          ? (await feeRuleService.calculateFee(txn.amount, merchantId)).feeAmount
          : txn.amount * 0.01;

        await tx.batchTransaction.create({
          data: {
            transactionNo: txn.transactionNo,
            batchId: createdBatch.id,
            transactionDate: txn.transactionDate,
            amount: txn.amount,
            feeAmount: txnFee,
            refundAmount: txn.refundAmount || 0,
            chargebackAmount: txn.chargebackAmount || 0,
            hasPendingRefund: txn.hasPendingRefund || false,
            hasPendingChargeback: txn.hasPendingChargeback || false,
            isSuspicious: txn.isSuspicious || false,
          },
        });
      }

      await tx.operationLog.create({
        data: {
          operationNo: generateOperationNo(),
          batchId: createdBatch.id,
          operator,
          operationType: 'CREATE_BATCH',
          detail: `创建清算批次 ${batchNo}，共 ${transactions.length} 笔交易`,
          ipAddress,
        },
      });

      return createdBatch;
    });

    logger.info(`[${operator}] 创建清算批次: ${batchNo}`);
    return batch;
  }

  async validateAndProcessBatch(batchId: string, operator: string) {
    const batch = await prisma.settlementBatch.findUnique({
      where: { id: batchId },
      include: {
        merchant: { include: { feeRule: true } },
        transactions: true,
        exceptions: { where: { isResolved: false } },
      },
    });

    if (!batch) {
      throw new ResourceNotFoundError(`清算批次不存在: ${batchId}`);
    }

    if (batch.status !== SettlementBatchStatus.PENDING) {
      throw new StatusTransitionError(`批次状态 ${batch.status} 不能进行处理`);
    }

    const validation = await this.performBatchValidation(batchId);

    if (validation.shouldSuspend) {
      return this.suspendBatch(
        batchId,
        validation.suspendReasons[0],
        `自动挂起: ${validation.warnings.join('; ')}`,
        'system',
        null,
        true
      );
    }

    const updated = await prisma.settlementBatch.update({
      where: { id: batchId },
      data: { status: SettlementBatchStatus.PROCESSING },
    });

    await prisma.operationLog.create({
      data: {
        operationNo: generateOperationNo(),
        batchId,
        operator,
        operationType: 'VALIDATE_BATCH',
        detail: `批次校验通过，进入处理状态`,
      },
    });

    logger.info(`[${operator}] 批次 ${batch.batchNo} 校验通过`);
    return {
      batch: updated,
      validation,
      nextStep: '审批/出款',
    };
  }

  async performBatchValidation(batchId: string): Promise<BatchValidationResult> {
    const batch = await prisma.settlementBatch.findUnique({
      where: { id: batchId },
      include: {
        merchant: { include: { feeRule: true } },
        transactions: true,
      },
    });

    if (!batch) {
      throw new ResourceNotFoundError(`清算批次不存在: ${batchId}`);
    }

    const warnings: string[] = [];
    const suspendReasons: SuspendReason[] = [];

    const totalAmount = Number(batch.totalAmount);
    const refundRatio = totalAmount > 0 ? Number(batch.refundAmount) / totalAmount : 0;
    const chargebackRatio = totalAmount > 0 ? Number(batch.chargebackAmount) / totalAmount : 0;

    if (refundRatio > SUSPEND_THRESHOLDS.REFUND_RATIO) {
      suspendReasons.push(SuspendReason.REFUND);
      warnings.push(`退款比例 ${(refundRatio * 100).toFixed(2)}% 超过阈值 ${(SUSPEND_THRESHOLDS.REFUND_RATIO * 100)}%`);
      await exceptionService.createException({
        batchId,
        exceptionType: ExceptionType.REFUND_PENDING,
        severity: 'HIGH',
        message: `退款比例异常`,
        detail: `总金额 ${totalAmount}, 退款 ${batch.refundAmount}, 比例 ${(refundRatio * 100).toFixed(2)}%`,
      });
    }

    if (chargebackRatio > SUSPEND_THRESHOLDS.CHARGEBACK_RATIO) {
      suspendReasons.push(SuspendReason.CHARGEBACK);
      warnings.push(`拒付比例 ${(chargebackRatio * 100).toFixed(2)}% 超过阈值 ${(SUSPEND_THRESHOLDS.CHARGEBACK_RATIO * 100)}%`);
      await exceptionService.createException({
        batchId,
        exceptionType: ExceptionType.CHARGEBACK_PENDING,
        severity: 'HIGH',
        message: `拒付比例异常`,
        detail: `总金额 ${totalAmount}, 拒付 ${batch.chargebackAmount}, 比例 ${(chargebackRatio * 100).toFixed(2)}%`,
      });
    }

    const hasPendingRefund = batch.transactions.some(t => t.hasPendingRefund);
    const hasPendingChargeback = batch.transactions.some(t => t.hasPendingChargeback);

    if (hasPendingRefund) {
      suspendReasons.push(SuspendReason.REFUND);
      warnings.push('存在待处理退款');
    }

    if (hasPendingChargeback) {
      suspendReasons.push(SuspendReason.CHARGEBACK);
      warnings.push('存在待处理拒付');
    }

    let feeValidation: BatchValidationResult['feeValidation'];
    if (batch.merchant.feeRule) {
      const feeCheck = await feeRuleService.validateBatchFees(batchId);
      feeValidation = {
        expectedFee: feeCheck.expectedFee,
        actualFee: Number(batch.feeAmount),
        isMismatch: feeCheck.isMismatch,
      };

      if (feeCheck.isMismatch && totalAmount > SUSPEND_THRESHOLDS.MIN_AMOUNT_TO_CHECK) {
        suspendReasons.push(SuspendReason.FEE_ADJUSTMENT);
        warnings.push(`手续费不匹配: 期望 ${feeCheck.expectedFee}, 实际 ${batch.feeAmount}, 差异 ${feeCheck.difference}`);
        await exceptionService.createException({
          batchId,
          exceptionType: ExceptionType.FEE_MISMATCH,
          severity: 'MEDIUM',
          message: `手续费计算异常`,
          detail: `规则: ${feeCheck.ruleName}, 期望: ${feeCheck.expectedFee}, 实际: ${batch.feeAmount}`,
        });
      }
    }

    const uniqueReasons = [...new Set(suspendReasons)];

    return {
      canProceed: uniqueReasons.length === 0,
      shouldSuspend: uniqueReasons.length > 0,
      suspendReasons: uniqueReasons,
      warnings,
      feeValidation,
    };
  }

  async suspendBatch(
    batchId: string,
    reason: SuspendReason,
    note: string,
    operator: string,
    ipAddress?: string,
    isAuto: boolean = false
  ) {
    const batch = await prisma.settlementBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      throw new ResourceNotFoundError(`清算批次不存在: ${batchId}`);
    }

    if (batch.status === SettlementBatchStatus.SUSPENDED) {
      throw new DuplicateOperationError(`批次 ${batch.batchNo} 已处于挂起状态`);
    }

    if (![SettlementBatchStatus.PENDING, SettlementBatchStatus.PROCESSING].includes(batch.status)) {
      throw new StatusTransitionError(`批次状态 ${batch.status} 不能进行挂起操作`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.settlementBatch.update({
        where: { id: batchId },
        data: {
          status: SettlementBatchStatus.SUSPENDED,
          suspendReason: reason,
          suspendNote: note,
          suspendedAt: new Date(),
        },
      });

      await tx.operationLog.create({
        data: {
          operationNo: generateOperationNo(),
          batchId,
          operator,
          operationType: isAuto ? 'AUTO_SUSPEND' : 'MANUAL_SUSPEND',
          detail: `挂起批次: 原因=${reason}, 说明=${note}`,
          ipAddress,
        },
      });

      return b;
    });

    logger.warn(`[${operator}] ${isAuto ? '自动' : '手动'}挂起批次: ${batch.batchNo}`, { reason, note });
    return {
      batch: updated,
      action: 'SUSPENDED',
      reason,
      nextStep: '查看异常记录并申请解挂',
    };
  }

  async requestUnsuspend(
    batchId: string,
    requester: string,
    requestNote?: string,
    ipAddress?: string
  ) {
    const batch = await prisma.settlementBatch.findUnique({
      where: { id: batchId },
      include: { exceptions: { where: { isResolved: false } } },
    });

    if (!batch) {
      throw new ResourceNotFoundError(`清算批次不存在: ${batchId}`);
    }

    if (batch.status !== SettlementBatchStatus.SUSPENDED) {
      throw new StatusTransitionError(`只有挂起状态的批次才能申请解挂，当前状态: ${batch.status}`);
    }

    const pendingApproval = await prisma.approvalRecord.findFirst({
      where: {
        batchId,
        approvalType: 'UNSUSPEND',
        status: 'PENDING',
      },
    });

    if (pendingApproval) {
      throw new DuplicateOperationError('已有待审批的解挂申请');
    }

    const approval = await prisma.$transaction(async (tx) => {
      const a = await tx.approvalRecord.create({
        data: {
          batchId,
          approvalType: 'UNSUSPEND',
          status: 'PENDING',
          requester,
          requestNote,
        },
      });

      await tx.operationLog.create({
        data: {
          operationNo: generateOperationNo(),
          batchId,
          operator: requester,
          operationType: 'REQUEST_UNSUSPEND',
          detail: `申请解挂: ${requestNote || '无备注'}`,
          ipAddress,
        },
      });

      return a;
    });

    logger.info(`[${requester}] 申请解挂批次: ${batch.batchNo}`);
    return {
      approval,
      batch,
      pendingExceptions: batch.exceptions.length,
      nextStep: '等待审批人审批',
    };
  }

  async approveUnsuspend(
    approvalId: string,
    approver: string,
    approvalNote?: string,
    ipAddress?: string
  ) {
    const approval = await prisma.approvalRecord.findUnique({
      where: { id: approvalId },
      include: {
        batch: {
          include: { exceptions: { where: { isResolved: false } } },
        },
      },
    });

    if (!approval) {
      throw new ResourceNotFoundError(`审批记录不存在: ${approvalId}`);
    }

    if (approval.status !== 'PENDING') {
      throw new DuplicateOperationError(`该申请已 ${approval.status === 'APPROVED' ? '批准' : '拒绝'}`);
    }

    if (approval.batch.exceptions.length > 0) {
      const types = approval.batch.exceptions.map(e => e.exceptionType).join(', ');
      return {
        success: false,
        message: `存在未解决的异常: ${types}`,
        exceptionCount: approval.batch.exceptions.length,
        nextStep: '先在异常记录页面处理未解决异常',
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedApproval = await tx.approvalRecord.update({
        where: { id: approvalId },
        data: {
          status: 'APPROVED',
          approver,
          approvalNote,
          approvedAt: new Date(),
        },
      });

      const updatedBatch = await tx.settlementBatch.update({
        where: { id: approval.batchId },
        data: {
          status: SettlementBatchStatus.PROCESSING,
          suspendReason: null,
          suspendNote: null,
          suspendedAt: null,
        },
      });

      await tx.operationLog.create({
        data: {
          operationNo: generateOperationNo(),
          batchId: approval.batchId,
          operator: approver,
          operationType: 'APPROVE_UNSUSPEND',
          detail: `审批通过解挂: ${approvalNote || '无备注'}`,
          ipAddress,
        },
      });

      return { approval: updatedApproval, batch: updatedBatch };
    });

    logger.info(`[${approver}] 批准解挂: 批次 ${result.batch.batchNo}`);
    return {
      success: true,
      approval: result.approval,
      batch: result.batch,
      nextStep: '继续审批/出款流程',
    };
  }

  async rejectUnsuspend(
    approvalId: string,
    approver: string,
    approvalNote: string,
    ipAddress?: string
  ) {
    const approval = await prisma.approvalRecord.findUnique({
      where: { id: approvalId },
    });

    if (!approval) {
      throw new ResourceNotFoundError(`审批记录不存在: ${approvalId}`);
    }

    if (approval.status !== 'PENDING') {
      throw new DuplicateOperationError(`该申请已 ${approval.status === 'APPROVED' ? '批准' : '拒绝'}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.approvalRecord.update({
        where: { id: approvalId },
        data: {
          status: 'REJECTED',
          approver,
          approvalNote,
          approvedAt: new Date(),
        },
      });

      await tx.operationLog.create({
        data: {
          operationNo: generateOperationNo(),
          batchId: approval.batchId,
          operator: approver,
          operationType: 'REJECT_UNSUSPEND',
          detail: `拒绝解挂: ${approvalNote}`,
          ipAddress,
        },
      });

      return a;
    });

    logger.warn(`[${approver}] 拒绝解挂: ${approvalId}`);
    return updated;
  }

  async getBatchById(batchId: string) {
    const batch = await prisma.settlementBatch.findUnique({
      where: { id: batchId },
      include: {
        merchant: true,
        transactions: true,
        exceptions: { orderBy: { createdAt: 'desc' } },
        approvals: { orderBy: { requestedAt: 'desc' } },
        reports: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!batch) {
      throw new ResourceNotFoundError(`清算批次不存在: ${batchId}`);
    }

    return batch;
  }

  async getBatches(filters: {
    merchantId?: string;
    status?: SettlementBatchStatus;
    startDate?: Date;
    endDate?: Date;
  } = {}) {
    const where: any = {};

    if (filters.merchantId) {
      where.merchantId = filters.merchantId;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.startDate || filters.endDate) {
      where.settlementDate = {};
      if (filters.startDate) {
        where.settlementDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.settlementDate.lte = filters.endDate;
      }
    }

    return prisma.settlementBatch.findMany({
      where,
      include: { merchant: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private calculateBatchSummary(transactions: TransactionInput[]) {
    let totalAmount = 0;
    let refundAmount = 0;
    let chargebackAmount = 0;

    for (const txn of transactions) {
      totalAmount += txn.amount;
      refundAmount += txn.refundAmount || 0;
      chargebackAmount += txn.chargebackAmount || 0;
    }

    return { totalAmount, refundAmount, chargebackAmount };
  }

  private sumTransactionFees(transactions: TransactionInput[]): number {
    return transactions.reduce((sum, txn) => {
      return sum + txn.amount * 0.01;
    }, 0);
  }
}

export const settlementBatchService = new SettlementBatchService();
