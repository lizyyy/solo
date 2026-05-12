import { sequelize, syncDatabase } from '../config/database';
import { logger } from '../config/logger';
import {
  User,
  Activity,
  Registration,
  StatusHistory,
  ImportBatch,
  AuditLog
} from '../models';
import { UserRole, RegistrationStatus, ActivityStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';

const FIRST_NAMES = [
  '张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴',
  '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗'
];

const LAST_NAMES = [
  '伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋',
  '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '华', '平'
];

const COMPANIES = [
  '科技创新有限公司',
  '互联网教育集团',
  '金融服务股份公司',
  '医疗健康科技',
  '智慧城市建设',
  '新能源汽车',
  '人工智能研究院',
  '大数据分析中心',
  '云计算服务平台',
  '电子商务公司'
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

function generateName(): string {
  return randomChoice(FIRST_NAMES) + randomChoice(LAST_NAMES);
}

function generateEmail(name: string): string {
  const domains = ['gmail.com', 'qq.com', '163.com', 'outlook.com', 'company.com'];
  const sanitized = name.replace(/\s/g, '').toLowerCase();
  return `${sanitized}${Math.floor(Math.random() * 1000)}@${randomChoice(domains)}`;
}

function generatePhone(): string {
  const prefixes = ['138', '139', '150', '151', '152', '186', '187', '188', '177'];
  return (
    randomChoice(prefixes) +
    Math.floor(10000000 + Math.random() * 90000000).toString()
  );
}

async function seed(): Promise<void> {
  logger.info('开始数据库播种...');

  await syncDatabase(true);

  logger.info('创建用户...');
  const admin = await User.create({
    id: uuidv4(),
    email: 'admin@example.com',
    password: 'admin123',
    name: '系统管理员',
    role: UserRole.ADMIN,
    isActive: true
  });

  const manager = await User.create({
    id: uuidv4(),
    email: 'manager@example.com',
    password: 'manager123',
    name: '活动经理',
    role: UserRole.MANAGER,
    isActive: true
  });

  const operator = await User.create({
    id: uuidv4(),
    email: 'operator@example.com',
    password: 'operator123',
    name: '运营人员',
    role: UserRole.OPERATOR,
    isActive: true
  });

  const viewer = await User.create({
    id: uuidv4(),
    email: 'viewer@example.com',
    password: 'viewer123',
    name: '数据查看员',
    role: UserRole.VIEWER,
    isActive: true
  });

  logger.info('创建活动...');
  const now = new Date();
  const activities: Activity[] = [];

  const activityData = [
    {
      name: '2026 年度技术峰会',
      description: '汇聚行业顶尖专家，探讨最新技术趋势和发展方向',
      location: '北京国际会议中心',
      startTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000),
      maxParticipants: 500,
      status: ActivityStatus.PUBLISHED
    },
    {
      name: '人工智能与机器学习研讨会',
      description: '深入探讨AI/ML在各行业的应用案例和最佳实践',
      location: '上海科技园区',
      startTime: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
      maxParticipants: 200,
      status: ActivityStatus.PUBLISHED
    },
    {
      name: '企业数字化转型论坛',
      description: '分享企业数字化转型的成功经验和挑战应对',
      location: '深圳会展中心',
      startTime: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 23 * 24 * 60 * 60 * 1000),
      maxParticipants: 300,
      status: ActivityStatus.DRAFT
    },
    {
      name: '数据隐私与安全合规培训',
      description: '数据保护法规解读与企业合规实践',
      location: '线上直播',
      startTime: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      maxParticipants: 100,
      status: ActivityStatus.COMPLETED
    },
    {
      name: '新产品发布会',
      description: '公司年度重磅产品发布会，邀请合作伙伴和媒体',
      location: '广州白云国际会议中心',
      startTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000),
      maxParticipants: 1000,
      status: ActivityStatus.PUBLISHED
    }
  ];

  for (const data of activityData) {
    const activity = await Activity.create({
      id: uuidv4(),
      ...data,
      createdBy: manager.id
    });
    activities.push(activity);
  }

  logger.info('创建报名记录...');
  const statuses = Object.values(RegistrationStatus);
  const createdUsers = [admin, manager, operator];

  for (const activity of activities) {
    const registrationCount = Math.floor(Math.random() * 50) + 10;

    for (let i = 0; i < registrationCount; i++) {
      const name = generateName();
      const email = generateEmail(name);
      const status =
        Math.random() > 0.3
          ? randomChoice(statuses)
          : RegistrationStatus.PENDING;

      const registration = await Registration.create({
        id: uuidv4(),
        activityId: activity.id,
        name,
        email,
        phone: generatePhone(),
        company: Math.random() > 0.5 ? randomChoice(COMPANIES) : null,
        notes: Math.random() > 0.7 ? '客户有特殊需求' : null,
        status,
        registrationTime: randomDate(
          new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          now
        ),
        createdBy: randomChoice(createdUsers).id
      });

      await StatusHistory.create({
        id: uuidv4(),
        registrationId: registration.id,
        oldStatus: null,
        newStatus: RegistrationStatus.PENDING,
        changedBy: randomChoice(createdUsers).id,
        reason: '初始报名'
      });

      if (status !== RegistrationStatus.PENDING) {
        await StatusHistory.create({
          id: uuidv4(),
          registrationId: registration.id,
          oldStatus: RegistrationStatus.PENDING,
          newStatus: status,
          changedBy: randomChoice(createdUsers).id,
          reason: '状态更新'
        });
      }
    }
  }

  logger.info('创建导入批次记录...');
  const techSummitActivity = activities[0];

  await ImportBatch.create({
    id: uuidv4(),
    fileName: 'tech_summit_import_01.csv',
    totalRecords: 150,
    successCount: 148,
    failureCount: 2,
    status: 'partial' as any,
    importedBy: operator.id,
    errorLog: JSON.stringify([
      {
        row: 45,
        error: '邮箱格式无效',
        data: {
          name: '测试用户',
          email: 'invalid-email',
          activityId: techSummitActivity.id
        }
      },
      {
        row: 78,
        error: '缺少姓名字段',
        data: {
          email: 'missing@example.com',
          activityId: techSummitActivity.id
        }
      }
    ])
  });

  await ImportBatch.create({
    id: uuidv4(),
    fileName: 'ai_workshop_import.csv',
    totalRecords: 85,
    successCount: 85,
    failureCount: 0,
    status: 'completed' as any,
    importedBy: operator.id
  });

  const totalRegistrations = await Registration.count();
  const totalActivities = await Activity.count();

  logger.info('播种完成!');
  logger.info(`创建用户: 4`);
  logger.info(`创建活动: ${totalActivities}`);
  logger.info(`创建报名记录: ${totalRegistrations}`);
  logger.info('');
  logger.info('登录账户:');
  logger.info('  管理员: admin@example.com / admin123');
  logger.info('  经理: manager@example.com / manager123');
  logger.info('  运营: operator@example.com / operator123');
  logger.info('  查看: viewer@example.com / viewer123');

  process.exit(0);
}

seed().catch((error) => {
  logger.error('播种失败:', error);
  process.exit(1);
});
