import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始创建样例数据...');

  const member1 = await prisma.member.create({
    data: {
      name: '张三',
      phone: '13800000001',
      email: 'zhangsan@example.com',
    },
  });

  const member2 = await prisma.member.create({
    data: {
      name: '李四',
      phone: '13800000002',
      email: 'lisi@example.com',
    },
  });

  const member3 = await prisma.member.create({
    data: {
      name: '王五',
      phone: '13800000003',
      email: 'wangwu@example.com',
    },
  });

  console.log('创建会员:', member1.name, member2.name, member3.name);

  await prisma.bodyMeasurement.create({
    data: {
      memberId: member1.id,
      weight: 75,
      height: 175,
      bmi: 24.5,
      bodyFat: 18,
      muscleMass: 32,
      flexibility: 4,
      strength: 4,
      endurance: 3,
      cardio: 4,
      notes: '体测指标整体良好',
    },
  });

  await prisma.bodyMeasurement.create({
    data: {
      memberId: member2.id,
      weight: 90,
      height: 170,
      bmi: 31.1,
      bodyFat: 28,
      muscleMass: 35,
      flexibility: 2,
      strength: 3,
      endurance: 2,
      cardio: 2,
      notes: 'BMI偏高，需要减脂',
    },
  });

  await prisma.bodyMeasurement.create({
    data: {
      memberId: member3.id,
      weight: 60,
      height: 165,
      bmi: 22.0,
      bodyFat: 20,
      muscleMass: 28,
      flexibility: 3,
      strength: 3,
      endurance: 4,
      cardio: 3,
    },
  });

  console.log('创建体测数据完成');

  await prisma.injury.create({
    data: {
      memberId: member2.id,
      bodyPart: '膝',
      severity: '中',
      description: '左膝髌腱炎，深蹲和跳跃时疼痛',
      restrictedActions: JSON.stringify(['深蹲', '跳跃', '跑步']),
      startDate: new Date('2024-01-01'),
      isActive: true,
    },
  });

  console.log('创建伤病记录完成');

  const plan1v1 = await prisma.trainingPlan.create({
    data: {
      memberId: member1.id,
      name: '增肌计划',
      description: '以胸背腿三分化训练为主，渐进式负重',
      version: 1,
      isActive: false,
      exercises: {
        create: [
          { name: '杠铃卧推', sets: 4, reps: 8, weight: 60, orderIndex: 0 },
          { name: '坐姿划船', sets: 4, reps: 10, weight: 50, orderIndex: 1 },
          { name: '深蹲', sets: 4, reps: 8, weight: 80, orderIndex: 2 },
        ],
      },
    },
  });

  const plan1v2 = await prisma.trainingPlan.create({
    data: {
      memberId: member1.id,
      name: '增肌计划',
      description: '调整训练频率，增加硬拉动作',
      version: 2,
      isActive: true,
      exercises: {
        create: [
          { name: '杠铃卧推', sets: 4, reps: 8, weight: 65, orderIndex: 0 },
          { name: '坐姿划船', sets: 4, reps: 10, weight: 55, orderIndex: 1 },
          { name: '硬拉', sets: 4, reps: 6, weight: 90, orderIndex: 2 },
          { name: '腿举', sets: 3, reps: 12, weight: 120, orderIndex: 3 },
        ],
      },
    },
  });

  const plan2 = await prisma.trainingPlan.create({
    data: {
      memberId: member2.id,
      name: '减脂计划（膝伤调整版）',
      description: '由于膝伤，避免深蹲等动作，改用椭圆机等低冲击有氧',
      version: 1,
      isActive: true,
      exercises: {
        create: [
          { name: '椭圆机', sets: 1, reps: 30, weight: undefined, notes: '中等强度', orderIndex: 0 },
          { name: '坐姿推胸', sets: 3, reps: 12, weight: 40, orderIndex: 1 },
          { name: '高位下拉', sets: 3, reps: 12, weight: 35, orderIndex: 2 },
          { name: '坐姿腿屈伸', sets: 3, reps: 15, weight: 20, notes: '轻重量控制', orderIndex: 3 },
        ],
      },
    },
  });

  const plan3 = await prisma.trainingPlan.create({
    data: {
      memberId: member3.id,
      name: '力量提升计划',
      description: '基础力量提升，以复合动作为主',
      version: 1,
      isActive: true,
      exercises: {
        create: [
          { name: '深蹲', sets: 4, reps: 6, weight: 70, orderIndex: 0 },
          { name: '卧推', sets: 4, reps: 6, weight: 50, orderIndex: 1 },
          { name: '硬拉', sets: 4, reps: 5, weight: 80, orderIndex: 2 },
        ],
      },
    },
  });

  console.log('创建训练计划完成');

  await prisma.coursePayment.create({
    data: {
      memberId: member1.id,
      totalSessions: 24,
      usedSessions: 12,
      note: '首次购买24节课',
    },
  });

  await prisma.coursePayment.create({
    data: {
      memberId: member2.id,
      totalSessions: 12,
      usedSessions: 10,
      note: '购买12节私教课',
    },
  });

  await prisma.coursePayment.create({
    data: {
      memberId: member3.id,
      totalSessions: 36,
      usedSessions: 5,
      note: '购买年卡36节',
    },
  });

  console.log('创建课时包完成');

  const session1 = await prisma.trainingSession.create({
    data: {
      memberId: member1.id,
      planId: plan1v2.id,
      sessionDate: new Date(),
      durationMinutes: 60,
      isCompleted: false,
    },
  });

  const session2 = await prisma.trainingSession.create({
    data: {
      memberId: member2.id,
      planId: plan2.id,
      sessionDate: new Date(Date.now() - 86400000),
      durationMinutes: 60,
      isCompleted: true,
      feedback: '会员状态良好，动作标准',
      rating: 5,
    },
  });

  await prisma.sessionExercise.createMany({
    data: [
      {
        sessionId: session2.id,
        exerciseName: '椭圆机',
        completedSets: 1,
        completedReps: 35,
      },
      {
        sessionId: session2.id,
        exerciseName: '坐姿推胸',
        completedSets: 3,
        completedReps: 12,
        actualWeight: 40,
      },
    ],
  });

  console.log('创建训练记录完成');

  console.log('\n========================================');
  console.log('样例数据创建完成！');
  console.log('========================================');
  console.log('\n会员列表：');
  console.log(`  1. 张三 (${member1.id}) - 正常训练，剩余12课时，有2个计划版本`);
  console.log(`  2. 李四 (${member2.id}) - 膝伤限制，剩余2课时（不足），有减脂计划`);
  console.log(`  3. 王五 (${member3.id}) - 正常训练，剩余31课时，有力量计划`);
  console.log('\n场景说明：');
  console.log('  - 张三：正常训练场景，有两个计划版本（演示版本控制）');
  console.log('  - 李四：膝伤限制 + 课时不足场景（演示双重限制）');
  console.log('  - 王五：正常训练场景，充足课时');
  console.log('\n可以通过前端访问 http://localhost:5173 查看这些数据');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
