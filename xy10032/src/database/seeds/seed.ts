import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../modules/user/user.entity';
import { Refund } from '../../modules/refund/refund.entity';
import { RefundHistory } from '../../modules/refund/refund-history.entity';
import { AuditLog } from '../../modules/audit-log/audit-log.entity';
import { Role } from '../../common/enums/role.enum';
import { RefundStatus } from '../../common/enums/refund-status.enum';
import { ActionType } from '../../common/enums/action-type.enum';
import { LogLevel } from '../../common/enums/log-level.enum';

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'refund_management',
    entities: [
      User,
      Refund,
      RefundHistory,
      AuditLog,
    ],
    synchronize: true,
    logging: true,
  });

  await dataSource.initialize();
  console.log('Database connected');

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    console.log('Clearing existing data...');
    await queryRunner.manager.query('TRUNCATE TABLE audit_logs CASCADE');
    await queryRunner.manager.query('TRUNCATE TABLE refund_histories CASCADE');
    await queryRunner.manager.query('TRUNCATE TABLE refunds CASCADE');
    await queryRunner.manager.query('TRUNCATE TABLE users CASCADE');

    console.log('Creating users...');
    const hashedPassword = await bcrypt.hash('password123', 10);

    const admin = queryRunner.manager.create(User, {
      id: uuidv4(),
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      fullName: '系统管理员',
      role: Role.ADMIN,
      isActive: true,
    });

    const manager = queryRunner.manager.create(User, {
      id: uuidv4(),
      username: 'manager',
      email: 'manager@example.com',
      password: hashedPassword,
      fullName: '张经理',
      role: Role.MANAGER,
      isActive: true,
    });

    const operator = queryRunner.manager.create(User, {
      id: uuidv4(),
      username: 'operator',
      email: 'operator@example.com',
      password: hashedPassword,
      fullName: '李操作员',
      role: Role.OPERATOR,
      isActive: true,
    });

    const viewer = queryRunner.manager.create(User, {
      id: uuidv4(),
      username: 'viewer',
      email: 'viewer@example.com',
      password: hashedPassword,
      fullName: '王查看员',
      role: Role.VIEWER,
      isActive: true,
    });

    await queryRunner.manager.save([admin, manager, operator, viewer]);
    console.log('Users created');

    console.log('Creating refunds...');
    const refunds: Refund[] = [];
    const refundData = [
      {
        orderNo: 'ORD202401001',
        amount: 299.00,
        reason: '商品质量问题',
        status: RefundStatus.SUCCESS,
      },
      {
        orderNo: 'ORD202401002',
        amount: 599.00,
        reason: '重复下单',
        status: RefundStatus.PENDING,
      },
      {
        orderNo: 'ORD202401003',
        amount: 1299.00,
        reason: '7天无理由退换',
        status: RefundStatus.FAILED,
        retryCount: 1,
      },
      {
        orderNo: 'ORD202401004',
        amount: 89.50,
        reason: '用户取消订单',
        status: RefundStatus.DRAFT,
      },
      {
        orderNo: 'ORD202401005',
        amount: 2499.00,
        reason: '退款金额有误',
        status: RefundStatus.PROCESSING,
      },
      {
        orderNo: 'ORD202401006',
        amount: 158.00,
        reason: '发错货了',
        status: RefundStatus.SUCCESS,
      },
      {
        orderNo: 'ORD202401007',
        amount: 459.00,
        reason: '客服同意退款',
        status: RefundStatus.CANCELLED,
      },
      {
        orderNo: 'ORD202401008',
        amount: 789.00,
        reason: '需要重新审核',
        status: RefundStatus.RETRYING,
        retryCount: 2,
      },
      {
        orderNo: 'ORD202401009',
        amount: 328.00,
        reason: '库存不足',
        status: RefundStatus.REJECTED,
      },
      {
        orderNo: 'ORD202401010',
        amount: 1999.00,
        reason: '申请全额退款',
        status: RefundStatus.PENDING,
      },
    ];

    for (let i = 0; i < refundData.length; i++) {
      const data = refundData[i];
      const date = new Date(2024, 0, 15 + i);
      const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
      const random = String(100000 + i).padStart(6, '0');

      const refund = queryRunner.manager.create(Refund, {
        id: uuidv4(),
        refundNo: `RF${dateStr}${random}`,
        orderNo: data.orderNo,
        amount: data.amount,
        currency: 'CNY',
        refundMethod: 'original_payment',
        reason: data.reason,
        status: data.status,
        createdById: i % 2 === 0 ? operator.id : manager.id,
        retryCount: data.retryCount || 0,
        version: 1,
      });

      refunds.push(refund);
    }

    await queryRunner.manager.save(refunds);
    console.log('Refunds created');

    console.log('Creating refund histories...');
    const histories: RefundHistory[] = [];

    for (const refund of refunds) {
      const history = queryRunner.manager.create(RefundHistory, {
        id: uuidv4(),
        refundId: refund.id,
        version: 1,
        status: refund.status,
        amount: refund.amount,
        reason: refund.reason,
        changedBy: operator.id,
        changedByUsername: operator.username,
        changeDescription: '创建退款单',
        previousData: {},
        newData: {
          status: refund.status,
          amount: refund.amount,
          reason: refund.reason,
        },
      });
      histories.push(history);
    }

    await queryRunner.manager.save(histories);
    console.log('Refund histories created');

    console.log('Creating audit logs...');
    const logs: AuditLog[] = [];

    for (const refund of refunds) {
      const log = queryRunner.manager.create(AuditLog, {
        id: uuidv4(),
        level: LogLevel.INFO,
        actionType: ActionType.CREATE,
        entityType: 'Refund',
        entityId: refund.id,
        performedById: operator.id,
        performedByUsername: operator.username,
        description: `创建退款单 ${refund.refundNo}`,
        details: {
          orderNo: refund.orderNo,
          amount: refund.amount,
          status: refund.status,
        },
      });
      logs.push(log);
    }

    logs.push(
      queryRunner.manager.create(AuditLog, {
        id: uuidv4(),
        level: LogLevel.INFO,
        actionType: ActionType.CREATE,
        entityType: 'User',
        entityId: admin.id,
        performedById: admin.id,
        performedByUsername: admin.username,
        description: '创建管理员用户',
      }),
    );

    logs.push(
      queryRunner.manager.create(AuditLog, {
        id: uuidv4(),
        level: LogLevel.INFO,
        actionType: ActionType.APPROVE,
        entityType: 'Refund',
        entityId: refunds[0].id,
        performedById: manager.id,
        performedByUsername: manager.username,
        description: `审批通过退款单 ${refunds[0].refundNo}`,
      }),
    );

    logs.push(
      queryRunner.manager.create(AuditLog, {
        id: uuidv4(),
        level: LogLevel.WARN,
        actionType: ActionType.FAIL,
        entityType: 'Refund',
        entityId: refunds[2].id,
        performedById: manager.id,
        performedByUsername: manager.username,
        description: `退款单 ${refunds[2].refundNo} 处理失败`,
        errorMessage: 'Payment gateway returned error: Insufficient balance',
      }),
    );

    await queryRunner.manager.save(logs);
    console.log('Audit logs created');

    await queryRunner.commitTransaction();
    console.log('\n=== Seed completed successfully! ===');
    console.log('\nCreated users:');
    console.log('  - admin / password123 (管理员)');
    console.log('  - manager / password123 (经理)');
    console.log('  - operator / password123 (操作员)');
    console.log('  - viewer / password123 (查看员)');
    console.log('\nCreated refunds: 10');
    console.log('Created histories: 10');
    console.log('Created audit logs: 13');

  } catch (error) {
    console.error('Seed failed:', error);
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

seed().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
