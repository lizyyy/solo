import { PrismaClient, TaskStatus, TaskPriority } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = crypto
    .createHash('sha256')
    .update('password123')
    .digest('hex');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: '系统管理员',
      passwordHash,
      role: 'admin',
      isActive: true,
    },
  });

  const agent1 = await prisma.user.upsert({
    where: { email: 'agent1@example.com' },
    update: {},
    create: {
      email: 'agent1@example.com',
      name: '客服专员-张三',
      passwordHash,
      role: 'agent',
      isActive: true,
    },
  });

  const agent2 = await prisma.user.upsert({
    where: { email: 'agent2@example.com' },
    update: {},
    create: {
      email: 'agent2@example.com',
      name: '客服专员-李四',
      passwordHash,
      role: 'agent',
      isActive: true,
    },
  });

  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { externalId: 'CUST001' },
      update: {},
      create: {
        name: '王小明',
        phone: '13800138001',
        email: 'wangxm@example.com',
        externalId: 'CUST001',
      },
    }),
    prisma.customer.upsert({
      where: { externalId: 'CUST002' },
      update: {},
      create: {
        name: '李小红',
        phone: '13800138002',
        email: 'lixh@example.com',
        externalId: 'CUST002',
      },
    }),
    prisma.customer.upsert({
      where: { externalId: 'CUST003' },
      update: {},
      create: {
        name: '张大伟',
        phone: '13800138003',
        email: 'zhangdw@example.com',
        externalId: 'CUST003',
      },
    }),
  ]);

  console.log('Users and customers created');

  const tasksData = [
    {
      customerId: customers[0].id,
      title: '订单补发 - 产品A',
      description: '用户反馈未收到包裹，客服答应用户补发商品',
      status: TaskStatus.PENDING,
      priority: TaskPriority.HIGH,
      assigneeId: agent1.id,
      creatorId: agent1.id,
      orderNumber: 'ORD20240101001',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    {
      customerId: customers[1].id,
      title: '售后处理 - 申请退款',
      description: '用户申请全额退款，需要确认退货状态',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      assigneeId: agent2.id,
      creatorId: admin.id,
      orderNumber: 'ORD20240101002',
      refundAmount: 299.00,
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
    {
      customerId: customers[2].id,
      title: '物流追踪 - 快递异常',
      description: '快递显示已签收但用户未收到，需要联系快递公司核实',
      status: TaskStatus.PENDING,
      priority: TaskPriority.URGENT,
      assigneeId: agent1.id,
      creatorId: agent2.id,
      orderNumber: 'ORD20240101003',
      trackingNumber: 'SF1234567890',
      dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
    },
    {
      customerId: customers[0].id,
      title: '投诉处理 - 服务态度',
      description: '用户投诉之前的客服服务态度问题',
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.MEDIUM,
      assigneeId: admin.id,
      creatorId: admin.id,
      orderNumber: 'ORD20240101004',
      completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  ];

  for (const taskData of tasksData) {
    const existingTask = await prisma.task.findFirst({
      where: { orderNumber: taskData.orderNumber },
    });

    let task;
    if (existingTask) {
      task = existingTask;
    } else {
      task = await prisma.task.create({
        data: taskData,
      });
    }

    const existingVersion = await prisma.taskVersion.findFirst({
      where: { taskId: task.id },
    });

    if (!existingVersion) {
      await prisma.taskVersion.create({
        data: {
          taskId: task.id,
          versionNumber: 1,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assigneeId: task.assigneeId,
          dueDate: task.dueDate,
          orderNumber: task.orderNumber,
          trackingNumber: task.trackingNumber,
          refundAmount: task.refundAmount,
          snapshotData: task as any,
          createdBy: task.creatorId,
        },
      });
    }
  }

  console.log('Tasks created');
  console.log('Seeding completed!');
  console.log('');
  console.log('Default accounts:');
  console.log('  Admin: admin@example.com / password123');
  console.log('  Agent: agent1@example.com / password123');
  console.log('  Agent: agent2@example.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });