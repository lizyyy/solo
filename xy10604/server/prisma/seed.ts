import { PrismaClient, UserRole, ReagentStatus, ExperimentStatus, ReviewDecision, BlockReason, DiscardReason } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('开始创建种子数据...');

  const hashedPassword = await bcrypt.hash('123456', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      name: '系统管理员',
      role: UserRole.ADMIN,
      email: 'admin@example.com',
    },
  });

  const operator = await prisma.user.upsert({
    where: { username: 'operator' },
    update: {},
    create: {
      username: 'operator',
      password: hashedPassword,
      name: '实验操作员',
      role: UserRole.OPERATOR,
      email: 'operator@example.com',
    },
  });

  const reviewer = await prisma.user.upsert({
    where: { username: 'reviewer' },
    update: {},
    create: {
      username: 'reviewer',
      password: hashedPassword,
      name: '复核员',
      role: UserRole.REVIEWER,
      email: 'reviewer@example.com',
    },
  });

  const auditor = await prisma.user.upsert({
    where: { username: 'auditor' },
    update: {},
    create: {
      username: 'auditor',
      password: hashedPassword,
      name: '审计员',
      role: UserRole.AUDITOR,
      email: 'auditor@example.com',
    },
  });

  console.log('用户创建完成');

  const reagent1 = await prisma.reagent.upsert({
    where: { code: 'PCR-MIX-001' },
    update: {},
    create: {
      name: 'PCR预混液',
      code: 'PCR-MIX-001',
      description: '2X PCR Master Mix',
      defaultExpiryDays: 30,
      nearExpiryDays: 7,
    },
  });

  const reagent2 = await prisma.reagent.upsert({
    where: { code: 'BUFFER-001' },
    update: {},
    create: {
      name: '缓冲液',
      code: 'BUFFER-001',
      description: 'PBS缓冲液 pH 7.4',
      defaultExpiryDays: 180,
      nearExpiryDays: 14,
    },
  });

  const reagent3 = await prisma.reagent.upsert({
    where: { code: 'ENZYME-001' },
    update: {},
    create: {
      name: '限制性内切酶',
      code: 'ENZYME-001',
      description: 'EcoRI限制性内切酶',
      defaultExpiryDays: 14,
      nearExpiryDays: 3,
    },
  });

  console.log('试剂创建完成');

  const today = new Date();
  const future30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const future60Days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
  const past10Days = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000);
  const past20Days = new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000);
  const past40Days = new Date(today.getTime() - 40 * 24 * 60 * 60 * 1000);

  const batch1 = await prisma.reagentBatch.upsert({
    where: {
      reagentId_batchNumber: {
        reagentId: reagent1.id,
        batchNumber: 'BATCH-20250501',
      },
    },
    update: {},
    create: {
      reagentId: reagent1.id,
      batchNumber: 'BATCH-20250501',
      productionDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
      expiryDate: future60Days,
      originalQty: 1000,
      currentQty: 800,
      unit: 'mL',
      status: ReagentStatus.ACTIVE,
      createdById: operator.id,
    },
  });

  const batch2 = await prisma.reagentBatch.upsert({
    where: {
      reagentId_batchNumber: {
        reagentId: reagent2.id,
        batchNumber: 'BATCH-20250401',
      },
    },
    update: {},
    create: {
      reagentId: reagent2.id,
      batchNumber: 'BATCH-20250401',
      productionDate: new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000),
      expiryDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
      originalQty: 500,
      currentQty: 200,
      unit: 'mL',
      status: ReagentStatus.ACTIVE,
      createdById: operator.id,
    },
  });

  const batch3 = await prisma.reagentBatch.upsert({
    where: {
      reagentId_batchNumber: {
        reagentId: reagent3.id,
        batchNumber: 'BATCH-20250301',
      },
    },
    update: {},
    create: {
      reagentId: reagent3.id,
      batchNumber: 'BATCH-20250301',
      productionDate: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
      expiryDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
      originalQty: 100,
      currentQty: 50,
      unit: 'μL',
      status: ReagentStatus.EXPIRED,
      createdById: operator.id,
    },
  });

  console.log('批号创建完成');

  const openRecord1 = await prisma.openRecord.upsert({
    where: { id: 'open-rec-001' },
    update: {},
    create: {
      id: 'open-rec-001',
      batchId: batch1.id,
      openDate: past10Days,
      expectedExpiry: future30Days,
      isOpened: true,
      notes: '首次开封，正常使用',
      createdById: operator.id,
    },
  });

  const openRecord2 = await prisma.openRecord.upsert({
    where: { id: 'open-rec-002' },
    update: {},
    create: {
      id: 'open-rec-002',
      batchId: batch2.id,
      openDate: past10Days,
      expectedExpiry: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
      isOpened: true,
      notes: '开封后接近有效期',
      createdById: operator.id,
    },
  });

  console.log('开封记录创建完成');

  const exp1 = await prisma.experiment.upsert({
    where: { code: 'EXP-2025-001' },
    update: {},
    create: {
      name: '正常完成 - PCR扩增实验',
      code: 'EXP-2025-001',
      batchId: batch1.id,
      openRecordId: openRecord1.id,
      scheduledDate: future30Days,
      actualStartDate: today,
      actualEndDate: today,
      status: ExperimentStatus.COMPLETED,
      createdById: operator.id,
    },
  });

  const exp2 = await prisma.experiment.upsert({
    where: { code: 'EXP-2025-002' },
    update: {},
    create: {
      name: '被规则挡住 - 过期试剂',
      code: 'EXP-2025-002',
      batchId: batch3.id,
      scheduledDate: today,
      status: ExperimentStatus.BLOCKED,
      createdById: operator.id,
    },
  });

  const exp3 = await prisma.experiment.upsert({
    where: { code: 'EXP-2025-003' },
    update: {},
    create: {
      name: '待人工复核 - 近效期',
      code: 'EXP-2025-003',
      batchId: batch2.id,
      openRecordId: openRecord2.id,
      scheduledDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
      status: ExperimentStatus.REVIEWING,
      createdById: operator.id,
    },
  });

  console.log('实验创建完成');

  const blockRecord1 = await prisma.blockRecord.upsert({
    where: { id: 'block-001' },
    update: {},
    create: {
      id: 'block-001',
      batchId: batch3.id,
      experimentId: exp2.id,
      reason: BlockReason.EXPIRED,
      details: '试剂批号已过期，无法用于实验',
      blockedAt: past20Days,
      isResolved: false,
    },
  });

  const blockRecord2 = await prisma.blockRecord.upsert({
    where: { id: 'block-002' },
    update: {},
    create: {
      id: 'block-002',
      batchId: batch2.id,
      experimentId: exp3.id,
      openRecordId: openRecord2.id,
      reason: BlockReason.NEAR_EXPIRY,
      details: '开封后期效日期仅剩余5天，需要人工复核',
      blockedAt: past10Days,
      isResolved: false,
    },
  });

  console.log('拦截记录创建完成');

  const reviewRecord1 = await prisma.reviewRecord.upsert({
    where: { id: 'review-001' },
    update: {},
    create: {
      id: 'review-001',
      batchId: batch2.id,
      experimentId: exp3.id,
      blockRecordId: blockRecord2.id,
      reviewerId: reviewer.id,
      decision: ReviewDecision.APPROVE,
      reason: '该实验为紧急实验，经核查试剂质量符合要求，准予放行',
      notes: '需要在实验后立即使用剩余试剂',
      reviewedAt: past10Days,
      affectedRecords: [
        {
          type: 'EXPERIMENT',
          id: exp3.id,
          oldStatus: 'REVIEWING',
          newStatus: 'APPROVED',
        },
        {
          type: 'BLOCK_RECORD',
          id: blockRecord2.id,
          action: 'RESOLVED',
        },
      ],
    },
  });

  console.log('复核记录创建完成');

  const discardRecord1 = await prisma.discardRecord.upsert({
    where: { id: 'discard-001' },
    update: {},
    create: {
      id: 'discard-001',
      batchId: batch3.id,
      reason: DiscardReason.EXPIRED,
      details: '批号过期，全部废弃',
      discardedQty: 50,
      discardedAt: past10Days,
      createdById: operator.id,
    },
  });

  console.log('废弃记录创建完成');

  await prisma.auditLog.createMany({
    data: [
      {
        id: 'audit-001',
        action: 'CREATE_BATCH',
        entityType: 'BATCH',
        entityId: batch1.id,
        userId: operator.id,
        timestamp: past40Days,
      },
      {
        id: 'audit-002',
        action: 'CREATE_OPEN_RECORD',
        entityType: 'OPEN_RECORD',
        entityId: openRecord1.id,
        userId: operator.id,
        timestamp: past10Days,
      },
      {
        id: 'audit-003',
        action: 'UPDATE_BATCH_STATUS',
        entityType: 'BATCH',
        entityId: batch1.id,
        userId: operator.id,
        oldValues: { status: 'PENDING' },
        newValues: { status: 'ACTIVE' },
        timestamp: past10Days,
      },
      {
        id: 'audit-004',
        action: 'CREATE_EXPERIMENT',
        entityType: 'EXPERIMENT',
        entityId: exp1.id,
        userId: operator.id,
        timestamp: past10Days,
      },
      {
        id: 'audit-005',
        action: 'UPDATE_EXPERIMENT_STATUS',
        entityType: 'EXPERIMENT',
        entityId: exp1.id,
        userId: operator.id,
        oldValues: { status: 'PENDING' },
        newValues: { status: 'COMPLETED' },
        timestamp: today,
      },
      {
        id: 'audit-006',
        action: 'CREATE_REVIEW',
        entityType: 'REVIEW',
        entityId: reviewRecord1.id,
        userId: reviewer.id,
        timestamp: past10Days,
      },
      {
        id: 'audit-007',
        action: 'REVIEW_APPROVE_EXPERIMENT',
        entityType: 'EXPERIMENT',
        entityId: exp3.id,
        userId: reviewer.id,
        oldValues: { status: 'REVIEWING' },
        newValues: { status: 'APPROVED' },
        timestamp: past10Days,
      },
      {
        id: 'audit-008',
        action: 'CREATE_DISCARD',
        entityType: 'DISCARD',
        entityId: discardRecord1.id,
        userId: operator.id,
        timestamp: past10Days,
      },
    ],
    skipDuplicates: true,
  });

  console.log('审计日志创建完成');

  console.log('');
  console.log('========================================');
  console.log('种子数据创建完成！');
  console.log('========================================');
  console.log('');
  console.log('登录账号:');
  console.log('  管理员: admin / 123456');
  console.log('  操作员: operator / 123456');
  console.log('  复核员: reviewer / 123456');
  console.log('  审计员: auditor / 123456');
  console.log('');
  console.log('四个内置场景:');
  console.log('  1. 正常完成 - EXP-2025-001 (PCR扩增实验)');
  console.log('  2. 被规则挡住 - EXP-2025-002 (过期试剂)');
  console.log('  3. 人工复核 - EXP-2025-003 (近效期)');
  console.log('  4. 重复提交 - 尝试创建相同批号或相同实验编号');
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
