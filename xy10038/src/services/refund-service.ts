import { Prisma, RefundStatus, Role, LogAction, BatchStatus } from '@prisma/client';
import prisma from '../config/prisma';
import logger from '../config/logger';
import { config } from '../config';
import { stateMachine } from './state-machine';
import {
  CreateRefundInput,
  UpdateRefundInput,
  RefundFilter,
  PaginatedResult,
  BatchActionInput
} from '../types';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  DuplicateRefundError,
  ValidationError
} from '../utils/errors';

export class RefundService {
  async generateRefundNo(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const prefix = config.refund.refundNoPrefix;
    
    const todayRefunds = await prisma.refund.count({
      where: {
        createdAt: {
          gte: new Date(year, date.getMonth(), day),
          lt: new Date(year, date.getMonth(), day + 1)
        }
      }
    });
    
    const sequence = String(todayRefunds + 1).padStart(4, '0');
    return `${prefix}${year}${month}${day}${sequence}`;
  }

  async checkDuplicateRefund(orderNo: string): Promise<void> {
    const existingRefund = await prisma.refund.findFirst({
      where: {
        orderNo,
        status: {
          notIn: ['SUCCESS', 'CANCELLED', 'REJECTED']
        }
      }
    });

    if (existingRefund) {
      throw new DuplicateRefundError(orderNo);
    }
  }

  async createRefund(
    input: CreateRefundInput,
    operatorId: string
  ): Promise<any> {
    if (input.amount <= 0) {
      throw new ValidationError('退款金额必须大于0');
    }

    await this.checkDuplicateRefund(input.orderNo);

    const refundNo = await this.generateRefundNo();

    const refund = await prisma.$transaction(async (tx) => {
      const newRefund = await tx.refund.create({
        data: {
          refundNo,
          orderNo: input.orderNo,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          amount: new Prisma.Decimal(input.amount),
          currency: input.currency || 'CNY',
          reason: input.reason,
          reasonDetail: input.reasonDetail,
          paymentMethod: input.paymentMethod,
          bankAccount: input.bankAccount,
          bankName: input.bankName,
          bankBranch: input.bankBranch,
          operatorId
        },
        include: {
          operator: true,
          statusHistories: true,
          logs: true
        }
      });

      await tx.refundStatusHistory.create({
        data: {
          refundId: newRefund.id,
          toStatus: 'DRAFT',
          changedBy: operatorId,
          changeReason: '创建退款单'
        }
      });

      await tx.refundLog.create({
        data: {
          refundId: newRefund.id,
          userId: operatorId,
          action: 'CREATE',
          details: `创建退款单 ${refundNo}`
        }
      });

      return newRefund;
    });

    logger.info(`创建退款单: ${refundNo}, 操作员: ${operatorId}`);
    return refund;
  }

  async getRefundById(id: string, includeRelations = true): Promise<any> {
    const include = includeRelations
      ? {
          operator: true,
          reviewedBy: true,
          approvedBy: true,
          batchOperation: true,
          statusHistories: {
            orderBy: { createdAt: 'desc' }
          },
          logs: {
            orderBy: { createdAt: 'desc' },
            include: { user: true }
          }
        }
      : undefined;

    const refund = await prisma.refund.findUnique({
      where: { id },
      include
    });

    if (!refund) {
      throw new NotFoundError('退款单不存在');
    }

    return refund;
  }

  async getRefundList(
    filter: RefundFilter
  ): Promise<PaginatedResult<any>> {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RefundWhereInput = {};

    if (filter.status && filter.status.length > 0) {
      where.status = { in: filter.status };
    }

    if (filter.reason && filter.reason.length > 0) {
      where.reason = { in: filter.reason };
    }

    if (filter.orderNo) {
      where.orderNo = { contains: filter.orderNo };
    }

    if (filter.refundNo) {
      where.refundNo = { contains: filter.refundNo };
    }

    if (filter.customerName) {
      where.customerName = { contains: filter.customerName };
    }

    if (filter.customerPhone) {
      where.customerPhone = { contains: filter.customerPhone };
    }

    if (filter.minAmount !== undefined) {
      where.amount = { gte: new Prisma.Decimal(filter.minAmount) };
    }

    if (filter.maxAmount !== undefined) {
      where.amount = { ...where.amount, lte: new Prisma.Decimal(filter.maxAmount) };
    }

    if (filter.startDate) {
      where.createdAt = { gte: filter.startDate };
    }

    if (filter.endDate) {
      where.createdAt = { ...where.createdAt, lte: filter.endDate };
    }

    if (filter.operatorId) {
      where.operatorId = filter.operatorId;
    }

    const orderBy: Prisma.RefundOrderByWithRelationInput[] = [
      { [filter.sortBy || 'createdAt']: filter.sortOrder || 'desc' }
    ];

    const [total, data] = await Promise.all([
      prisma.refund.count({ where }),
      prisma.refund.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          operator: true,
          reviewedBy: true,
          approvedBy: true
        }
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  async updateRefund(
    id: string,
    input: UpdateRefundInput,
    userId: string,
    userRole: Role
  ): Promise<any> {
    const refund = await this.getRefundById(id, false);

    if (!stateMachine.canEdit(refund.status)) {
      throw new BadRequestError(`当前状态 ${refund.status} 不允许编辑`);
    }

    if (input.status && input.status !== refund.status) {
      return this.transitionStatus(id, input.status, userId, userRole, input.changeReason);
    }

    const updateData: Prisma.RefundUpdateInput = {
      version: { increment: 1 }
    };

    if (input.orderNo) {
      if (input.orderNo !== refund.orderNo) {
        await this.checkDuplicateRefund(input.orderNo);
      }
      updateData.orderNo = input.orderNo;
    }

    if (input.customerName !== undefined) updateData.customerName = input.customerName;
    if (input.customerPhone !== undefined) updateData.customerPhone = input.customerPhone;
    if (input.amount !== undefined) {
      if (input.amount <= 0) throw new ValidationError('退款金额必须大于0');
      updateData.amount = new Prisma.Decimal(input.amount);
    }
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.reason !== undefined) updateData.reason = input.reason;
    if (input.reasonDetail !== undefined) updateData.reasonDetail = input.reasonDetail;
    if (input.paymentMethod !== undefined) updateData.paymentMethod = input.paymentMethod;
    if (input.bankAccount !== undefined) updateData.bankAccount = input.bankAccount;
    if (input.bankName !== undefined) updateData.bankName = input.bankName;
    if (input.bankBranch !== undefined) updateData.bankBranch = input.bankBranch;

    const updatedRefund = await prisma.$transaction(async (tx) => {
      const result = await tx.refund.update({
        where: { id },
        data: updateData,
        include: { operator: true, statusHistories: true, logs: true }
      });

      await tx.refundLog.create({
        data: {
          refundId: id,
          userId,
          action: 'UPDATE',
          details: `更新退款单 ${refund.refundNo}`
        }
      });

      return result;
    });

    logger.info(`更新退款单: ${refund.refundNo}, 用户: ${userId}`);
    return updatedRefund;
  }

  async transitionStatus(
    id: string,
    toStatus: RefundStatus,
    userId: string,
    userRole: Role,
    changeReason?: string
  ): Promise<any> {
    const refund = await this.getRefundById(id, false);
    const transition = stateMachine.validateTransition(refund.status, toStatus, userRole);

    const updatedRefund = await prisma.$transaction(async (tx) => {
      const updateData: Prisma.RefundUpdateInput = {
        status: toStatus,
        version: { increment: 1 }
      };

      if (toStatus === 'PENDING_REVIEW') {
        updateData.reviewedById = userId;
      }

      if (toStatus === 'APPROVED') {
        updateData.approvedById = userId;
      }

      if (toStatus === 'SUCCESS') {
        updateData.completedAt = new Date();
      }

      if (toStatus === 'FAILED') {
        await tx.failedRetry.create({
          data: {
            refundId: id,
            retryCount: 0,
            maxRetries: config.refund.maxRetries,
            errorMessage: changeReason || '退款处理失败',
            nextRetryAt: new Date(Date.now() + config.refund.retryDelayMinutes * 60 * 1000)
          }
        });
      }

      if (toStatus === 'PROCESSING' && refund.status === 'FAILED') {
        await tx.failedRetry.updateMany({
          where: { refundId: id, isResolved: false },
          data: {
            retryCount: { increment: 1 },
            lastError: changeReason,
            updatedAt: new Date()
          }
        });
      }

      const result = await tx.refund.update({
        where: { id },
        data: updateData,
        include: { operator: true, reviewedBy: true, approvedBy: true, statusHistories: true, logs: true }
      });

      await tx.refundStatusHistory.create({
        data: {
          refundId: id,
          fromStatus: refund.status,
          toStatus,
          changedBy: userId,
          changeReason: changeReason || transition.description
        }
      });

      await tx.refundLog.create({
        data: {
          refundId: id,
          userId,
          action: transition.action,
          details: `${transition.description}: ${refund.status} -> ${toStatus}`
        }
      });

      return result;
    });

    logger.info(`状态转换: ${refund.refundNo} ${refund.status} -> ${toStatus}, 用户: ${userId}`);
    return updatedRefund;
  }

  async submitForReview(id: string, userId: string, userRole: Role): Promise<any> {
    return this.transitionStatus(id, 'PENDING_REVIEW', userId, userRole, '提交审核');
  }

  async approve(id: string, userId: string, userRole: Role, reason?: string): Promise<any> {
    return this.transitionStatus(id, 'APPROVED', userId, userRole, reason || '审核通过');
  }

  async reject(id: string, userId: string, userRole: Role, reason?: string): Promise<any> {
    return this.transitionStatus(id, 'REJECTED', userId, userRole, reason || '审核拒绝');
  }

  async cancel(id: string, userId: string, userRole: Role, reason?: string): Promise<any> {
    return this.transitionStatus(id, 'CANCELLED', userId, userRole, reason || '取消退款');
  }

  async retry(id: string, userId: string, userRole: Role): Promise<any> {
    return this.transitionStatus(id, 'PROCESSING', userId, userRole, '重试退款');
  }

  async startProcessing(id: string, userId: string, userRole: Role): Promise<any> {
    return this.transitionStatus(id, 'PROCESSING', userId, userRole, '开始处理');
  }

  async markSuccess(id: string, userId: string, userRole: Role): Promise<any> {
    return this.transitionStatus(id, 'SUCCESS', userId, userRole, '退款成功');
  }

  async markFailed(id: string, userId: string, userRole: Role, errorMessage?: string): Promise<any> {
    return this.transitionStatus(id, 'FAILED', userId, userRole, errorMessage || '退款失败');
  }

  async getStatusHistory(refundId: string): Promise<any[]> {
    await this.getRefundById(refundId, false);

    return prisma.refundStatusHistory.findMany({
      where: { refundId },
      orderBy: { createdAt: 'asc' }
    });
  }

  async getLogs(refundId: string): Promise<any[]> {
    await this.getRefundById(refundId, false);

    return prisma.refundLog.findMany({
      where: { refundId },
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    });
  }

  async batchAction(
    input: BatchActionInput,
    userId: string,
    userRole: Role
  ): Promise<any> {
    if (input.refundIds.length === 0) {
      throw new BadRequestError('请选择要操作的退款单');
    }

    const operationType = `BATCH_${input.action.toUpperCase()}`;

    const batch = await prisma.batchOperation.create({
      data: {
        name: `批量${this.getActionLabel(input.action)}`,
        description: input.reason,
        status: 'PROCESSING',
        totalCount: input.refundIds.length,
        operationType,
        createdById: userId
      }
    });

    let successCount = 0;
    let failedCount = 0;
    const results: Array<{ id: string; success: boolean; message?: string }> = [];

    for (const refundId of input.refundIds) {
      try {
        let result;
        switch (input.action) {
          case 'submit':
            result = await this.submitForReview(refundId, userId, userRole);
            break;
          case 'approve':
            result = await this.approve(refundId, userId, userRole, input.reason);
            break;
          case 'reject':
            result = await this.reject(refundId, userId, userRole, input.reason);
            break;
          case 'cancel':
            result = await this.cancel(refundId, userId, userRole, input.reason);
            break;
          case 'retry':
            result = await this.retry(refundId, userId, userRole);
            break;
        }

        await prisma.refund.update({
          where: { id: refundId },
          data: { batchId: batch.id }
        });

        successCount++;
        results.push({ id: refundId, success: true });
      } catch (error: any) {
        failedCount++;
        results.push({ id: refundId, success: false, message: error.message });
        logger.error(`批量操作失败: ${refundId}, 错误: ${error.message}`);
      }
    }

    const finalStatus = failedCount === 0
      ? 'COMPLETED'
      : successCount === 0
      ? 'FAILED'
      : 'PARTIAL';

    await prisma.batchOperation.update({
      where: { id: batch.id },
      data: {
        status: finalStatus,
        successCount,
        failedCount,
        completedAt: new Date()
      }
    });

    logger.info(`批量操作完成: ${batch.id}, 成功: ${successCount}, 失败: ${failedCount}`);

    return {
      batchId: batch.id,
      status: finalStatus,
      total: input.refundIds.length,
      success: successCount,
      failed: failedCount,
      results
    };
  }

  private getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      submit: '提交审核',
      approve: '审核通过',
      reject: '审核拒绝',
      cancel: '取消',
      retry: '重试'
    };
    return labels[action] || action;
  }

  async getStatistics(): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [statusStats, todayStats, totalAmount] = await Promise.all([
      prisma.refund.groupBy({
        by: ['status'],
        _count: { status: true },
        _sum: { amount: true }
      }),
      prisma.refund.count({
        where: { createdAt: { gte: today } }
      }),
      prisma.refund.aggregate({
        _sum: { amount: true },
        where: { status: 'SUCCESS' }
      })
    ]);

    const stats: Record<string, { count: number; amount: number }> = {};
    const allStatuses: RefundStatus[] = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REJECTED'];

    allStatuses.forEach(s => {
      stats[s] = { count: 0, amount: 0 };
    });

    statusStats.forEach(s => {
      stats[s.status] = {
        count: s._count.status,
        amount: Number(s._sum.amount || 0)
      };
    });

    return {
      byStatus: stats,
      todayCount: todayStats,
      totalSuccessAmount: Number(totalAmount._sum.amount || 0)
    };
  }
}

export const refundService = new RefundService();
