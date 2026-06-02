import type { Sample, ReviewRecord } from '../types';

const now = new Date().toISOString();
const yesterday = new Date(Date.now() - 86400000).toISOString();
const twoDaysAgo = new Date(Date.now() - 86400000 * 2).toISOString();

const contractTexts = {
  c1: `合同编号：HT-2024-001
甲方：北京科技有限公司
乙方：上海软件股份有限公司

第一条 服务内容
乙方应于2024年12月31日前完成系统开发并交付验收。
甲方应在收到乙方交付物后15个工作日内完成验收。

第二条 付款方式
合同总金额为人民币伍佰万元整（¥5,000,000.00）。
甲方应于合同签订后10个工作日内支付30%预付款。
项目验收合格后10个工作日内支付60%款项。
剩余10%作为质保金，验收满一年后支付。

第三条 违约责任
任何一方迟延履行的，应按日支付合同金额0.1%的违约金。
逾期超过30日的，守约方有权解除合同。

第四条 保密条款
双方应对合同履行过程中知悉的商业秘密承担保密义务。
保密期限为合同终止后五年。`,

  c2: `合同编号：HT-2024-002
甲方：广州贸易集团
乙方：深圳物流有限公司

第一条 运输服务
乙方负责甲方货物的门到门运输服务。
运输时效为自提货起48小时内送达。

第二条 费用结算
运费标准为每公里3.5元。
每月5日前核对上月运输单据，10日前完成付款。

第三条 违约责任
乙方逾期送达的，每逾期1小时赔偿运费的5%。
逾期超过24小时的，免除该次运输费用。

第四条 保险
乙方应为货物购买运输保险，保险金额为货值的110%。`,

  c3: `合同编号：HT-2024-003
甲方：杭州电商平台
乙方：南京仓储服务公司

第一条 仓储服务
乙方提供1000平方米仓库用于甲方货物存储。
服务期限自2024年1月1日至2024年12月31日。

第二条 费用
仓储费为每月每平方米40元。
甲方应于每月15日前支付当月仓储费。

第三条 违约责任
甲方逾期支付费用的，按日支付应付金额0.05%的滞纳金。
乙方未尽保管义务造成货物损失的，应按货值赔偿。`
};

export const mockReviewHistory: ReviewRecord[] = [
  {
    id: 'r1',
    sampleId: 's1',
    reviewer: '周姐',
    decision: 'approve',
    evidence: '与合同第二条完全一致，金额正确',
    timestamp: twoDaysAgo,
    previousStatus: 'pending',
    newStatus: 'approved',
  },
  {
    id: 'r2',
    sampleId: 's4',
    reviewer: '周姐',
    decision: 'reject',
    evidence: '模型抽取的违约金比例错误，应为0.1%而非1%',
    timestamp: yesterday,
    previousStatus: 'pending',
    newStatus: 'rejected',
  },
];

export const mockSamples: Sample[] = [
  {
    id: 's1',
    contractId: 'HT-2024-001',
    contractName: '系统开发服务合同',
    clauseType: '付款金额',
    clauseContent: '合同总金额为人民币伍佰万元整（¥5,000,000.00）。',
    fullContractText: contractTexts.c1,
    
    modelExtraction: '5000000',
    modelConfidence: 0.98,
    modelVersion: 'v2.3.1',
    modelThreshold: 0.7,
    modelEvidence: {
      spans: [{ start: contractTexts.c1.indexOf('¥5,000,000.00'), end: contractTexts.c1.indexOf('¥5,000,000.00') + '¥5,000,000.00'.length, text: '¥5,000,000.00' }],
      reasoning: '从合同第二条付款方式中提取到明确的金额数字，包含中文大写和阿拉伯数字双重确认',
      logId: 'LOG-20240601-001',
      timestamp: twoDaysAgo,
    },
    modelLogId: 'LOG-20240601-001',
    
    manualLabel: null,
    manualLabeledBy: null,
    manualLabelTime: null,
    
    importedLabel: '5000000',
    importedSource: '人工标注库-v1',
    
    status: 'approved',
    currentReviewer: null,
    reviewHistory: mockReviewHistory.filter(r => r.sampleId === 's1'),
    
    isDuplicate: false,
    duplicateOf: null,
    duplicateGroupId: null,
    
    isMissingRef: false,
    hasManualOverride: false,
    hasModelImportConflict: false,
    conflictInfo: null,
    
    createdAt: twoDaysAgo,
    updatedAt: twoDaysAgo,
    source: 'hybrid',
  },
  
  {
    id: 's1-dup',
    contractId: 'HT-2024-001',
    contractName: '系统开发服务合同',
    clauseType: '付款金额',
    clauseContent: '合同总金额为人民币伍佰万元整（¥5,000,000.00）。',
    fullContractText: contractTexts.c1,
    
    modelExtraction: '5000000',
    modelConfidence: 0.98,
    modelVersion: 'v2.3.1',
    modelThreshold: 0.7,
    modelEvidence: {
      spans: [{ start: contractTexts.c1.indexOf('¥5,000,000.00'), end: contractTexts.c1.indexOf('¥5,000,000.00') + '¥5,000,000.00'.length, text: '¥5,000,000.00' }],
      reasoning: '从合同第二条付款方式中提取到明确的金额数字',
      logId: 'LOG-20240601-001',
      timestamp: twoDaysAgo,
    },
    modelLogId: 'LOG-20240601-001',
    
    manualLabel: null,
    manualLabeledBy: null,
    manualLabelTime: null,
    
    importedLabel: '5000000',
    importedSource: '人工标注库-v1',
    
    status: 'pending',
    currentReviewer: null,
    reviewHistory: [],
    
    isDuplicate: true,
    duplicateOf: 's1',
    duplicateGroupId: 'dup-001',
    
    isMissingRef: false,
    hasManualOverride: false,
    hasModelImportConflict: false,
    conflictInfo: null,
    
    createdAt: twoDaysAgo,
    updatedAt: twoDaysAgo,
    source: 'hybrid',
  },
  
  {
    id: 's2',
    contractId: 'HT-2024-001',
    contractName: '系统开发服务合同',
    clauseType: '交付日期',
    clauseContent: '乙方应于2024年12月31日前完成系统开发并交付验收。',
    fullContractText: contractTexts.c1,
    
    modelExtraction: '2024-12-31',
    modelConfidence: 0.95,
    modelVersion: 'v2.3.1',
    modelThreshold: 0.7,
    modelEvidence: {
      spans: [{ start: contractTexts.c1.indexOf('2024年12月31日'), end: contractTexts.c1.indexOf('2024年12月31日') + '2024年12月31日'.length, text: '2024年12月31日' }],
      reasoning: '从第一条服务内容中提取到明确的交付日期',
      logId: 'LOG-20240601-002',
      timestamp: twoDaysAgo,
    },
    modelLogId: 'LOG-20240601-002',
    
    manualLabel: null,
    manualLabeledBy: null,
    manualLabelTime: null,
    
    importedLabel: '2024-12-31',
    importedSource: '人工标注库-v1',
    
    status: 'pending',
    currentReviewer: null,
    reviewHistory: [],
    
    isDuplicate: false,
    duplicateOf: null,
    duplicateGroupId: null,
    
    isMissingRef: false,
    hasManualOverride: false,
    hasModelImportConflict: false,
    conflictInfo: null,
    
    createdAt: twoDaysAgo,
    updatedAt: twoDaysAgo,
    source: 'hybrid',
  },
  
  {
    id: 's3',
    contractId: 'HT-2024-001',
    contractName: '系统开发服务合同',
    clauseType: '违约金比例',
    clauseContent: '任何一方迟延履行的，应按日支付合同金额0.1%的违约金。',
    fullContractText: contractTexts.c1,
    
    modelExtraction: '0.001',
    modelConfidence: 0.88,
    modelVersion: 'v2.3.1',
    modelThreshold: 0.7,
    modelEvidence: {
      spans: [{ start: contractTexts.c1.indexOf('0.1%'), end: contractTexts.c1.indexOf('0.1%') + '0.1%'.length, text: '0.1%' }],
      reasoning: '从第三条违约责任中提取到违约金比例，将百分比转换为小数',
      logId: 'LOG-20240601-003',
      timestamp: twoDaysAgo,
    },
    modelLogId: 'LOG-20240601-003',
    
    manualLabel: null,
    manualLabeledBy: null,
    manualLabelTime: null,
    
    importedLabel: null,
    importedSource: null,
    
    status: 'need_review',
    currentReviewer: null,
    reviewHistory: [],
    
    isDuplicate: false,
    duplicateOf: null,
    duplicateGroupId: null,
    
    isMissingRef: true,
    hasManualOverride: false,
    hasModelImportConflict: false,
    conflictInfo: {
      type: 'missing_ref',
      modelClaim: '0.001',
      importedClaim: null,
      evidenceDiff: '导入数据中缺少该条款的人工标注结果，无法自动核对',
      suggestedActions: ['人工复核模型抽取结果', '补充人工标注后再比对'],
    },
    
    createdAt: twoDaysAgo,
    updatedAt: twoDaysAgo,
    source: 'model',
  },
  
  {
    id: 's4',
    contractId: 'HT-2024-001',
    contractName: '系统开发服务合同',
    clauseType: '违约金比例',
    clauseContent: '任何一方迟延履行的，应按日支付合同金额0.1%的违约金。',
    fullContractText: contractTexts.c1,
    
    modelExtraction: '0.01',
    modelConfidence: 0.72,
    modelVersion: 'v2.3.0',
    modelThreshold: 0.7,
    modelEvidence: {
      spans: [{ start: contractTexts.c1.indexOf('0.1%'), end: contractTexts.c1.indexOf('0.1%') + '0.1%'.length, text: '0.1%' }],
      reasoning: '从第三条违约责任中提取到违约金比例，转换为小数时可能存在小数点错误',
      logId: 'LOG-20240601-004',
      timestamp: twoDaysAgo,
    },
    modelLogId: 'LOG-20240601-004',
    
    manualLabel: '0.001',
    manualLabeledBy: '周姐',
    manualLabelTime: yesterday,
    
    importedLabel: '0.001',
    importedSource: '人工标注库-v1',
    
    status: 'rejected',
    currentReviewer: null,
    reviewHistory: mockReviewHistory.filter(r => r.sampleId === 's4'),
    
    isDuplicate: false,
    duplicateOf: null,
    duplicateGroupId: null,
    
    isMissingRef: false,
    hasManualOverride: true,
    hasModelImportConflict: false,
    conflictInfo: {
      type: 'manual_override',
      modelClaim: '0.01',
      importedClaim: '0.001',
      evidenceDiff: '模型抽取结果为0.01（即1%），但人工标注和导入数据均为0.001（即0.1%），存在10倍差异。模型v2.3.0版本可能存在小数点处理bug。',
      suggestedActions: ['确认人工标注正确后，将模型结果标记为错误', '建议算法团队排查v2.3.0版本的百分比转换逻辑'],
    },
    
    createdAt: twoDaysAgo,
    updatedAt: yesterday,
    source: 'hybrid',
  },
  
  {
    id: 's5',
    contractId: 'HT-2024-002',
    contractName: '物流运输服务合同',
    clauseType: '运输时效',
    clauseContent: '运输时效为自提货起48小时内送达。',
    fullContractText: contractTexts.c2,
    
    modelExtraction: '48',
    modelConfidence: 0.92,
    modelVersion: 'v2.3.1',
    modelThreshold: 0.7,
    modelEvidence: {
      spans: [{ start: contractTexts.c2.indexOf('48小时'), end: contractTexts.c2.indexOf('48小时') + '48小时'.length, text: '48小时' }],
      reasoning: '从第一条运输服务中提取到时效要求，单位为小时',
      logId: 'LOG-20240601-005',
      timestamp: yesterday,
    },
    modelLogId: 'LOG-20240601-005',
    
    manualLabel: null,
    manualLabeledBy: null,
    manualLabelTime: null,
    
    importedLabel: '24',
    importedSource: '人工标注库-v1',
    
    status: 'conflict',
    currentReviewer: null,
    reviewHistory: [],
    
    isDuplicate: false,
    duplicateOf: null,
    duplicateGroupId: null,
    
    isMissingRef: false,
    hasManualOverride: false,
    hasModelImportConflict: true,
    conflictInfo: {
      type: 'model_import_mismatch',
      modelClaim: '48（小时）',
      importedClaim: '24（小时）',
      evidenceDiff: '模型从合同原文"自提货起48小时内送达"提取为48小时，但导入的人工标注库中记录为24小时。两者存在1倍差异，需核对原始合同。',
      suggestedActions: ['点击证据链接查看合同原文确认', '如导入数据错误，修正人工标注库', '如模型理解错误，反馈算法团队'],
    },
    
    createdAt: yesterday,
    updatedAt: yesterday,
    source: 'hybrid',
  },
  
  {
    id: 's6',
    contractId: 'HT-2024-002',
    contractName: '物流运输服务合同',
    clauseType: '运费标准',
    clauseContent: '运费标准为每公里3.5元。',
    fullContractText: contractTexts.c2,
    
    modelExtraction: null,
    modelConfidence: null,
    modelVersion: 'v2.3.1',
    modelThreshold: 0.7,
    modelEvidence: null,
    modelLogId: null,
    
    manualLabel: null,
    manualLabeledBy: null,
    manualLabelTime: null,
    
    importedLabel: null,
    importedSource: null,
    
    status: 'need_review',
    currentReviewer: null,
    reviewHistory: [],
    
    isDuplicate: false,
    duplicateOf: null,
    duplicateGroupId: null,
    
    isMissingRef: true,
    hasManualOverride: false,
    hasModelImportConflict: false,
    conflictInfo: {
      type: 'missing_ref',
      modelClaim: null,
      importedClaim: null,
      evidenceDiff: '模型未输出抽取结果，导入数据也无对应标注，该字段为空值。',
      suggestedActions: ['人工阅读合同条款后补充标注', '检查模型日志排查未输出原因'],
    },
    
    createdAt: yesterday,
    updatedAt: yesterday,
    source: 'hybrid',
  },
  
  {
    id: 's7',
    contractId: 'HT-2024-003',
    contractName: '仓储服务合同',
    clauseType: '仓储面积',
    clauseContent: '乙方提供1000平方米仓库用于甲方货物存储。',
    fullContractText: contractTexts.c3,
    
    modelExtraction: '1000',
    modelConfidence: 0.96,
    modelVersion: 'v2.3.1',
    modelThreshold: 0.7,
    modelEvidence: {
      spans: [{ start: contractTexts.c3.indexOf('1000平方米'), end: contractTexts.c3.indexOf('1000平方米') + '1000平方米'.length, text: '1000平方米' }],
      reasoning: '从第一条仓储服务中提取到仓库面积，单位为平方米',
      logId: 'LOG-20240601-007',
      timestamp: yesterday,
    },
    modelLogId: 'LOG-20240601-007',
    
    manualLabel: null,
    manualLabeledBy: null,
    manualLabelTime: null,
    
    importedLabel: '1000',
    importedSource: '人工标注库-v1',
    
    status: 'pending',
    currentReviewer: null,
    reviewHistory: [],
    
    isDuplicate: false,
    duplicateOf: null,
    duplicateGroupId: null,
    
    isMissingRef: false,
    hasManualOverride: false,
    hasModelImportConflict: false,
    conflictInfo: null,
    
    createdAt: yesterday,
    updatedAt: yesterday,
    source: 'hybrid',
  },
  
  {
    id: 's8',
    contractId: 'HT-2024-003',
    contractName: '仓储服务合同',
    clauseType: '滞纳金比例',
    clauseContent: '甲方逾期支付费用的，按日支付应付金额0.05%的滞纳金。',
    fullContractText: contractTexts.c3,
    
    modelExtraction: '0.0005',
    modelConfidence: 0.55,
    modelVersion: 'v2.3.1',
    modelThreshold: 0.7,
    modelEvidence: {
      spans: [{ start: contractTexts.c3.indexOf('0.05%'), end: contractTexts.c3.indexOf('0.05%') + '0.05%'.length, text: '0.05%' }],
      reasoning: '从第三条违约责任中提取到滞纳金比例，但置信度低于阈值，建议人工复核',
      logId: 'LOG-20240601-008',
      timestamp: yesterday,
    },
    modelLogId: 'LOG-20240601-008',
    
    manualLabel: null,
    manualLabeledBy: null,
    manualLabelTime: null,
    
    importedLabel: '0.0005',
    importedSource: '人工标注库-v1',
    
    status: 'need_review',
    currentReviewer: null,
    reviewHistory: [],
    
    isDuplicate: false,
    duplicateOf: null,
    duplicateGroupId: null,
    
    isMissingRef: false,
    hasManualOverride: false,
    hasModelImportConflict: false,
    conflictInfo: null,
    
    createdAt: yesterday,
    updatedAt: yesterday,
    source: 'hybrid',
  },
];
