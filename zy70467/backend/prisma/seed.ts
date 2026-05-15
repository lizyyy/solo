import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const defaultRule = await prisma.ruleVersion.create({
    data: {
      name: '默认审批校验规则',
      description: '包含审批意见缺失检测等核心校验规则',
      version: 1,
      logic: {
        conditions: [
          {
            field: 'approvalStatus',
            operator: 'in',
            value: ['APPROVED', 'REJECTED'],
          },
          {
            field: 'approvalComment',
            operator: 'notEmpty',
          },
        ],
        actions: [
          {
            type: 'BLOCK',
            message: '审批状态为通过/拒绝时，审批意见不能为空',
          },
        ],
        approvalRequired: false,
      },
      status: 'ACTIVE',
      createdBy: 'system',
    },
  });

  console.log('✅ 初始化规则创建完成:', defaultRule.id);

  const sampleBatch = await prisma.batch.create({
    data: {
      name: '2024年第一季度培训审批数据',
      description: 'Q1 培训课程审批记录批量校验',
      ruleVersionId: defaultRule.id,
      status: 'PENDING',
      createdBy: 'system',
    },
  });

  const sampleItems = [
    {
      courseId: 'CS001',
      courseName: 'Node.js 进阶开发',
      traineeId: 'T001',
      traineeName: '张三',
      submissionId: 'SUB001',
      approvalStatus: 'APPROVED',
      approvalComment: '课程完成度达标，同意通过',
      submittedAt: new Date('2024-01-15'),
    },
    {
      courseId: 'CS002',
      courseName: 'TypeScript 实战',
      traineeId: 'T002',
      traineeName: '李四',
      submissionId: 'SUB002',
      approvalStatus: 'APPROVED',
      approvalComment: '',
      submittedAt: new Date('2024-01-16'),
    },
    {
      courseId: 'CS003',
      courseName: '数据库设计原理',
      traineeId: 'T003',
      traineeName: '王五',
      submissionId: 'SUB003',
      approvalStatus: 'REJECTED',
      approvalComment: '',
      submittedAt: new Date('2024-01-17'),
    },
  ];

  for (const item of sampleItems) {
    await prisma.batchItem.create({
      data: {
        batchId: sampleBatch.id,
        originalData: item as any,
      },
    });
  }

  console.log('✅ 示例批次创建完成:', sampleBatch.id);
  console.log('✅ 示例数据条目:', sampleItems.length, '条');
}

main()
  .catch((e) => {
    console.error('❌ 初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
