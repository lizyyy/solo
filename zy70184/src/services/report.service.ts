import { prisma } from '../config/database';
import { PaymentStatus, BatchStatus, RefundReason } from '@prisma/client';
import dayjs from 'dayjs';

export interface BatchSummaryReport {
  totalBatches: number;
  totalAmount: string;
  totalPayments: number;
  successCount: number;
  successAmount: string;
  failCount: number;
  failAmount: string;
  refundCount: number;
  refundAmount: string;
  pendingCount: number;
  pendingAmount: string;
}

export interface DailyTrendItem {
  date: string;
  batchCount: number;
  amount: string;
  paymentCount: number;
  successCount: number;
  failCount: number;
}

export interface AccountReportItem {
  accountNumber: string;
  accountName: string;
  bankName: string;
  successCount: number;
  successAmount: string;
  failCount: number;
  failAmount: string;
}

export const reportService = {
  async getBatchSummary(startDate?: string, endDate?: string): Promise<BatchSummaryReport> {
    const where: Record<string, unknown> = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const batches = await prisma.paymentBatch.findMany({
      where,
      include: { payments: { include: { refunds: true } } },
    });

    let totalAmount = 0;
    let totalPayments = 0;
    let successCount = 0;
    let successAmount = 0;
    let failCount = 0;
    let failAmount = 0;
    let refundCount = 0;
    let refundAmount = 0;
    let pendingCount = 0;
    let pendingAmount = 0;

    for (const batch of batches) {
      totalAmount += parseFloat(batch.totalAmount.toString());
      totalPayments += batch.totalCount;

      for (const payment of batch.payments) {
        const amount = parseFloat(payment.amount.toString());
        
        if (payment.status === PaymentStatus.SUCCESS) {
          successCount++;
          successAmount += amount;
        } else if (payment.status === PaymentStatus.FAILED) {
          failCount++;
          failAmount += amount;
        } else if (payment.status === PaymentStatus.REFUNDED || payment.status === PaymentStatus.PARTIAL_REFUND) {
          refundCount++;
          const refunded = payment.refunds.reduce(
            (sum, r) => sum + parseFloat(r.amount.toString()),
            0
          );
          refundAmount += refunded;
          const remaining = amount - refunded;
          if (remaining > 0) {
            successAmount += remaining;
          }
        } else {
          pendingCount++;
          pendingAmount += amount;
        }
      }
    }

    return {
      totalBatches: batches.length,
      totalAmount: totalAmount.toFixed(2),
      totalPayments,
      successCount,
      successAmount: successAmount.toFixed(2),
      failCount,
      failAmount: failAmount.toFixed(2),
      refundCount,
      refundAmount: refundAmount.toFixed(2),
      pendingCount,
      pendingAmount: pendingAmount.toFixed(2),
    };
  },

  async getDailyTrend(days: number = 7): Promise<DailyTrendItem[]> {
    const startDate = dayjs().subtract(days - 1, 'day').startOf('day');
    const endDate = dayjs().endOf('day');

    const batches = await prisma.paymentBatch.findMany({
      where: {
        createdAt: {
          gte: startDate.toDate(),
          lte: endDate.toDate(),
        },
      },
      include: { payments: true },
    });

    const dailyMap = new Map<string, DailyTrendItem>();

    for (let i = 0; i < days; i++) {
      const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
      dailyMap.set(date, {
        date,
        batchCount: 0,
        amount: '0.00',
        paymentCount: 0,
        successCount: 0,
        failCount: 0,
      });
    }

    for (const batch of batches) {
      const date = dayjs(batch.createdAt).format('YYYY-MM-DD');
      const item = dailyMap.get(date);
      
      if (item) {
        item.batchCount++;
        item.amount = (parseFloat(item.amount) + parseFloat(batch.totalAmount.toString())).toFixed(2);
        item.paymentCount += batch.totalCount;
        
        for (const payment of batch.payments) {
          if (payment.status === PaymentStatus.SUCCESS) {
            item.successCount++;
          } else if (payment.status === PaymentStatus.FAILED || payment.status === PaymentStatus.REFUNDED) {
            item.failCount++;
          }
        }
      }
    }

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  },

  async getAccountReport(startDate?: string, endDate?: string): Promise<AccountReportItem[]> {
    const where: Record<string, unknown> = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const payments = await prisma.payment.findMany({
      where,
      include: { account: true, refunds: true },
    });

    const accountMap = new Map<string, AccountReportItem>();

    for (const payment of payments) {
      const key = payment.account.accountNumber;
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          accountNumber: payment.account.accountNumber,
          accountName: payment.account.accountName,
          bankName: payment.account.bankName,
          successCount: 0,
          successAmount: '0.00',
          failCount: 0,
          failAmount: '0.00',
        });
      }

      const item = accountMap.get(key)!;
      const amount = parseFloat(payment.amount.toString());

      if (payment.status === PaymentStatus.SUCCESS) {
        item.successCount++;
        item.successAmount = (parseFloat(item.successAmount) + amount).toFixed(2);
      } else if (payment.status === PaymentStatus.FAILED) {
        item.failCount++;
        item.failAmount = (parseFloat(item.failAmount) + amount).toFixed(2);
      } else if (payment.status === PaymentStatus.REFUNDED || payment.status === PaymentStatus.PARTIAL_REFUND) {
        item.failCount++;
        const refunded = payment.refunds.reduce(
          (sum, r) => sum + parseFloat(r.amount.toString()),
          0
        );
        item.failAmount = (parseFloat(item.failAmount) + refunded).toFixed(2);
        const remaining = amount - refunded;
        if (remaining > 0) {
          item.successCount++;
          item.successAmount = (parseFloat(item.successAmount) + remaining).toFixed(2);
        }
      }
    }

    return Array.from(accountMap.values()).sort((a, b) => 
      (parseFloat(b.successAmount) + parseFloat(b.failAmount)) - (parseFloat(a.successAmount) + parseFloat(a.failAmount))
    );
  },

  async getStatusBreakdown(): Promise<{
    batches: Record<string, number>;
    payments: Record<string, number>;
  }> {
    const [batches, payments] = await Promise.all([
      prisma.paymentBatch.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.payment.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const batchMap: Record<string, number> = {};
    const paymentMap: Record<string, number> = {};

    for (const item of batches) {
      batchMap[item.status] = item._count;
    }

    for (const item of payments) {
      paymentMap[item.status] = item._count;
    }

    return {
      batches: batchMap,
      payments: paymentMap,
    };
  },

  async getRefundSummary(startDate?: string, endDate?: string): Promise<{
    totalCount: number;
    totalAmount: string;
    byReason: Record<string, number>;
    byReasonAmount: Record<string, string>;
  }> {
    const where: Record<string, unknown> = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const refunds = await prisma.refund.findMany({
      where,
    });

    const byReason: Record<string, number> = {};
    const byReasonAmount: Record<string, string> = {};
    let totalAmount = 0;

    for (const refund of refunds) {
      const amount = parseFloat(refund.amount.toString());
      totalAmount += amount;

      if (!byReason[refund.reason]) {
        byReason[refund.reason] = 0;
        byReasonAmount[refund.reason] = '0.00';
      }

      byReason[refund.reason]++;
      byReasonAmount[refund.reason] = (
        parseFloat(byReasonAmount[refund.reason] || '0') + amount
      ).toFixed(2);
    }

    return {
      totalCount: refunds.length,
      totalAmount: totalAmount.toFixed(2),
      byReason,
      byReasonAmount,
    };
  },
};
