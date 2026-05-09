import { PrismaClient, Role, RefundStatus, RefundReason } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始创建种子数据...');

  const passwordHash = await bcrypt.hash('password123', 12);

  const users = await prisma.user.createMany({
    data: [
      {
        username: 'admin',
        email: 'admin@example.com',
        passwordHash,
        role: Role.ADMIN
      },
      {
        username: 'manager1',
        email: 'manager1@example.com',
        passwordHash,
        role: Role.MANAGER
      },
      {
        username: 'manager2',
        email: 'manager2@example.com',
        passwordHash,
        role: Role.MANAGER
      },
      {
        username: 'operator1',
        email: 'operator1@example.com',
        passwordHash,
        role: Role.OPERATOR
      },
      {
        username: 'operator2',
        email: 'operator2@example.com',
        passwordHash,
        role: Role.OPERATOR
      },
      {
        username: 'viewer1',
        email: 'viewer1@example.com',
        passwordHash,
        role: Role.VIEWER
      }
    ],
    skipDuplicates: true
  });

  console.log(`✅ 创建 ${users.count} 个用户`);

  const allUsers = await prisma.user.findMany({
    select: { id: true, username: true }
  });

  const userIdMap: Record<string, string> = {};
  allUsers.forEach(u => {
    userIdMap[u.username] = u.id;
  });

  const refundData = [
    {
      orderNo: 'ORD2024001',
      customerName: '张三',
      customerPhone: '13800138001',
      amount: 299.99,
      reason: RefundReason.QUALITY_ISSUE,
      reasonDetail: '商品有质量问题，表面有划痕',
      status: RefundStatus.DRAFT
    },
    {
      orderNo: 'ORD2024002',
      customerName: '李四',
      customerPhone: '13800138002',
      amount: 599.00,
      reason: RefundReason.WRONG_ITEM,
      reasonDetail: '收到的商品与订单不符',
      status: RefundStatus.PENDING_REVIEW
    },
    {
      orderNo: 'ORD2024003',
      customerName: '王五',
      customerPhone: '13800138003',
      amount: 1299.50,
      reason: RefundReason.DAMAGED,
      reasonDetail: '运输过程中商品损坏',
      status: RefundStatus.APPROVED
    },
    {
      orderNo: 'ORD2024004',
      customerName: '赵六',
      customerPhone: '13800138004',
      amount: 199.00,
      reason: RefundReason.CUSTOMER_CHANGED_MIND,
      reasonDetail: '顾客改变主意，不需要了',
      status: RefundStatus.PROCESSING
    },
    {
      orderNo: 'ORD2024005',
      customerName: '钱七',
      customerPhone: '13800138005',
      amount: 899.99,
      reason: RefundReason.OTHER,
      reasonDetail: '其他原因',
      status: RefundStatus.SUCCESS
    },
    {
      orderNo: 'ORD2024006',
      customerName: '孙八',
      customerPhone: '13800138006',
      amount: 459.00,
      reason: RefundReason.NOT_AS_DESCRIBED,
      reasonDetail: '商品与描述不符',
      status: RefundStatus.FAILED
    },
    {
      orderNo: 'ORD2024007',
      customerName: '周九',
      customerPhone: '13800138007',
      amount: 799.00,
      reason: RefundReason.QUALITY_ISSUE,
      reasonDetail: '颜色不符合预期',
      status: RefundStatus.CANCELLED
    },
    {
      orderNo: 'ORD2024008',
      customerName: '吴十',
      customerPhone: '13800138008',
      amount: 329.00,
      reason: RefundReason.WRONG_ITEM,
      reasonDetail: '发错了型号',
      status: RefundStatus.REJECTED
    },
    {
      orderNo: 'ORD2024009',
      customerName: '郑一',
      customerPhone: '13800138009',
      amount: 1599.00,
      reason: RefundReason.DAMAGED,
      reasonDetail: '外包装破损，商品变形',
      status: RefundStatus.DRAFT
    },
    {
      orderNo: 'ORD2024010',
      customerName: '冯二',
      customerPhone: '13800138010',
      amount: 88.88,
      reason: RefundReason.QUALITY_ISSUE,
      reasonDetail: '有功能缺陷',
      status: RefundStatus.PENDING_REVIEW
    }
  ];

  const operatorIds = [userIdMap['operator1'], userIdMap['operator2']];
  const managerIds = [userIdMap['manager1'], userIdMap['manager2']];
  const statusByState: Record<RefundStatus, { reviewedById?: string; approvedById?: string }> = {
    [RefundStatus.DRAFT]: {},
    [RefundStatus.PENDING_REVIEW]: { reviewedById: managerIds[0] },
    [RefundStatus.APPROVED]: { reviewedById: managerIds[0], approvedById: managerIds[1] },
    [RefundStatus.PROCESSING]: { reviewedById: managerIds[0], approvedById: managerIds[1] },
    [RefundStatus.SUCCESS]: { reviewedById: managerIds[0], approvedById: managerIds[1] },
    [RefundStatus.FAILED]: { reviewedById: managerIds[0], approvedById: managerIds[1] },
    [RefundStatus.CANCELLED]: {},
    [RefundStatus.REJECTED]: { reviewedById: managerIds[0] }
  };

  const today = new Date();

  for (let i = 0; i < refundData.length; i++) {
    const data = refundData[i];
    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    const statusInfo = statusByState[data.status];
    const operatorId = operatorIds[i % operatorIds.length];

    const refund = await prisma.refund.create({
      data: {
        refundNo: `REF${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(i + 1).padStart(4, '0')}`,
        orderNo: data.orderNo,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        amount: data.amount,
        reason: data.reason,
        reasonDetail: data.reasonDetail,
        status: data.status,
        operatorId,
        ...statusInfo,
        createdAt,
        completedAt: ['SUCCESS', 'FAILED', 'CANCELLED', 'REJECTED'].includes(data.status)
          ? new Date(createdAt.getTime() + (Math.random() * 5 + 1) * 24 * 60 * 60 * 1000)
          : undefined
      }
    });

    await prisma.refundStatusHistory.create({
      data: {
        refundId: refund.id,
        toStatus: RefundStatus.DRAFT,
        changedBy: operatorId,
        changeReason: '创建退款单',
        createdAt
      }
    });

    if (data.status !== RefundStatus.DRAFT) {
      await prisma.refundStatusHistory.create({
        data: {
          refundId: refund.id,
          fromStatus: RefundStatus.DRAFT,
          toStatus: RefundStatus.PENDING_REVIEW,
          changedBy: operatorId,
          changeReason: '提交审核'
        }
      });
    }

    if ([
      RefundStatus.APPROVED,
      RefundStatus.PROCESSING,
      RefundStatus.SUCCESS,
      RefundStatus.FAILED,
      RefundStatus.REJECTED,
      RefundStatus.CANCELLED
    ].includes(data.status)) {
      if (data.status === RefundStatus.REJECTED) {
        await prisma.refundStatusHistory.create({
          data: {
            refundId: refund.id,
            fromStatus: RefundStatus.PENDING_REVIEW,
            toStatus: RefundStatus.REJECTED,
            changedBy: managerIds[0],
            changeReason: '审核拒绝'
          }
        });
      } else if (data.status !== RefundStatus.CANCELLED) {
        await prisma.refundStatusHistory.create({
          data: {
            refundId: refund.id,
            fromStatus: RefundStatus.PENDING_REVIEW,
            toStatus: RefundStatus.APPROVED,
            changedBy: managerIds[1],
            changeReason: '审核通过'
          }
        });
      }
    }

    await prisma.refundLog.create({
      data: {
        refundId: refund.id,
        userId: operatorId,
        action: 'CREATE',
        details: `创建退款单 ${refund.refundNo}`
      }
    });
  }

  console.log('✅ 创建 10 条退款单数据及相关状态历史和操作日志');
  console.log('\n📋 测试账号:');
  console.log('  管理员: admin / password123');
  console.log('  经理: manager1 / password123');
  console.log('  操作员: operator1 / password123');
  console.log('  查看者: viewer1 / password123');
}

main()
  .catch((e) => {
    console.error('❌ 种子数据创建失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
