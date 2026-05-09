import { PrismaClient } from '@prisma/client';
import { SettlementBatchStatus, SuspendReason } from '../src/constants';

const prisma = new PrismaClient();

async function main() {
  console.log('开始清理旧数据...');
  await prisma.operationLog.deleteMany({});
  await prisma.exceptionRecord.deleteMany({});
  await prisma.batchTransaction.deleteMany({});
  await prisma.approvalRecord.deleteMany({});
  await prisma.settlementReport.deleteMany({});
  await prisma.settlementBatch.deleteMany({});
  await prisma.merchant.deleteMany({});
  await prisma.feeRule.deleteMany({});
  
  console.log('创建手续费规则...');
  
  const rule1 = await prisma.feeRule.create({
    data: {
      name: '标准百分比费率(1%)',
      feeType: 'PERCENTAGE',
      value: 1,
      minFee: 1,
      effectiveFrom: new Date('2024-01-01'),
    },
  });
  
  const rule2 = await prisma.feeRule.create({
    data: {
      name: '阶梯费率(0.8-0.5%)',
      feeType: 'TIERED',
      value: 0.8,
      minFee: 0.5,
      tierConfig: JSON.stringify({
        tiers: [
          { min: 0, max: 10000, rate: 0.8 },
          { min: 10000, max: 100000, rate: 0.6 },
          { min: 100000, max: null, rate: 0.5 },
        ],
      }),
      effectiveFrom: new Date('2024-01-01'),
    },
  });
  
  const rule3 = await prisma.feeRule.create({
    data: {
      name: 'VIP费率(0.3%)',
      feeType: 'PERCENTAGE',
      value: 0.3,
      minFee: 0.1,
      maxFee: 100,
      effectiveFrom: new Date('2024-01-01'),
    },
  });
  
  console.log('创建商户...');
  
  const merchant1 = await prisma.merchant.create({
    data: {
      merchantNo: 'MCH001',
      name: '阳光百货有限公司',
      status: 'ACTIVE',
      feeRuleId: rule1.id,
    },
  });
  
  const merchant2 = await prisma.merchant.create({
    data: {
      merchantNo: 'MCH002',
      name: '星辰电商平台',
      status: 'ACTIVE',
      feeRuleId: rule2.id,
    },
  });
  
  const merchant3 = await prisma.merchant.create({
    data: {
      merchantNo: 'MCH003',
      name: '银河网络科技',
      status: 'ACTIVE',
      feeRuleId: rule3.id,
    },
  });
  
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(today.getTime() - 48 * 60 * 60 * 1000);
  
  console.log('样例1: 正常处理批次 (无异常)');
  
  const batch1 = await prisma.settlementBatch.create({
    data: {
      batchNo: `BATCH-NORMAL-${Date.now()}`,
      merchantId: merchant1.id,
      settlementDate: today,
      totalAmount: 10000,
      refundAmount: 0,
      chargebackAmount: 0,
      feeAmount: 100,
      netAmount: 9900,
      status: SettlementBatchStatus.APPROVED,
      approvedBy: 'admin',
      approvedAt: new Date(),
    },
  });
  
  await prisma.batchTransaction.createMany({
    data: [
      {
        transactionNo: 'TXN001',
        batchId: batch1.id,
        transactionDate: yesterday,
        amount: 5000,
        feeAmount: 50,
        refundAmount: 0,
        chargebackAmount: 0,
      },
      {
        transactionNo: 'TXN002',
        batchId: batch1.id,
        transactionDate: yesterday,
        amount: 3000,
        feeAmount: 30,
        refundAmount: 0,
        chargebackAmount: 0,
      },
      {
        transactionNo: 'TXN003',
        batchId: batch1.id,
        transactionDate: yesterday,
        amount: 2000,
        feeAmount: 20,
        refundAmount: 0,
        chargebackAmount: 0,
      },
    ],
  });
  
  console.log('样例2: 高退款比例 (自动挂起)');
  
  const batch2 = await prisma.settlementBatch.create({
    data: {
      batchNo: `BATCH-SUSPEND-REFUND-${Date.now()}`,
      merchantId: merchant2.id,
      settlementDate: today,
      totalAmount: 20000,
      refundAmount: 3000,
      chargebackAmount: 0,
      feeAmount: 170,
      netAmount: 16830,
      status: SettlementBatchStatus.SUSPENDED,
      suspendReason: SuspendReason.REFUND,
      suspendNote: '退款比例 15% 超过阈值 10%',
      suspendedAt: new Date(),
    },
  });
  
  await prisma.batchTransaction.createMany({
    data: [
      {
        transactionNo: 'TXN004',
        batchId: batch2.id,
        transactionDate: yesterday,
        amount: 10000,
        feeAmount: 80,
        refundAmount: 2000,
        chargebackAmount: 0,
      },
      {
        transactionNo: 'TXN005',
        batchId: batch2.id,
        transactionDate: yesterday,
        amount: 5000,
        feeAmount: 40,
        refundAmount: 1000,
        chargebackAmount: 0,
        hasPendingRefund: true,
      },
      {
        transactionNo: 'TXN006',
        batchId: batch2.id,
        transactionDate: yesterday,
        amount: 5000,
        feeAmount: 50,
        refundAmount: 0,
        chargebackAmount: 0,
      },
    ],
  });
  
  await prisma.exceptionRecord.create({
    data: {
      exceptionNo: `EXC-REFUND-${Date.now()}`,
      batchId: batch2.id,
      exceptionType: 'REFUND_PENDING',
      severity: 'HIGH',
      message: '退款比例异常',
      detail: '总金额 20000, 退款 3000, 比例 15.00%',
    },
  });
  
  console.log('样例3: 有拒付 (已部分处理)');
  
  const batch3 = await prisma.settlementBatch.create({
    data: {
      batchNo: `BATCH-SUSPEND-CB-${Date.now()}`,
      merchantId: merchant3.id,
      settlementDate: twoDaysAgo,
      totalAmount: 50000,
      refundAmount: 1000,
      chargebackAmount: 4000,
      feeAmount: 100,
      netAmount: 44900,
      status: SettlementBatchStatus.SUSPENDED,
      suspendReason: SuspendReason.CHARGEBACK,
      suspendNote: '拒付比例 8% 超过阈值 5%',
      suspendedAt: new Date(),
    },
  });
  
  await prisma.batchTransaction.createMany({
    data: [
      {
        transactionNo: 'TXN007',
        batchId: batch3.id,
        transactionDate: twoDaysAgo,
        amount: 30000,
        feeAmount: 90,
        refundAmount: 0,
        chargebackAmount: 2500,
        hasPendingChargeback: true,
      },
      {
        transactionNo: 'TXN008',
        batchId: batch3.id,
        transactionDate: twoDaysAgo,
        amount: 20000,
        feeAmount: 10,
        refundAmount: 1000,
        chargebackAmount: 1500,
      },
    ],
  });
  
  await prisma.exceptionRecord.create({
    data: {
      exceptionNo: `EXC-CB-${Date.now()}`,
      batchId: batch3.id,
      exceptionType: 'CHARGEBACK_PENDING',
      severity: 'HIGH',
      message: '拒付比例异常',
      detail: '总金额 50000, 拒付 4000, 比例 8.00%',
      isResolved: true,
      resolvedAt: new Date(),
      resolvedBy: 'risk_team',
      resolutionNote: '已与持卡人协商和解，拒付已撤销',
    },
  });
  
  await prisma.exceptionRecord.create({
    data: {
      exceptionNo: `EXC-PENDING-${Date.now()}`,
      batchId: batch3.id,
      exceptionType: 'CHARGEBACK_PENDING',
      severity: 'MEDIUM',
      message: '仍有待处理拒付',
      detail: '交易 TXN007 存在待处理拒付',
    },
  });
  
  console.log('样例4: 已完成的历史批次 (已出款)');
  
  const batch4 = await prisma.settlementBatch.create({
    data: {
      batchNo: `BATCH-PAID-${Date.now()}`,
      merchantId: merchant1.id,
      settlementDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
      totalAmount: 8500,
      refundAmount: 200,
      chargebackAmount: 0,
      feeAmount: 85,
      netAmount: 8215,
      status: SettlementBatchStatus.PAID,
      approvedBy: 'admin',
      approvedAt: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000),
      paidAt: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
    },
  });
  
  await prisma.batchTransaction.createMany({
    data: [
      {
        transactionNo: 'TXN-HIST001',
        batchId: batch4.id,
        transactionDate: new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000),
        amount: 4500,
        feeAmount: 45,
        refundAmount: 0,
        chargebackAmount: 0,
      },
      {
        transactionNo: 'TXN-HIST002',
        batchId: batch4.id,
        transactionDate: new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000),
        amount: 4000,
        feeAmount: 40,
        refundAmount: 200,
        chargebackAmount: 0,
      },
    ],
  });
  
  await prisma.settlementReport.create({
    data: {
      reportNo: `RPT-HIST-${Date.now()}`,
      batchId: batch4.id,
      reportDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
      reportType: 'PAYMENT',
      content: JSON.stringify({
        summary: '历史出款报表',
        netAmount: 8215,
        transactionCount: 2,
      }),
      generatedBy: 'finance_system',
    },
  });
  
  console.log('样例5: 解挂申请流程演示');
  
  await prisma.approvalRecord.create({
    data: {
      batchId: batch2.id,
      approvalType: 'UNSUSPEND',
      status: 'PENDING',
      requester: 'operator_user',
      requestNote: '退款已与用户协商处理完成，申请解挂',
    },
  });
  
  console.log('\n==================== 初始化完成 ====================');
  console.log('');
  console.log('创建的商户:');
  console.log(`  MCH001: 阳光百货有限公司 (标准费率 1%)`);
  console.log(`  MCH002: 星辰电商平台 (阶梯费率 0.8-0.5%)`);
  console.log(`  MCH003: 银河网络科技 (VIP费率 0.3%)`);
  console.log('');
  console.log('样例批次:');
  console.log(`  ${batch1.batchNo}: 正常批次 - 已审批 (可生成报表出款)`);
  console.log(`  ${batch2.batchNo}: 退款挂起 - 有待解挂申请, ID: ${batch2.id}`);
  console.log(`  ${batch3.batchNo}: 拒付挂起 - 部分异常已处理, ID: ${batch3.id}`);
  console.log(`  ${batch4.batchNo}: 历史批次 - 已完成出款`);
  console.log('');
  console.log('建议的测试步骤:');
  console.log('  1. 查看概览: GET /api/reports/dashboard');
  console.log('  2. 查看异常列表: GET /api/exceptions/pending');
  console.log('  3. 继续处理 batch1:');
  console.log('     POST /api/reports/batches/:batch1Id/generate');
  console.log('     POST /api/reports/batches/:batch1Id/mark-paid');
  console.log('  4. 测试解挂流程 - 处理 batch2:');
  console.log('     先查看异常: GET /api/batches/:batch2Id/exceptions');
  console.log('     解决异常后: POST /api/batches/:batch2Id/unsuspend/approve');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
