import { connectDatabase } from '../config/database';
import { SalesPersonModel } from '../models/SalesPerson';
import { AssignmentRuleModel } from '../models/AssignmentRule';
import { LeadModel } from '../models/Lead';
import { FollowUpRecordModel } from '../models/FollowUpRecord';
import { v4 as uuidv4 } from 'uuid';
import { LeadStatus, CustomerLevel } from '../types';

const salesPeople = [
  {
    id: 'sales_1',
    name: '张明',
    email: 'zhangming@example.com',
    phone: '13800138001',
    regions: ['北京', '天津', '河北'],
    productExpertise: ['云服务器', '云数据库', 'AI解决方案'],
    maxLoad: 15,
    currentLoad: 8,
    isOnVacation: false,
    stats: { pending: 3, following: 5, converted: 12, rejected: 2, total: 22 }
  },
  {
    id: 'sales_2',
    name: '李华',
    email: 'lihua@example.com',
    phone: '13800138002',
    regions: ['上海', '江苏', '浙江'],
    productExpertise: ['企业应用', '数据中台', '云服务器'],
    maxLoad: 12,
    currentLoad: 12,
    isOnVacation: false,
    stats: { pending: 4, following: 8, converted: 15, rejected: 3, total: 30 }
  },
  {
    id: 'sales_3',
    name: '王芳',
    email: 'wangfang@example.com',
    phone: '13800138003',
    regions: ['广东', '福建', '海南'],
    productExpertise: ['安全服务', '云存储', '数据分析'],
    maxLoad: 15,
    currentLoad: 5,
    isOnVacation: false,
    stats: { pending: 2, following: 3, converted: 8, rejected: 1, total: 14 }
  },
  {
    id: 'sales_4',
    name: '刘强',
    email: 'liuqiang@example.com',
    phone: '13800138004',
    regions: ['四川', '重庆', '云南'],
    productExpertise: ['IoT平台', '边缘计算', '云数据库'],
    maxLoad: 10,
    currentLoad: 3,
    isOnVacation: true,
    vacationStart: new Date('2026-05-01'),
    vacationEnd: new Date('2026-05-15'),
    stats: { pending: 1, following: 2, converted: 5, rejected: 0, total: 8 }
  },
  {
    id: 'sales_5',
    name: '陈静',
    email: 'chenjing@example.com',
    phone: '13800138005',
    regions: ['湖北', '湖南', '江西', '安徽'],
    productExpertise: ['AI解决方案', '机器学习平台', '大数据分析'],
    maxLoad: 12,
    currentLoad: 6,
    isOnVacation: false,
    stats: { pending: 2, following: 4, converted: 10, rejected: 1, total: 17 }
  }
];

const assignmentRules = [
  {
    id: 'rule_1',
    name: '高价值客户优先分配',
    description: '高价值客户优先分配给经验丰富的销售',
    enabled: true,
    priority: 100,
    conditions: { customerLevels: [CustomerLevel.HIGH] },
    actions: { assignTo: ['sales_1', 'sales_5'], autoAssign: true, needsReview: false }
  },
  {
    id: 'rule_2',
    name: 'AI客户特殊分配',
    description: '对AI产品感兴趣的客户分配给AI专家',
    enabled: true,
    priority: 90,
    conditions: { products: ['AI解决方案', '机器学习平台'] },
    actions: { assignTo: ['sales_5'], autoAssign: true, needsReview: false }
  },
  {
    id: 'rule_3',
    name: '未知地区待复核',
    description: '地区信息缺失的线索需要人工复核',
    enabled: true,
    priority: 80,
    conditions: { regions: [] },
    actions: { autoAssign: false, needsReview: true }
  }
];

const sampleLeads = [
  {
    id: 'lead_001',
    name: '张伟',
    phone: '13912345678',
    email: 'zhangwei@tech.com',
    company: '北京科技有限公司',
    position: '技术总监',
    region: '北京',
    productInterest: ['云服务器', '云数据库'],
    customerLevel: CustomerLevel.HIGH,
    source: '线上展会-北京站',
    status: LeadStatus.ASSIGNED,
    assignedTo: 'sales_1',
    assignmentReason: '地区匹配',
    assignmentDetails: '地区匹配：线索来自"北京"，该销售负责此地区，同时产品兴趣匹配',
    isDuplicate: false,
    assignmentHistory: [
      {
        id: uuidv4(),
        salesId: 'sales_1',
        salesName: '张明',
        reason: '地区匹配',
        details: '地区匹配：线索来自"北京"，该销售负责此地区，同时产品兴趣匹配',
        timestamp: new Date('2026-05-01'),
        isReassignment: false
      }
    ],
    createdAt: new Date('2026-05-01'),
    updatedAt: new Date('2026-05-01')
  },
  {
    id: 'lead_002',
    name: '李娜',
    phone: '13887654321',
    email: 'lina@shanghai-corp.com',
    company: '上海企业集团',
    position: '采购经理',
    region: '上海',
    productInterest: ['企业应用', '数据中台'],
    customerLevel: CustomerLevel.MEDIUM,
    source: '线上展会-上海站',
    status: LeadStatus.NEEDS_REVIEW,
    assignmentReason: '销售超负载',
    assignmentDetails: '负责"上海"地区的销售人员全部超负载',
    isDuplicate: false,
    assignmentHistory: [],
    createdAt: new Date('2026-05-05'),
    updatedAt: new Date('2026-05-05')
  },
  {
    id: 'lead_003',
    name: '王明',
    phone: '13711112222',
    email: 'wangming@guangdong-it.com',
    company: '广东IT科技',
    position: 'CEO',
    region: '广东',
    productInterest: ['安全服务', '云存储'],
    customerLevel: CustomerLevel.HIGH,
    source: '线上展会-深圳站',
    status: LeadStatus.FOLLOWING,
    assignedTo: 'sales_3',
    assignmentReason: '地区匹配',
    assignmentDetails: '地区匹配：线索来自"广东"，该销售负责此地区，同时产品兴趣匹配',
    isDuplicate: false,
    assignmentHistory: [
      {
        id: uuidv4(),
        salesId: 'sales_3',
        salesName: '王芳',
        reason: '地区匹配',
        details: '地区匹配：线索来自"广东"，该销售负责此地区，同时产品兴趣匹配',
        timestamp: new Date('2026-05-03'),
        isReassignment: false
      }
    ],
    createdAt: new Date('2026-05-03'),
    updatedAt: new Date('2026-05-06')
  },
  {
    id: 'lead_004',
    name: '赵丽',
    phone: '13655556666',
    email: '',
    company: '',
    position: '',
    region: '',
    productInterest: ['AI解决方案'],
    customerLevel: CustomerLevel.LOW,
    source: '线上展会-未确定',
    status: LeadStatus.NEEDS_REVIEW,
    assignmentReason: '地区未知待复核',
    assignmentDetails: '线索地区未知，需要人工复核',
    isDuplicate: false,
    assignmentHistory: [],
    createdAt: new Date('2026-05-07'),
    updatedAt: new Date('2026-05-07')
  },
  {
    id: 'lead_005',
    name: '孙强',
    phone: '13912345678',
    email: 'sunqiang@tech.com',
    company: '北京科技有限公司',
    position: '技术经理',
    region: '北京',
    productInterest: ['云服务器'],
    customerLevel: CustomerLevel.MEDIUM,
    source: '线上展会-北京站',
    status: LeadStatus.PENDING,
    isDuplicate: true,
    duplicateOf: 'lead_001',
    assignmentHistory: [],
    createdAt: new Date('2026-05-08'),
    updatedAt: new Date('2026-05-08')
  },
  {
    id: 'lead_006',
    name: '周杰',
    phone: '13599998888',
    email: 'zhoujie@hubei-ai.com',
    company: '湖北AI科技公司',
    position: 'CTO',
    region: '湖北',
    productInterest: ['AI解决方案', '机器学习平台'],
    customerLevel: CustomerLevel.HIGH,
    source: '线上展会-武汉站',
    status: LeadStatus.ASSIGNED,
    assignedTo: 'sales_5',
    assignmentReason: '客户等级优先级',
    assignmentDetails: '匹配规则"高价值客户优先分配"，分配给指定销售人员',
    isDuplicate: false,
    assignmentHistory: [
      {
        id: uuidv4(),
        salesId: 'sales_5',
        salesName: '陈静',
        reason: '客户等级优先级',
        details: '匹配规则"高价值客户优先分配"，分配给指定销售人员',
        timestamp: new Date('2026-05-04'),
        isReassignment: false
      }
    ],
    createdAt: new Date('2026-05-04'),
    updatedAt: new Date('2026-05-04')
  },
  {
    id: 'lead_007',
    name: '吴敏',
    phone: '13477778888',
    email: 'wumin@sichuan-iot.com',
    company: '四川物联网公司',
    position: '产品经理',
    region: '四川',
    productInterest: ['IoT平台', '边缘计算'],
    customerLevel: CustomerLevel.MEDIUM,
    source: '线上展会-成都站',
    status: LeadStatus.NEEDS_REVIEW,
    assignmentReason: '销售休假',
    assignmentDetails: '销售休假中，无法分配',
    isDuplicate: false,
    assignmentHistory: [],
    createdAt: new Date('2026-05-10'),
    updatedAt: new Date('2026-05-10')
  }
];

const followUpRecords = [
  {
    id: uuidv4(),
    leadId: 'lead_003',
    salesId: 'sales_3',
    salesName: '王芳',
    status: '首次联系',
    notes: '电话联系客户，对安全服务很感兴趣，约定下周一详细沟通',
    followUpDate: new Date('2026-05-05'),
    nextFollowUpDate: new Date('2026-05-12'),
    createdAt: new Date('2026-05-05')
  }
];

async function seedDatabase() {
  console.log('开始初始化数据库...');
  
  await connectDatabase();

  await SalesPersonModel.deleteMany({});
  await AssignmentRuleModel.deleteMany({});
  await LeadModel.deleteMany({});
  await FollowUpRecordModel.deleteMany({});

  console.log('清理旧数据完成');

  await SalesPersonModel.insertMany(salesPeople);
  console.log('销售人员数据插入完成:', salesPeople.length, '条');

  await AssignmentRuleModel.insertMany(assignmentRules);
  console.log('分配规则数据插入完成:', assignmentRules.length, '条');

  await LeadModel.insertMany(sampleLeads);
  console.log('线索数据插入完成:', sampleLeads.length, '条');

  await FollowUpRecordModel.insertMany(followUpRecords);
  console.log('跟进记录数据插入完成:', followUpRecords.length, '条');

  console.log('');
  console.log('========================================');
  console.log('数据库初始化完成！');
  console.log('========================================');
  console.log('');
  console.log('【样例数据说明】');
  console.log('1. 正常分配：lead_001（北京客户）→ 张明（地区+产品匹配）');
  console.log('2. 重复线索：lead_005（手机号与lead_001重复）');
  console.log('3. 销售超负载：lead_002（上海客户，李华已达上限12/12）');
  console.log('4. 地区未知：lead_004（地区信息缺失，待复核）');
  console.log('5. 销售休假：lead_007（四川客户，刘强正在休假）');
  console.log('6. 规则匹配：lead_006（高价值+AI产品 → 陈静）');
  console.log('');

  process.exit(0);
}

seedDatabase().catch(console.error);
