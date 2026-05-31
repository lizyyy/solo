import type { SensitiveWord, QARecord, ContractClause, ImportLog, TrendDataPoint } from '@/types';

export const SENSITIVE_WORDS: SensitiveWord[] = [
  { id: 'sw1', word: '身份证号', category: '个人信息', isActive: true },
  { id: 'sw2', word: '银行卡号', category: '金融信息', isActive: true },
  { id: 'sw3', word: '手机号码', category: '个人信息', isActive: true },
  { id: 'sw4', word: '家庭住址', category: '个人信息', isActive: true },
  { id: 'sw5', word: '密码', category: '安全信息', isActive: true },
  { id: 'sw6', word: '薪资金额', category: '金融信息', isActive: true },
];

export const MOCK_CLAUSES: ContractClause[] = [
  { id: 'c1', clauseNumber: 'HT-001-A', content: '甲方应在合同签订后30个工作日内支付首期款项，金额为合同总价的30%', source: '采购合同模板v3.2', sourceLink: '/docs/contract-template-v3.2.pdf', importDate: '2026-05-20', importBatchId: 'batch-001' },
  { id: 'c2', clauseNumber: 'HT-001-B', content: '乙方应保证所提供的服务符合国家相关质量标准，如因服务质量问题造成甲方损失，乙方应承担相应赔偿责任', source: '服务合同模板v2.1', sourceLink: '/docs/service-template-v2.1.pdf', importDate: '2026-05-20', importBatchId: 'batch-001' },
  { id: 'c3', clauseNumber: 'HT-002-A', content: '合同有效期内，任何一方需提前终止合同，应提前60日书面通知对方', source: '劳动合同模板v4.0', sourceLink: '', importDate: '2026-05-21', importBatchId: 'batch-002' },
  { id: 'c4', clauseNumber: 'HT-002-B', content: '员工薪资金额按公司薪酬制度执行，银行卡号信息由财务部门统一管理', source: '劳动合同模板v4.0', sourceLink: '/docs/labor-template-v4.0.pdf', importDate: '2026-05-21', importBatchId: 'batch-002' },
  { id: 'c5', clauseNumber: 'HT-003-A', content: '保密期限自合同终止之日起延续2年，保密信息包括但不限于客户身份证号、手机号码等', source: '保密协议模板v1.5', sourceLink: '/docs/nda-v1.5.pdf', importDate: '2026-05-22', importBatchId: 'batch-003' },
  { id: 'c6', clauseNumber: 'HT-003-B', content: '违约方应向守约方支付合同总金额10%的违约金', source: '保密协议模板v1.5', sourceLink: '/docs/nda-v1.5.pdf', importDate: '2026-05-22', importBatchId: 'batch-003' },
  { id: 'c7', clauseNumber: 'HT-004-A', content: '甲方有权对乙方的工作进度进行监督，并要求乙方提供阶段性成果报告', source: '外包合同模板v2.0', sourceLink: '/invalid-link.pdf', importDate: '2026-05-23', importBatchId: 'batch-004' },
  { id: 'c8', clauseNumber: 'HT-004-B', content: '项目验收标准按照附件一执行，如需修改密码请通过安全渠道操作', source: '外包合同模板v2.0', sourceLink: '/docs/outsource-v2.0.pdf', importDate: '2026-05-23', importBatchId: 'batch-004' },
  { id: 'c9', clauseNumber: 'HT-005-A', content: '争议解决方式为提交仲裁委员会仲裁，仲裁地点为合同签订地', source: '通用合同条款v5.1', sourceLink: '/docs/general-v5.1.pdf', importDate: '2026-05-24', importBatchId: 'batch-005' },
  { id: 'c10', clauseNumber: 'HT-005-B', content: '不可抗力事件发生后，受影响方应在14日内书面通知对方并提供证明材料', source: '通用合同条款v5.1', sourceLink: '/docs/general-v5.1.pdf', importDate: '2026-05-24', importBatchId: 'batch-005' },
  { id: 'c11', clauseNumber: 'HT-006-A', content: '供应商需提供家庭住址用于发票寄送，寄送费用由供应商承担', source: '采购合同补充条款v1.0', sourceLink: '', importDate: '2026-05-25', importBatchId: 'batch-006' },
  { id: 'c12', clauseNumber: 'HT-006-B', content: '技术文档交付后，甲方应在15个工作日内完成审核并反馈意见', source: '采购合同补充条款v1.0', sourceLink: '/docs/procurement-supplement-v1.0.pdf', importDate: '2026-05-25', importBatchId: 'batch-006' },
];

export const MOCK_QA_RECORDS: QARecord[] = [
  {
    id: 'qa1', clauseId: 'c1', question: '首期款项的支付期限是多长？', answer: '甲方应在合同签订后30个工作日内支付首期款项', status: 'normal',
    judgmentReason: '三重检测全部通过：来源链路有效、灰度结论与报表一致、无敏感词漏脱敏',
    grayConclusion: '付款期限30工作日', reportConclusion: '付款期限30工作日',
    isGrayConflict: false, isSourceBroken: false, isSensitiveLeak: false, sensitiveWordsFound: [],
    createdAt: '2026-05-20T10:30:00', reviewedAt: null, reviewedBy: null,
  },
  {
    id: 'qa2', clauseId: 'c2', question: '服务质量问题的责任如何划分？', answer: '如因服务质量问题造成甲方损失，乙方应承担相应赔偿责任', status: 'normal',
    judgmentReason: '三重检测全部通过', grayConclusion: '乙方承担赔偿责任', reportConclusion: '乙方承担赔偿责任',
    isGrayConflict: false, isSourceBroken: false, isSensitiveLeak: false, sensitiveWordsFound: [],
    createdAt: '2026-05-20T10:31:00', reviewedAt: null, reviewedBy: null,
  },
  {
    id: 'qa3', clauseId: 'c3', question: '提前终止合同需要提前多久通知？', answer: '任何一方需提前终止合同，应提前60日书面通知对方', status: 'pending',
    judgmentReason: '答案来源断链：条款来源文档链接为空，无法验证该条款的出处和权威性',
    grayConclusion: '提前60日书面通知', reportConclusion: '提前30日书面通知',
    isGrayConflict: true, isSourceBroken: true, isSensitiveLeak: false, sensitiveWordsFound: [],
    createdAt: '2026-05-21T09:15:00', reviewedAt: null, reviewedBy: null,
  },
  {
    id: 'qa4', clauseId: 'c4', question: '员工薪资如何发放？', answer: '员工薪资金额按公司薪酬制度执行，银行卡号信息由财务部门统一管理', status: 'pending',
    judgmentReason: '敏感词漏脱敏：答案中包含"薪资金额"和"银行卡号"未脱敏处理',
    grayConclusion: '按薪酬制度执行', reportConclusion: '按薪酬制度执行',
    isGrayConflict: false, isSourceBroken: false, isSensitiveLeak: true, sensitiveWordsFound: ['薪资金额', '银行卡号'],
    createdAt: '2026-05-21T09:16:00', reviewedAt: null, reviewedBy: null,
  },
  {
    id: 'qa5', clauseId: 'c5', question: '保密信息的范围包括哪些？', answer: '保密信息包括但不限于客户身份证号、手机号码等', status: 'pending',
    judgmentReason: '敏感词漏脱敏：答案中包含"身份证号"和"手机号码"未脱敏处理',
    grayConclusion: '包含客户个人信息等', reportConclusion: '包含客户个人信息等',
    isGrayConflict: false, isSourceBroken: false, isSensitiveLeak: true, sensitiveWordsFound: ['身份证号', '手机号码'],
    createdAt: '2026-05-22T14:20:00', reviewedAt: null, reviewedBy: null,
  },
  {
    id: 'qa6', clauseId: 'c6', question: '违约金的计算方式是什么？', answer: '违约方应向守约方支付合同总金额10%的违约金', status: 'normal',
    judgmentReason: '三重检测全部通过', grayConclusion: '合同总金额10%', reportConclusion: '合同总金额10%',
    isGrayConflict: false, isSourceBroken: false, isSensitiveLeak: false, sensitiveWordsFound: [],
    createdAt: '2026-05-22T14:21:00', reviewedAt: null, reviewedBy: null,
  },
  {
    id: 'qa7', clauseId: 'c7', question: '甲方对乙方的工作有哪些监督权？', answer: '甲方有权对乙方的工作进度进行监督，并要求乙方提供阶段性成果报告', status: 'pending',
    judgmentReason: '答案来源断链：来源链接指向无效路径/invalid-link.pdf，无法访问验证；灰度结论与报表不一致：灰度判断为"监督权包含进度跟踪"，报表记录为"监督权仅限合同约定范围"',
    grayConclusion: '监督权包含进度跟踪', reportConclusion: '监督权仅限合同约定范围',
    isGrayConflict: true, isSourceBroken: true, isSensitiveLeak: false, sensitiveWordsFound: [],
    createdAt: '2026-05-23T11:00:00', reviewedAt: null, reviewedBy: null,
  },
  {
    id: 'qa8', clauseId: 'c8', question: '项目验收标准如何确定？', answer: '项目验收标准按照附件一执行，如需修改密码请通过安全渠道操作', status: 'pending',
    judgmentReason: '敏感词漏脱敏：答案中包含"密码"未脱敏处理',
    grayConclusion: '按附件一执行', reportConclusion: '按附件一执行',
    isGrayConflict: false, isSourceBroken: false, isSensitiveLeak: true, sensitiveWordsFound: ['密码'],
    createdAt: '2026-05-23T11:01:00', reviewedAt: null, reviewedBy: null,
  },
  {
    id: 'qa9', clauseId: 'c9', question: '争议解决的方式是什么？', answer: '争议解决方式为提交仲裁委员会仲裁，仲裁地点为合同签订地', status: 'confirmed',
    judgmentReason: '原标记为待确认（灰度冲突），经人工复核确认答案正确',
    grayConclusion: '提交仲裁', reportConclusion: '提交诉讼',
    isGrayConflict: true, isSourceBroken: false, isSensitiveLeak: false, sensitiveWordsFound: [],
    createdAt: '2026-05-24T08:45:00', reviewedAt: '2026-05-25T10:00:00', reviewedBy: '张质检',
  },
  {
    id: 'qa10', clauseId: 'c10', question: '不可抗力事件后的通知时限？', answer: '受影响方应在14日内书面通知对方并提供证明材料', status: 'normal',
    judgmentReason: '三重检测全部通过', grayConclusion: '14日内书面通知', reportConclusion: '14日内书面通知',
    isGrayConflict: false, isSourceBroken: false, isSensitiveLeak: false, sensitiveWordsFound: [],
    createdAt: '2026-05-24T08:46:00', reviewedAt: null, reviewedBy: null,
  },
  {
    id: 'qa11', clauseId: 'c11', question: '发票寄送地址要求？', answer: '供应商需提供家庭住址用于发票寄送，寄送费用由供应商承担', status: 'pending',
    judgmentReason: '答案来源断链：条款来源文档链接为空；敏感词漏脱敏：答案中包含"家庭住址"未脱敏',
    grayConclusion: '提供地址用于寄送', reportConclusion: '提供地址用于寄送',
    isGrayConflict: false, isSourceBroken: true, isSensitiveLeak: true, sensitiveWordsFound: ['家庭住址'],
    createdAt: '2026-05-25T16:30:00', reviewedAt: null, reviewedBy: null,
  },
  {
    id: 'qa12', clauseId: 'c12', question: '技术文档审核的反馈期限？', answer: '甲方应在15个工作日内完成审核并反馈意见', status: 'rejected',
    judgmentReason: '原标记为待确认（灰度冲突：灰度结论为15个工作日，报表结论为10个工作日），经复核确认报表数据为准，需修正',
    grayConclusion: '15个工作日内反馈', reportConclusion: '10个工作日内反馈',
    isGrayConflict: true, isSourceBroken: false, isSensitiveLeak: false, sensitiveWordsFound: [],
    createdAt: '2026-05-25T16:31:00', reviewedAt: '2026-05-26T09:00:00', reviewedBy: '李质检',
  },
];

export const MOCK_IMPORT_LOGS: ImportLog[] = [
  { id: 'il1', batchId: 'batch-001', fileName: '采购合同条款_20260520.xlsx', totalCount: 2, duplicateCount: 0, newCount: 2, status: 'success', importDate: '2026-05-20T10:00:00', operator: '王运营', snapshot: ['c1', 'c2'] },
  { id: 'il2', batchId: 'batch-002', fileName: '劳动合同条款_20260521.csv', totalCount: 2, duplicateCount: 0, newCount: 2, status: 'success', importDate: '2026-05-21T09:00:00', operator: '王运营', snapshot: ['c3', 'c4'] },
  { id: 'il3', batchId: 'batch-003', fileName: '保密协议条款_20260522.xlsx', totalCount: 2, duplicateCount: 0, newCount: 2, status: 'success', importDate: '2026-05-22T14:00:00', operator: '赵运营', snapshot: ['c5', 'c6'] },
  { id: 'il4', batchId: 'batch-004', fileName: '外包合同条款_20260523.xlsx', totalCount: 2, duplicateCount: 0, newCount: 2, status: 'success', importDate: '2026-05-23T10:30:00', operator: '赵运营', snapshot: ['c7', 'c8'] },
  { id: 'il5', batchId: 'batch-005', fileName: '通用合同条款_20260524.csv', totalCount: 2, duplicateCount: 0, newCount: 2, status: 'success', importDate: '2026-05-24T08:30:00', operator: '王运营', snapshot: ['c9', 'c10'] },
  { id: 'il6', batchId: 'batch-006', fileName: '采购补充条款_20260525.xlsx', totalCount: 2, duplicateCount: 1, newCount: 1, status: 'partial', importDate: '2026-05-25T16:00:00', operator: '赵运营', snapshot: ['c11', 'c12'] },
];

export const MOCK_TREND_DATA: TrendDataPoint[] = [
  { date: '05-19', grayConflict: 1, sourceBroken: 0, sensitiveLeak: 1 },
  { date: '05-20', grayConflict: 0, sourceBroken: 0, sensitiveLeak: 0 },
  { date: '05-21', grayConflict: 1, sourceBroken: 1, sensitiveLeak: 1 },
  { date: '05-22', grayConflict: 0, sourceBroken: 0, sensitiveLeak: 1 },
  { date: '05-23', grayConflict: 1, sourceBroken: 1, sensitiveLeak: 1 },
  { date: '05-24', grayConflict: 1, sourceBroken: 0, sensitiveLeak: 0 },
  { date: '05-25', grayConflict: 1, sourceBroken: 1, sensitiveLeak: 2 },
  { date: '05-26', grayConflict: 0, sourceBroken: 0, sensitiveLeak: 0 },
  { date: '05-27', grayConflict: 1, sourceBroken: 1, sensitiveLeak: 1 },
  { date: '05-28', grayConflict: 0, sourceBroken: 0, sensitiveLeak: 0 },
  { date: '05-29', grayConflict: 2, sourceBroken: 1, sensitiveLeak: 1 },
  { date: '05-30', grayConflict: 1, sourceBroken: 0, sensitiveLeak: 2 },
  { date: '05-31', grayConflict: 1, sourceBroken: 1, sensitiveLeak: 1 },
];
