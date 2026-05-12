import prisma from '../utils/prisma';
import { SettlementStatus } from '../types';
import { createObjectCsvWriter } from 'csv-writer';
import dayjs from 'dayjs';
import path from 'path';
import os from 'os';

export interface MerchantStatementDTO {
  merchantNo: string;
  startPeriod?: string;
  endPeriod?: string;
}

export interface SettlementDetailReportDTO {
  settlementNo: string;
}

export interface SummaryReportDTO {
  startDate: string;
  endDate: string;
}

export async function generateMerchantStatement(dto: MerchantStatementDTO) {
  const merchant = await prisma.merchant.findUnique({
    where: { merchantNo: dto.merchantNo },
  });

  if (!merchant) throw new Error('商户不存在');

  const where: any = { merchantId: merchant.id };

  if (dto.startPeriod) where.period = { gte: dto.startPeriod };
  if (dto.endPeriod) where.period = { ...where.period, lte: dto.endPeriod };

  const settlements = await prisma.settlement.findMany({
    where,
    orderBy: { period: 'asc' },
    include: {
      items: true,
      payments: true,
    },
  });

  const statement = {
    merchant: {
      merchantNo: merchant.merchantNo,
      name: merchant.name,
      bankAccount: merchant.bankAccount,
      bankName: merchant.bankName,
    },
    periods: [],
    summary: {
      totalOrderAmount: 0,
      totalRefundAmount: 0,
      totalServiceFee: 0,
      totalPenaltyAmount: 0,
      totalPayableAmount: 0,
      totalPaidAmount: 0,
      pendingAmount: 0,
    },
  };

  for (const settlement of settlements) {
    const periodData = {
      period: settlement.period,
      settlementNo: settlement.settlementNo,
      status: settlement.status,
      orderAmount: Number(settlement.orderAmount),
      refundAmount: Number(settlement.refundAmount),
      serviceFee: Number(settlement.serviceFee),
      penaltyAmount: Number(settlement.penaltyAmount),
      previousCarryOver: Number(settlement.previousCarryOver),
      totalAmount: Number(settlement.totalAmount),
      frozenAmount: Number(settlement.frozenAmount),
      payableAmount: Number(settlement.payableAmount),
      actualPaidAmount: Number(settlement.actualPaidAmount),
      nextCarryOver: Number(settlement.nextCarryOver),
      settlementDate: settlement.settlementDate,
      items: settlement.items.map(item => ({
        type: item.itemType,
        itemNo: item.itemNo,
        amount: Number(item.amount),
        description: item.description,
      })),
    };

    statement.periods.push(periodData);
    statement.summary.totalOrderAmount += periodData.orderAmount;
    statement.summary.totalRefundAmount += periodData.refundAmount;
    statement.summary.totalServiceFee += periodData.serviceFee;
    statement.summary.totalPenaltyAmount += periodData.penaltyAmount;
    statement.summary.totalPayableAmount += periodData.payableAmount;
    statement.summary.totalPaidAmount += periodData.actualPaidAmount;

    if (settlement.status !== SettlementStatus.PAID && settlement.status !== SettlementStatus.CANCELLED) {
      statement.summary.pendingAmount += periodData.payableAmount - periodData.actualPaidAmount;
    }
  }

  return statement;
}

export async function generateSettlementDetailReport(settlementNo: string) {
  const settlement = await prisma.settlement.findUnique({
    where: { settlementNo },
    include: {
      merchant: true,
      items: {
        orderBy: { createdAt: 'asc' },
      },
      payments: {
        include: {
          statusHistory: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' },
      },
      manualAdjustments: true,
    },
  });

  if (!settlement) throw new Error('结算单不存在');

  const orderItems = settlement.items.filter(i => i.itemType === 'ORDER');
  const refundItems = settlement.items.filter(i => i.itemType === 'REFUND');
  const serviceFeeItems = settlement.items.filter(i => i.itemType === 'SERVICE_FEE');
  const penaltyItems = settlement.items.filter(i => i.itemType === 'PENALTY');
  const carryOverItems = settlement.items.filter(i => i.itemType === 'CARRY_OVER');
  const manualItems = settlement.items.filter(i => i.itemType === 'MANUAL_ADJUSTMENT');

  return {
    merchant: {
      merchantNo: settlement.merchant.merchantNo,
      name: settlement.merchant.name,
      bankAccount: settlement.merchant.bankAccount,
      bankName: settlement.merchant.bankName,
    },
    settlement: {
      settlementNo: settlement.settlementNo,
      period: settlement.period,
      status: settlement.status,
      settlementDate: settlement.settlementDate,
      orderAmount: Number(settlement.orderAmount),
      refundAmount: Number(settlement.refundAmount),
      serviceFee: Number(settlement.serviceFee),
      penaltyAmount: Number(settlement.penaltyAmount),
      previousCarryOver: Number(settlement.previousCarryOver),
      totalAmount: Number(settlement.totalAmount),
      frozenAmount: Number(settlement.frozenAmount),
      payableAmount: Number(settlement.payableAmount),
      actualPaidAmount: Number(settlement.actualPaidAmount),
      nextCarryOver: Number(settlement.nextCarryOver),
    },
    details: {
      orderCount: orderItems.length,
      refundCount: refundItems.length,
      penaltyCount: penaltyItems.length,
      orderItems,
      refundItems,
      serviceFeeItems,
      penaltyItems,
      carryOverItems,
      manualAdjustments: manualItems,
    },
    statusHistory: settlement.statusHistory.map(h => ({
      oldStatus: h.oldStatus,
      newStatus: h.newStatus,
      reason: h.reason,
      operator: h.operator,
      time: h.createdAt,
    })),
    payments: settlement.payments.map(p => ({
      paymentNo: p.paymentNo,
      amount: Number(p.amount),
      status: p.status,
      bankAccount: p.bankAccount,
      bankName: p.bankName,
      payTime: p.payTime,
      failReason: p.failReason,
      statusHistory: p.statusHistory.map(h => ({
        oldStatus: h.oldStatus,
        newStatus: h.newStatus,
        reason: h.reason,
        operator: h.operator,
        time: h.createdAt,
      })),
    })),
  };
}

export async function exportSettlementDetailCSV(settlementNo: string): Promise<string> {
  const report = await generateSettlementDetailReport(settlementNo);

  const tempDir = os.tmpdir();
  const filePath = path.join(tempDir, `settlement_${settlementNo}_${dayjs().format('YYYYMMDDHHmmss')}.csv`);

  const headerRecords = [
    { id: 'merchantNo', title: '商户编号' },
    { id: 'merchantName', title: '商户名称' },
    { id: 'settlementNo', title: '结算单号' },
    { id: 'period', title: '账期' },
    { id: 'status', title: '结算状态' },
    { id: 'orderAmount', title: '订单金额' },
    { id: 'refundAmount', title: '退款金额' },
    { id: 'serviceFee', title: '服务费' },
    { id: 'penaltyAmount', title: '扣罚金额' },
    { id: 'previousCarryOver', title: '上期结转' },
    { id: 'totalAmount', title: '应结金额' },
    { id: 'frozenAmount', title: '冻结金额' },
    { id: 'payableAmount', title: '可结金额' },
    { id: 'actualPaidAmount', title: '实付金额' },
    { id: 'nextCarryOver', title: '本期结转' },
  ];

  const detailHeaders = [
    { id: 'type', title: '项目类型' },
    { id: 'itemNo', title: '关联单号' },
    { id: 'amount', title: '金额' },
    { id: 'description', title: '说明' },
  ];

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      ...headerRecords,
      ...detailHeaders,
    ],
  });

  const records: any[] = [];
  const settlementData = {
    merchantNo: report.merchant.merchantNo,
    merchantName: report.merchant.name,
    settlementNo: report.settlement.settlementNo,
    period: report.settlement.period,
    status: report.settlement.status,
    orderAmount: report.settlement.orderAmount,
    refundAmount: report.settlement.refundAmount,
    serviceFee: report.settlement.serviceFee,
    penaltyAmount: report.settlement.penaltyAmount,
    previousCarryOver: report.settlement.previousCarryOver,
    totalAmount: report.settlement.totalAmount,
    frozenAmount: report.settlement.frozenAmount,
    payableAmount: report.settlement.payableAmount,
    actualPaidAmount: report.settlement.actualPaidAmount,
    nextCarryOver: report.settlement.nextCarryOver,
  };

  for (const item of report.details.orderItems) {
    records.push({
      ...settlementData,
      type: '订单',
      itemNo: item.itemNo,
      amount: item.amount,
      description: item.description,
    });
  }

  for (const item of report.details.refundItems) {
    records.push({
      ...settlementData,
      type: '退款',
      itemNo: item.itemNo,
      amount: item.amount,
      description: item.description,
    });
  }

  for (const item of report.details.serviceFeeItems) {
    records.push({
      ...settlementData,
      type: '服务费',
      itemNo: item.itemNo,
      amount: item.amount,
      description: item.description,
    });
  }

  for (const item of report.details.penaltyItems) {
    records.push({
      ...settlementData,
      type: '扣罚',
      itemNo: item.itemNo,
      amount: item.amount,
      description: item.description,
    });
  }

  await csvWriter.writeRecords(records);

  return filePath;
}

export async function generateSummaryReport(dto: SummaryReportDTO) {
  const startDate = new Date(dto.startDate);
  const endDate = new Date(dto.endDate);

  const settlements = await prisma.settlement.findMany({
    where: {
      settlementDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      merchant: true,
    },
  });

  const merchantStats: Record<string, any> = {};

  for (const s of settlements) {
    if (!merchantStats[s.merchantId]) {
      merchantStats[s.merchantId] = {
        merchantNo: s.merchant.merchantNo,
        merchantName: s.merchant.name,
        settlementCount: 0,
        orderAmount: 0,
        refundAmount: 0,
        serviceFee: 0,
        penaltyAmount: 0,
        payableAmount: 0,
        paidAmount: 0,
      };
    }

    merchantStats[s.merchantId].settlementCount++;
    merchantStats[s.merchantId].orderAmount += Number(s.orderAmount);
    merchantStats[s.merchantId].refundAmount += Number(s.refundAmount);
    merchantStats[s.merchantId].serviceFee += Number(s.serviceFee);
    merchantStats[s.merchantId].penaltyAmount += Number(s.penaltyAmount);
    merchantStats[s.merchantId].payableAmount += Number(s.payableAmount);
    merchantStats[s.merchantId].paidAmount += Number(s.actualPaidAmount);
  }

  const totals = {
    merchantCount: Object.keys(merchantStats).length,
    orderAmount: 0,
    refundAmount: 0,
    serviceFee: 0,
    penaltyAmount: 0,
    payableAmount: 0,
    paidAmount: 0,
  };

  Object.values(merchantStats).forEach(s => {
    totals.orderAmount += s.orderAmount;
    totals.refundAmount += s.refundAmount;
    totals.serviceFee += s.serviceFee;
    totals.penaltyAmount += s.penaltyAmount;
    totals.payableAmount += s.payableAmount;
    totals.paidAmount += s.paidAmount;
  });

  return {
    period: {
      startDate: dto.startDate,
      endDate: dto.endDate,
    },
    totals,
    merchantDetails: Object.values(merchantStats),
  };
}
