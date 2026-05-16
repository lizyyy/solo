import { v4 as uuidv4 } from 'uuid';
import { addDays, format, subDays } from 'date-fns';
import {
  insertOfflineMemberRenewal,
  insertWhitelistRecord,
  insertLabSample,
  insertAbnormalSample,
  initDatabase
} from './database';

const STORES = [
  { id: 'ST001', name: '北京朝阳门店' },
  { id: 'ST002', name: '上海静安寺店' },
  { id: 'ST003', name: '广州天河城店' },
  { id: 'ST004', name: '深圳华强北店' },
  { id: 'ST005', name: '杭州西湖店' }
];

const OPERATORS = [
  { id: 'OP001', name: '张经理' },
  { id: 'OP002', name: '李主管' },
  { id: 'OP003', name: '王专员' },
  { id: 'OP004', name: '赵审核' },
  { id: 'OP005', name: '刘风控' }
];

const REQUESTERS = [
  '会员运营部',
  '风控合规部',
  '客户服务中心',
  '门店管理部',
  '财务审计组',
  '反欺诈调查组',
  '质量管理部',
  '数据合规组'
];

const MEMBER_PLANS = [
  '月卡会员',
  '季卡会员',
  '年卡会员',
  '家庭年卡',
  '企业年卡',
  '学生季卡'
];

const PAYMENT_METHODS = [
  '微信支付',
  '支付宝',
  '银行卡',
  '现金',
  '积分兑换'
];

const RISK_TYPES = [
  '正常交易',
  '疑似套现',
  '异常充值',
  '退款异常',
  '频繁交易',
  '异地登录'
];

const RISK_LEVELS = ['低', '中', '高'];

const LAB_SAMPLE_TYPES = [
  '身份核验样本',
  '交易凭证样本',
  '退款申请样本',
  '活动参与样本',
  '投诉处理样本'
];

const TEST_RESULTS = ['通过', '不通过', '待复核'];

function generatePhone(): string {
  const prefixes = ['138', '139', '158', '159', '186', '188', '136', '137'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return prefix + suffix;
}

function generateMemberName(): string {
  const surnames = ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '周', '徐', '孙', '马', '朱', '胡'];
  const names = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '洋', '艳', '勇', '军', '杰', '娟', '涛', '明', '超', '秀', '霞', '平'];
  return surnames[Math.floor(Math.random() * surnames.length)] + 
         names[Math.floor(Math.random() * names.length)] + 
         (Math.random() > 0.5 ? names[Math.floor(Math.random() * names.length)] : '');
}

function generateTransactionId(): string {
  return 'TXN' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function generateDemoData(batchId?: string): Promise<{
  batchId: string;
  renewalsCount: number;
  whitelistCount: number;
  labSamplesCount: number;
  abnormalCount: number;
}> {
  await initDatabase();
  
  const actualBatchId = batchId || `BATCH-${format(new Date(), 'yyyyMMdd')}-${uuidv4().substring(0, 8).toUpperCase()}`;
  const baseDate = new Date();
  
  const renewalCount = 50 + Math.floor(Math.random() * 30);
  const whitelistCount = 8 + Math.floor(Math.random() * 5);
  const labSampleCount = 15 + Math.floor(Math.random() * 10);
  
  const whitelistMemberIds: string[] = [];
  
  for (let i = 0; i < whitelistCount; i++) {
    const memberId = `M${(10000 + i).toString()}`;
    whitelistMemberIds.push(memberId);
    const store = STORES[Math.floor(Math.random() * STORES.length)];
    const operator = OPERATORS[Math.floor(Math.random() * OPERATORS.length)];
    const createDate = subDays(baseDate, Math.floor(Math.random() * 30));
    const expiryDate = addDays(createDate, 90);
    
    const isRevoked = i !== 0;
    const revokeDate = isRevoked ? addDays(createDate, Math.floor(Math.random() * 30)) : undefined;
    const revokeOperator = isRevoked ? OPERATORS[Math.floor(Math.random() * OPERATORS.length)] : undefined;
    
    await insertWhitelistRecord({
      memberId,
      memberName: generateMemberName(),
      reason: i === 0 ? '特殊客户临时白名单-待复核' : ['大客户绿色通道', '活动特殊审批', '误操作补录', '客服投诉处理'][Math.floor(Math.random() * 4)],
      operatorId: operator.id,
      operatorName: operator.name,
      createdAt: createDate.toISOString(),
      expiryDate: expiryDate.toISOString(),
      isRevoked,
      revokedAt: revokeDate?.toISOString(),
      revokedBy: revokeOperator?.name,
      revokeReason: isRevoked ? ['到期自动撤销', '人工审核撤回', '风控规则触发'][Math.floor(Math.random() * 3)] : undefined,
      batchId: actualBatchId
    });
  }
  
  const renewalIds: string[] = [];
  
  for (let i = 0; i < renewalCount; i++) {
    const memberId = `M${(10000 + i).toString()}`;
    const store = STORES[Math.floor(Math.random() * STORES.length)];
    const operator = OPERATORS[Math.floor(Math.random() * OPERATORS.length)];
    const renewalDate = subDays(baseDate, Math.floor(Math.random() * 30));
    const isWhitelisted = whitelistMemberIds.includes(memberId);
    
    const riskIndex = Math.random() > 0.7 ? Math.floor(Math.random() * (RISK_TYPES.length - 1)) + 1 : 0;
    const riskType = RISK_TYPES[riskIndex];
    const riskLevel = riskIndex === 0 ? RISK_LEVELS[0] : RISK_LEVELS[Math.floor(Math.random() * 3)];
    
    const originalPlan = MEMBER_PLANS[Math.floor(Math.random() * MEMBER_PLANS.length)];
    const renewedPlan = MEMBER_PLANS[Math.floor(Math.random() * MEMBER_PLANS.length)];
    
    const amounts: Record<string, number> = {
      '月卡会员': 99,
      '季卡会员': 269,
      '年卡会员': 999,
      '家庭年卡': 1699,
      '企业年卡': 2999,
      '学生季卡': 199
    };
    
    const rawInput = {
      batchId: actualBatchId,
      importTime: new Date().toISOString(),
      sourceSystem: '会员管理系统V2.3',
      operatorId: operator.id,
      operatorName: operator.name,
      terminalId: `POS${store.id}${Math.floor(Math.random() * 100).toString().padStart(3, '0')}`,
      originalMemberPlan: originalPlan,
      renewedMemberPlan: renewedPlan,
      memberPhone: generatePhone(),
      memberLevel: ['普通会员', '银卡会员', '金卡会员', '钻石会员'][Math.floor(Math.random() * 4)],
      pointsBefore: Math.floor(Math.random() * 5000),
      pointsEarned: Math.floor(Math.random() * 500),
      promotionCode: Math.random() > 0.6 ? `PROMO${Math.floor(Math.random() * 1000)}` : null,
      invoiceRequired: Math.random() > 0.7,
      remark: Math.random() > 0.8 ? '客户备注：需要快速开通' : ''
    };
    
    await insertOfflineMemberRenewal({
      batchId: actualBatchId,
      memberId,
      memberName: generateMemberName(),
      phoneNumber: rawInput.memberPhone,
      originalPlan,
      renewedPlan,
      renewalAmount: amounts[renewedPlan] || 299,
      paymentMethod: PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)],
      transactionId: generateTransactionId(),
      operatorId: operator.id,
      operatorName: operator.name,
      renewalDate: format(renewalDate, 'yyyy-MM-dd'),
      effectiveDate: format(renewalDate, 'yyyy-MM-dd'),
      expiryDate: format(addDays(renewalDate, renewedPlan.includes('年') ? 365 : renewedPlan.includes('季') ? 90 : 30), 'yyyy-MM-dd'),
      storeId: store.id,
      storeName: store.name,
      riskType,
      riskLevel,
      isWhitelisted,
      whitelistExpiry: isWhitelisted ? format(addDays(renewalDate, 90), 'yyyy-MM-dd') : undefined,
      whitelistOperator: isWhitelisted ? OPERATORS[0].name : undefined,
      whitelistReason: isWhitelisted ? 'VIP客户特殊处理' : undefined,
      labSampleId: i < 5 ? `LAB${(1000 + i).toString()}` : undefined,
      labNotes: i < 5 ? '实验室核验已完成' : undefined,
      rawInput
    });
    
    renewalIds.push(memberId);
    
    if (riskIndex > 0) {
      await insertAbnormalSample({
        sourceType: 'renewal',
        sourceId: memberId,
        batchId: actualBatchId,
        riskType,
        riskLevel,
        description: `${memberId} 会员续费触发风控规则 - ${riskType}`,
        detectedAt: new Date().toISOString(),
        detectedBy: '风控系统自动检测',
        status: riskLevel === '高' ? 'pending' : (riskLevel === '中' ? 'reviewed' : 'resolved'),
        assignee: riskLevel === '高' ? OPERATORS[4].name : undefined,
        exportStatus: 'not_exported',
        notes: riskLevel === '高' ? '需要人工复核' : '系统自动处理'
      });
    }
  }
  
  for (let i = 0; i < labSampleCount; i++) {
    const sampleCode = `LAB${(10000 + i).toString().padStart(5, '0')}`;
    const sampleType = LAB_SAMPLE_TYPES[Math.floor(Math.random() * LAB_SAMPLE_TYPES.length)];
    const collectionDate = subDays(baseDate, Math.floor(Math.random() * 15));
    const status = Math.random() > 0.3 ? 'completed' : 'pending';
    
    const manualNotesList = [
      '样本清晰，信息完整，核验通过',
      '客户签名略有模糊，但不影响识别',
      '身份证件有效期已核实',
      '补充材料已收到，符合要求',
      '需要联系客户补充交易凭证',
      '样本存在涂改痕迹，待进一步核实',
      '与历史样本比对一致',
      '交易背景调查正常',
      '关联账户已排查，无异常',
      '异常样本已上报主管'
    ];
    
    await insertLabSample({
      sampleCode,
      batchId: actualBatchId,
      memberId: i < renewalIds.length ? renewalIds[i] : undefined,
      sampleType,
      collectionDate: format(collectionDate, 'yyyy-MM-dd'),
      collectionSite: STORES[Math.floor(Math.random() * STORES.length)].name,
      collector: OPERATORS[Math.floor(Math.random() * 3)].name,
      tester: OPERATORS[3 + Math.floor(Math.random() * 2)].name,
      testResult: TEST_RESULTS[Math.floor(Math.random() * TEST_RESULTS.length)],
      testDate: status === 'completed' ? format(addDays(collectionDate, 2), 'yyyy-MM-dd') : undefined,
      manualNotes: manualNotesList[Math.floor(Math.random() * manualNotesList.length)],
      reviewer: status === 'completed' ? OPERATORS[4].name : undefined,
      reviewDate: status === 'completed' ? format(addDays(collectionDate, 3), 'yyyy-MM-dd') : undefined,
      requester: REQUESTERS[Math.floor(Math.random() * REQUESTERS.length)],
      status,
      createdAt: collectionDate.toISOString()
    });
    
    if (Math.random() > 0.7) {
      await insertAbnormalSample({
        sourceType: 'lab',
        sourceId: sampleCode,
        batchId: actualBatchId,
        riskType: '实验室异常',
        riskLevel: ['中', '高'][Math.floor(Math.random() * 2)],
        description: `样本 ${sampleCode} 检测发现异常`,
        detectedAt: new Date().toISOString(),
        detectedBy: '实验室人工检测',
        status: 'pending',
        assignee: OPERATORS[3].name,
        exportStatus: 'not_exported',
        notes: '需要导出给复核组处理'
      });
    }
  }
  
  const abnormalSamples = await (await import('./database')).queryAbnormalSamples({ batchId: actualBatchId });
  
  return {
    batchId: actualBatchId,
    renewalsCount: renewalCount,
    whitelistCount: whitelistCount,
    labSamplesCount: labSampleCount,
    abnormalCount: abnormalSamples.length
  };
}

export function getDemoDataInfo(): string {
  return `
演示数据说明：
- 50-80条离线会员续费流水，包含真实的门店、操作员、套餐信息
- 8-13条白名单记录，其中第1条为未撤销的临时白名单（用于复核）
- 15-25条实验室样本，包含人工备注
- 异常样本自动记录，支持导出给同事复核

数据字段说明：
- 会员信息：ID、姓名、手机号
- 交易信息：套餐、金额、支付方式、交易号
- 操作信息：操作员、门店、日期
- 风控信息：风险类型、风险等级、白名单状态
- 溯源信息：原始输入完整保存，可回溯至导入时的原始数据
  `;
}
