import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { Tenant, TenantStatus } from '../entities/Tenant';
import { Package, PackageType } from '../entities/Package';
import { OverchargeRecord, OverchargeType } from '../entities/OverchargeRecord';
import { Appeal, AppealStatus, AppealType } from '../entities/Appeal';
import { AppealHistory, OperationType } from '../entities/AppealHistory';
import { addDays, subDays, addHours, addMinutes } from 'date-fns';

async function seed() {
  await AppDataSource.initialize();
  console.log('数据库连接成功，开始生成种子数据...');

  const tenantRepo = AppDataSource.getRepository(Tenant);
  const packageRepo = AppDataSource.getRepository(Package);
  const overchargeRepo = AppDataSource.getRepository(OverchargeRecord);
  const appealRepo = AppDataSource.getRepository(Appeal);
  const historyRepo = AppDataSource.getRepository(AppealHistory);

  const tenant1 = await tenantRepo.save({
    tenantCode: 'TENANT_001',
    tenantName: '北京科技有限公司',
    contactPerson: '张三',
    contactPhone: '13800138001',
    contactEmail: 'zhangsan@bjtech.com',
    industry: '互联网',
    region: '北京',
    status: TenantStatus.RESTORED,
    totalOverchargeAmount: 15680.50,
    responsiblePerson: '王经理',
    businessObject: '电商平台业务'
  });

  const tenant2 = await tenantRepo.save({
    tenantCode: 'TENANT_002',
    tenantName: '上海数据服务公司',
    contactPerson: '李四',
    contactPhone: '13800138002',
    contactEmail: 'lisi@shdata.com',
    industry: '金融',
    region: '上海',
    status: TenantStatus.APPEALING,
    totalOverchargeAmount: 45200.00,
    responsiblePerson: '李总监',
    businessObject: '风控系统业务'
  });

  const tenant3 = await tenantRepo.save({
    tenantCode: 'TENANT_003',
    tenantName: '广州智能科技公司',
    contactPerson: '王五',
    contactPhone: '13800138003',
    contactEmail: 'wangwu@gzsmart.com',
    industry: '智能制造',
    region: '广州',
    status: TenantStatus.FROZEN,
    totalOverchargeAmount: 28900.75,
    responsiblePerson: '赵主管',
    businessObject: 'IoT设备管理'
  });

  const tenant4 = await tenantRepo.save({
    tenantCode: 'TENANT_004',
    tenantName: '深圳云计算有限公司',
    contactPerson: '赵六',
    contactPhone: '13800138004',
    contactEmail: 'zhaoliu@szcloud.com',
    industry: '云计算',
    region: '深圳',
    status: TenantStatus.NORMAL,
    totalOverchargeAmount: 0,
    responsiblePerson: '孙经理',
    businessObject: '云存储服务'
  });

  const pkg1 = await packageRepo.save({
    packageName: '企业版套餐-2026',
    packageType: PackageType.ENTERPRISE,
    quotaAmount: 100000.00,
    usedAmount: 115680.50,
    effectiveDate: subDays(new Date(), 90),
    expiryDate: addDays(new Date(), 275),
    isActive: true,
    tenantId: tenant1.id
  });

  const pkg2 = await packageRepo.save({
    packageName: '专业版套餐-2026',
    packageType: PackageType.PROFESSIONAL,
    quotaAmount: 50000.00,
    usedAmount: 95200.00,
    effectiveDate: subDays(new Date(), 60),
    expiryDate: addDays(new Date(), 305),
    isActive: true,
    tenantId: tenant2.id
  });

  const pkg3 = await packageRepo.save({
    packageName: '标准版套餐-2026',
    packageType: PackageType.STANDARD,
    quotaAmount: 30000.00,
    usedAmount: 58900.75,
    effectiveDate: subDays(new Date(), 30),
    expiryDate: addDays(new Date(), 335),
    isActive: true,
    tenantId: tenant3.id
  });

  const pkg4 = await packageRepo.save({
    packageName: '基础版套餐-2026',
    packageType: PackageType.BASIC,
    quotaAmount: 10000.00,
    usedAmount: 8500.00,
    effectiveDate: subDays(new Date(), 15),
    expiryDate: addDays(new Date(), 350),
    isActive: true,
    tenantId: tenant4.id
  });

  const overcharge1_1 = await overchargeRepo.save({
    recordCode: 'OVER_001_01',
    overchargeType: OverchargeType.API_CALL,
    overchargeAmount: 8680.50,
    unitPrice: 0.005,
    quantity: 1736100,
    occurrenceDate: subDays(new Date(), 20),
    description: '4月API调用超量，套餐额度10亿次，实际调用11.7361亿次',
    isDisputed: true,
    packageId: pkg1.id
  });

  const overcharge1_2 = await overchargeRepo.save({
    recordCode: 'OVER_001_02',
    overchargeType: OverchargeType.STORAGE,
    overchargeAmount: 7000.00,
    unitPrice: 0.02,
    quantity: 350000,
    occurrenceDate: subDays(new Date(), 15),
    description: '存储超量350GB',
    isDisputed: true,
    packageId: pkg1.id
  });

  const overcharge2_1 = await overchargeRepo.save({
    recordCode: 'OVER_002_01',
    overchargeType: OverchargeType.BANDWIDTH,
    overchargeAmount: 45200.00,
    unitPrice: 0.08,
    quantity: 565000,
    occurrenceDate: subDays(new Date(), 10),
    description: '带宽超量565TB，因活动引流突发流量',
    isDisputed: true,
    packageId: pkg2.id
  });

  const overcharge3_1 = await overchargeRepo.save({
    recordCode: 'OVER_003_01',
    overchargeType: OverchargeType.USER_SEAT,
    overchargeAmount: 28900.75,
    unitPrice: 99.00,
    quantity: 292,
    occurrenceDate: subDays(new Date(), 5),
    description: '用户坐席超量292个',
    isDisputed: true,
    packageId: pkg3.id
  });

  const appeal1 = await appealRepo.save({
    appealCode: 'APPEAL_001',
    appealType: AppealType.OVERCHARGE_DISPUTE,
    status: AppealStatus.COMPLETED,
    reason: '系统统计错误导致API调用量虚高',
    description: '客户反馈4月API调用量与内部监控数据不符，相差约2000万次，要求重新核算',
    evidenceFiles: ['https://example.com/evidence/统计对比表.xlsx', 'https://example.com/evidence/监控截图.png'],
    disputeAmount: 8680.50,
    submitterName: '张三',
    submitterPhone: '13800138001',
    submitterEmail: 'zhangsan@bjtech.com',
    reviewerName: '王经理',
    reviewOpinion: '经核对，确实存在统计误差，同意减免超额费用并恢复服务',
    reviewedAt: subDays(new Date(), 3),
    expectedResolutionDate: addDays(new Date(), 7),
    tenantId: tenant1.id,
    submissionCount: 3,
    source: 'web_portal',
    isBadRecord: false
  });

  const appeal2 = await appealRepo.save({
    appealCode: 'APPEAL_002',
    appealType: AppealType.RESTORATION_REQUEST,
    status: AppealStatus.REVIEWING,
    reason: '已完成补缴，申请恢复服务',
    description: '客户于今日完成补缴45200元，申请立即恢复服务',
    evidenceFiles: ['https://example.com/evidence/付款凭证.pdf'],
    disputeAmount: 0,
    submitterName: '李四',
    submitterPhone: '13800138002',
    submitterEmail: 'lisi@shdata.com',
    reviewerName: '李总监',
    expectedResolutionDate: addDays(new Date(), 1),
    tenantId: tenant2.id,
    submissionCount: 1,
    source: 'web_portal',
    isBadRecord: false
  });

  const appeal3 = await appealRepo.save({
    appealCode: 'APPEAL_003',
    appealType: AppealType.OVERCHARGE_DISPUTE,
    status: AppealStatus.PENDING,
    reason: '坐席数量统计包含已离职员工',
    description: '系统统计的292个坐席中包含45名已离职员工，要求扣除该部分费用',
    evidenceFiles: ['https://example.com/evidence/员工离职证明.zip'],
    disputeAmount: 4455.00,
    submitterName: '王五',
    submitterPhone: '13800138003',
    submitterEmail: 'wangwu@gzsmart.com',
    expectedResolutionDate: addDays(new Date(), 5),
    tenantId: tenant3.id,
    submissionCount: 1,
    source: 'import_batch_20260515',
    importBatchId: 'batch_20260515_001',
    isBadRecord: false
  });

  const appealBad = await appealRepo.save({
    appealCode: 'APPEAL_BAD_001',
    appealType: AppealType.OVERCHARGE_DISPUTE,
    status: AppealStatus.PENDING,
    reason: '',
    description: '该记录为导入时的坏行，缺少必填字段',
    evidenceFiles: [],
    disputeAmount: 0,
    submitterName: '',
    tenantId: tenant3.id,
    submissionCount: 0,
    source: 'import_batch_20260515',
    importBatchId: 'batch_20260515_001',
    isBadRecord: true,
    badRecordReason: '申诉原因不能为空；申诉金额格式错误；提交人姓名不能为空'
  });

  const historyRecords = [
    {
      operationType: OperationType.FREEZE,
      operatorName: '系统自动',
      operationRemark: '租户超额达到冻结阈值，系统自动冻结',
      tenantStatusBefore: TenantStatus.NORMAL,
      tenantStatusAfter: TenantStatus.FROZEN,
      appealId: appeal1.id,
      tenantId: tenant1.id,
      operatedAt: subDays(new Date(), 18)
    },
    {
      operationType: OperationType.SUBMIT,
      operatorName: '张三',
      operationRemark: '首次提交申诉申请，附带统计对比表',
      tenantStatusBefore: TenantStatus.FROZEN,
      tenantStatusAfter: TenantStatus.APPEALING,
      appealStatusBefore: null as any,
      appealStatusAfter: AppealStatus.PENDING,
      requestId: 'req_001_001',
      appealId: appeal1.id,
      tenantId: tenant1.id,
      operatedAt: subDays(new Date(), 17)
    },
    {
      operationType: OperationType.REVIEW,
      operatorName: '王经理',
      operationRemark: '开始审核申诉材料，初步确认数据异常',
      appealStatusBefore: AppealStatus.PENDING,
      appealStatusAfter: AppealStatus.REVIEWING,
      appealId: appeal1.id,
      tenantId: tenant1.id,
      operatedAt: subDays(new Date(), 12)
    },
    {
      operationType: OperationType.RESUBMIT,
      operatorName: '张三',
      operationRemark: '补充提交监控截图证据',
      appealStatusBefore: AppealStatus.REVIEWING,
      appealStatusAfter: AppealStatus.REVIEWING,
      requestId: 'req_001_002',
      appealId: appeal1.id,
      tenantId: tenant1.id,
      operatedAt: subDays(new Date(), 10)
    },
    {
      operationType: OperationType.APPROVE,
      operatorName: '王经理',
      operationRemark: '审核通过，同意减免8680.50元',
      appealStatusBefore: AppealStatus.REVIEWING,
      appealStatusAfter: AppealStatus.APPROVED,
      appealId: appeal1.id,
      tenantId: tenant1.id,
      operatedAt: subDays(new Date(), 5)
    },
    {
      operationType: OperationType.PAYMENT,
      operatorName: '张三',
      operationRemark: '客户完成剩余超额款项补缴7000元',
      appealId: appeal1.id,
      tenantId: tenant1.id,
      operatedAt: subDays(new Date(), 4)
    },
    {
      operationType: OperationType.RESTORE,
      operatorName: '系统自动',
      operationRemark: '完成申诉处理，恢复租户服务',
      tenantStatusBefore: TenantStatus.APPEALING,
      tenantStatusAfter: TenantStatus.RESTORED,
      appealStatusBefore: AppealStatus.APPROVED,
      appealStatusAfter: AppealStatus.COMPLETED,
      appealId: appeal1.id,
      tenantId: tenant1.id,
      operatedAt: subDays(new Date(), 3)
    },
    {
      operationType: OperationType.RESTORE,
      operatorName: '张三',
      operationRemark: '客户重复点击恢复按钮-第1次',
      isDuplicateSubmission: true,
      appealId: appeal1.id,
      tenantId: tenant1.id,
      operatedAt: addMinutes(addHours(subDays(new Date(), 2), 5), 30)
    },
    {
      operationType: OperationType.RESTORE,
      operatorName: '张三',
      operationRemark: '客户重复点击恢复按钮-第2次',
      isDuplicateSubmission: true,
      appealId: appeal1.id,
      tenantId: tenant1.id,
      operatedAt: addMinutes(addHours(subDays(new Date(), 2), 5), 32)
    },
    {
      operationType: OperationType.RESTORE,
      operatorName: '回调接口',
      operationRemark: '支付网关异步回调重复触发恢复',
      isDuplicateSubmission: true,
      appealId: appeal1.id,
      tenantId: tenant1.id,
      operatedAt: addHours(subDays(new Date(), 2), 6)
    },
    {
      operationType: OperationType.FREEZE,
      operatorName: '系统自动',
      operationRemark: '租户超额达到冻结阈值，系统自动冻结',
      tenantStatusBefore: TenantStatus.NORMAL,
      tenantStatusAfter: TenantStatus.FROZEN,
      appealId: appeal2.id,
      tenantId: tenant2.id,
      operatedAt: subDays(new Date(), 8)
    },
    {
      operationType: OperationType.SUBMIT,
      operatorName: '李四',
      operationRemark: '提交恢复申请，附带付款凭证',
      tenantStatusBefore: TenantStatus.FROZEN,
      tenantStatusAfter: TenantStatus.APPEALING,
      appealStatusBefore: null as any,
      appealStatusAfter: AppealStatus.PENDING,
      requestId: 'req_002_001',
      appealId: appeal2.id,
      tenantId: tenant2.id,
      operatedAt: subDays(new Date(), 1)
    },
    {
      operationType: OperationType.REVIEW,
      operatorName: '李总监',
      operationRemark: '收到付款凭证，开始审核',
      appealStatusBefore: AppealStatus.PENDING,
      appealStatusAfter: AppealStatus.REVIEWING,
      appealId: appeal2.id,
      tenantId: tenant2.id,
      operatedAt: addHours(new Date(), 10)
    },
    {
      operationType: OperationType.IMPORT,
      operatorName: '系统导入',
      operationRemark: '批量导入申诉记录',
      appealStatusBefore: null as any,
      appealStatusAfter: AppealStatus.PENDING,
      appealId: appeal3.id,
      tenantId: tenant3.id,
      operatedAt: subDays(new Date(), 3)
    },
    {
      operationType: OperationType.IMPORT,
      operatorName: '系统导入',
      operationRemark: '导入坏行记录',
      appealId: (appealBad as any).id,
      tenantId: tenant3.id,
      operatedAt: subDays(new Date(), 3)
    }
  ];

  for (const record of historyRecords) {
    await historyRepo.save(record as any);
  }

  await overchargeRepo.update(overcharge1_1.id, { appealId: appeal1.id });
  await overchargeRepo.update(overcharge1_2.id, { appealId: appeal1.id });
  await overchargeRepo.update(overcharge2_1.id, { appealId: appeal2.id });
  await overchargeRepo.update(overcharge3_1.id, { appealId: appeal3.id });

  console.log('种子数据生成完成！');
  console.log('');
  console.log('=== 数据概览 ===');
  console.log(`租户: 4个 (正常:1, 冻结中:1, 申诉中:1, 已恢复:1)`);
  console.log(`套餐: 4个`);
  console.log(`超额记录: 4条`);
  console.log(`申诉单: 4个 (含1条导入坏行)`);
  console.log(`历史记录: 15条 (含3条重复提交记录)`);
  console.log('');
  console.log('=== 验收场景 ===');
  console.log('1. 完整流转: APPEAL_001 (北京科技有限公司) - 冻结→申诉→审核→通过→补缴→恢复 + 3次重复提交');
  console.log('2. 冲突记录: APPEAL_001 历史记录中包含重复点击、异步回调的重复恢复请求');
  console.log('3. 导入坏行: APPEAL_BAD_001 - 批量导入时产生的坏行记录');
  console.log('');

  await AppDataSource.destroy();
}

seed().catch(console.error);
