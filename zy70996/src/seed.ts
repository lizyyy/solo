import prisma from './utils/prisma';

async function seed() {
  console.log('开始创建示例数据...');

  const employees = [
    { id: 'E001', name: '张三', department: '技术部', position: '工程师', status: 'ACTIVE' },
    { id: 'E002', name: '李四', department: '产品部', position: '产品经理', status: 'ACTIVE' },
    { id: 'E003', name: '王五', department: '市场部', position: '市场专员', status: 'ACTIVE' },
    { id: 'E004', name: '赵六', department: '技术部', position: '架构师', status: 'ACTIVE' },
    { id: 'E005', name: '钱七', department: '人事部', position: 'HR', status: 'INACTIVE', leaveDate: new Date('2025-12-31') },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { id: emp.id },
      update: emp,
      create: emp,
    });
  }

  const batches = [
    {
      id: 'BATCH_2026_SPRING',
      name: '2026年春节福利',
      description: '2026年春节员工福利发放',
      benefitType: 'GIFT_CARD',
      startTime: new Date('2026-01-01'),
      endTime: new Date('2026-02-28'),
      totalQuantity: 1000,
      createdBy: 'admin',
    },
    {
      id: 'BATCH_2026_DRAGON',
      name: '端午节福利',
      description: '2026年端午节粽子礼盒',
      benefitType: 'PHYSICAL',
      startTime: new Date('2026-06-01'),
      endTime: new Date('2026-06-20'),
      totalQuantity: 500,
      createdBy: 'admin',
    },
  ];

  for (const batch of batches) {
    await prisma.benefitBatch.upsert({
      where: { id: batch.id },
      update: batch,
      create: batch,
    });
  }

  for (let i = 1; i <= 10; i++) {
    const couponData = {
      id: `COUPON_SPRING_${i.toString().padStart(4, '0')}`,
      code: `SPRING2026_${i.toString().padStart(4, '0')}`,
      batchId: 'BATCH_2026_SPRING',
    };
    await prisma.coupon.upsert({
      where: { id: couponData.id },
      update: {},
      create: couponData,
    });
  }

  console.log('示例数据创建完成！');
  console.log('员工数据: E001-E005');
  console.log('批次数据: BATCH_2026_SPRING, BATCH_2026_DRAGON');
  console.log('券码数据: COUPON_SPRING_0001 - COUPON_SPRING_0010');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
