import { PrismaClient, BatchStatus, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化种子数据...');

  const defaultLimit = await prisma.paymentLimit.upsert({
    where: { limitType_limitKey: { limitType: 'GLOBAL', limitKey: 'DEFAULT' } },
    update: {},
    create: {
      limitType: 'GLOBAL',
      limitKey: 'DEFAULT',
      dailyAmountLimit: '10000000.00',
      dailyCountLimit: 1000,
      singleAmountMax: '500000.00',
      singleAmountMin: '0.01',
      description: '系统默认限额规则',
    },
  });
  console.log('默认限额已创建:', defaultLimit.id);

  const lowApproval = await prisma.approvalFlow.upsert({
    where: { flowName: '小额审批流' },
    update: {},
    create: {
      flowName: '小额审批流',
      flowType: 'PAYMENT_BATCH',
      minAmount: '10000.00',
      maxAmount: '100000.00',
      levels: [
        { level: 1, role: 'FINANCE_SUPERVISOR', required: true },
      ],
      description: '1-10万需1级审批',
    },
  });
  console.log('小额审批流已创建:', lowApproval.id);

  const highApproval = await prisma.approvalFlow.upsert({
    where: { flowName: '大额审批流' },
    update: {},
    create: {
      flowName: '大额审批流',
      flowType: 'PAYMENT_BATCH',
      minAmount: '100000.01',
      maxAmount: '999999999.99',
      levels: [
        { level: 1, role: 'FINANCE_SUPERVISOR', required: true },
        { level: 2, role: 'FINANCE_MANAGER', required: true },
        { level: 3, role: 'CFO', required: true },
      ],
      description: '10万以上需3级审批',
    },
  });
  console.log('大额审批流已创建:', highApproval.id);

  const sampleAccount = await prisma.receivingAccount.upsert({
    where: { accountNumber: '6222021234567890123' },
    update: {},
    create: {
      accountNumber: '6222021234567890123',
      accountName: '张三',
      bankCode: 'ICBC',
      bankName: '中国工商银行',
      branchName: '北京朝阳支行',
      accountType: 'PERSONAL',
      currency: 'CNY',
      isActive: true,
      isVerified: true,
    },
  });
  console.log('示例账户已创建:', sampleAccount.id);

  console.log('种子数据初始化完成!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
