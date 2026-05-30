import type {
  EvidencePack,
  EvidencePackDetail,
  TransactionRecord,
  ApprovalScreenshot,
  SupplementEmail,
  CorrectionRecord,
  JudgmentResult,
  ReviewRecord,
} from '../types';

export const mockPacks: EvidencePack[] = [
  {
    id: 'pack-001',
    name: '2024年5月银企回单重挂-营业部A',
    importedAt: new Date('2024-05-28T09:30:00'),
    status: 'judged',
    reviewer: '张经理',
    description: '包含正常交易、晚到附件、重复邮件和人工更正的混合数据包',
    tags: ['营业部A', '5月批次']
  },
  {
    id: 'pack-002',
    name: '2024年5月银企回单重挂-营业部B',
    importedAt: new Date('2024-05-27T14:20:00'),
    status: 'reviewing',
    reviewer: '李经理',
    description: '缺审批截图，需要补充材料',
    tags: ['营业部B', '待补充']
  },
  {
    id: 'pack-003',
    name: '2024年5月银企回单重挂-营业部C',
    importedAt: new Date('2024-05-26T11:45:00'),
    status: 'completed',
    reviewer: '王经理',
    description: '已完成复核',
    tags: ['营业部C', '已完成']
  },
  {
    id: 'pack-004',
    name: '2024年5月银企回单重挂-营业部D',
    importedAt: new Date('2024-05-25T16:00:00'),
    status: 'pending',
    description: '待解析',
    tags: ['营业部D']
  }
];

export const mockTransactions: TransactionRecord[] = [
  {
    id: 'tx-001',
    packId: 'pack-001',
    type: 'transaction',
    timestamp: new Date('2024-05-20T10:15:00'),
    title: '交易流水-货款支付',
    description: '向供应商ABC支付5月货款',
    source: '银行流水系统',
    transactionNo: 'TX20240520001',
    amount: 500000,
    currency: 'CNY',
    counterparty: 'ABC贸易有限公司'
  },
  {
    id: 'tx-002',
    packId: 'pack-001',
    type: 'transaction',
    timestamp: new Date('2024-05-20T14:30:00'),
    title: '交易流水-服务费',
    description: '技术服务费用支付',
    source: '银行流水系统',
    transactionNo: 'TX20240520002',
    amount: 85000,
    currency: 'CNY',
    counterparty: 'XYZ科技有限公司'
  },
  {
    id: 'tx-003',
    packId: 'pack-001',
    type: 'transaction',
    timestamp: new Date('2024-05-21T09:00:00'),
    title: '交易流水-重复项',
    description: '重复提交的交易记录',
    isDuplicate: true,
    source: '银行流水系统',
    transactionNo: 'TX20240520001',
    amount: 500000,
    currency: 'CNY',
    counterparty: 'ABC贸易有限公司'
  }
];

export const mockScreenshots: ApprovalScreenshot[] = [
  {
    id: 'ss-001',
    packId: 'pack-001',
    type: 'screenshot',
    timestamp: new Date('2024-05-20T10:00:00'),
    title: '审批截图-货款支付审批',
    description: '审批流程截图，审批通过',
    source: 'OA系统截图',
    filename: 'approval_001.png',
    imageUrl: 'https://picsum.photos/seed/approval1/800/600',
    approver: '审批人A',
    approvalStatus: '已通过'
  },
  {
    id: 'ss-002',
    packId: 'pack-001',
    type: 'screenshot',
    timestamp: new Date('2024-05-22T17:30:00'),
    title: '审批截图-服务费审批',
    description: '晚到附件：超出正常时间窗口后提交',
    isLate: true,
    source: 'OA系统截图',
    filename: 'approval_002.png',
    imageUrl: 'https://picsum.photos/seed/approval2/800/600',
    approver: '审批人B',
    approvalStatus: '已通过'
  }
];

export const mockEmails: SupplementEmail[] = [
  {
    id: 'email-001',
    packId: 'pack-001',
    type: 'email',
    timestamp: new Date('2024-05-20T11:00:00'),
    title: '补充邮件-货款说明',
    description: '关于货款支付的补充说明',
    source: '邮件系统',
    subject: 'Re: 关于5月货款支付的补充说明',
    from: 'zhangsan@company.com',
    to: ['risk@company.com'],
    content: '您好，附件是货款支付的相关说明，请查收。如有问题请随时联系。',
    attachments: ['payment_note.pdf']
  },
  {
    id: 'email-002',
    packId: 'pack-001',
    type: 'email',
    timestamp: new Date('2024-05-20T11:30:00'),
    title: '补充邮件-货款说明',
    description: '重复邮件：与上一封内容重复',
    isDuplicate: true,
    source: '邮件系统',
    subject: 'Re: 关于5月货款支付的补充说明',
    from: 'zhangsan@company.com',
    to: ['risk@company.com'],
    content: '您好，附件是货款支付的相关说明，请查收。如有问题请随时联系。',
    attachments: ['payment_note.pdf']
  },
  {
    id: 'email-003',
    packId: 'pack-001',
    type: 'email',
    timestamp: new Date('2024-05-21T09:30:00'),
    title: '补充邮件-更正说明',
    description: '关于交易金额更正说明',
    source: '邮件系统',
    subject: '更正：5月货款支付金额调整',
    from: 'lisi@company.com',
    to: ['risk@company.com'],
    content: '您好，之前发送的货款支付金额有误，正确金额应为500,000元，请以此为准。',
    attachments: ['correction_note.pdf']
  }
];

export const mockCorrections: CorrectionRecord[] = [
  {
    id: 'corr-001',
    packId: 'pack-001',
    type: 'correction',
    timestamp: new Date('2024-05-21T10:00:00'),
    title: '人工更正-交易金额',
    description: '风控运营人员人工更正记录',
    isCorrection: true,
    source: '人工操作',
    correctedItemId: 'tx-001',
    correctionType: 'amount',
    beforeValue: '480000',
    afterValue: '500000',
    operator: '运营-小王'
  }
];

export const mockJudgmentResult: JudgmentResult = {
  id: 'judge-001',
  packId: 'pack-001',
  conclusion: 'need_review',
  reasons: [
    {
      ruleCode: 'R001',
      ruleName: '重复项检测',
      description: '检测到重复交易记录',
      severity: 'warning',
      evidenceIds: ['tx-003']
    },
    {
      ruleCode: 'R002',
      ruleName: '晚到附件识别',
      description: '服务费审批截图晚于交易时间超过2天',
      severity: 'warning',
      evidenceIds: ['ss-002']
    },
    {
      ruleCode: 'R003',
      ruleName: '重复邮件检测',
      description: '检测到内容重复的补充邮件',
      severity: 'warning',
      evidenceIds: ['email-002']
    },
    {
      ruleCode: 'R004',
      ruleName: '人工更正痕迹',
      description: '存在人工更正交易金额记录',
      severity: 'info',
      evidenceIds: ['corr-001']
    },
    {
      ruleCode: 'R005',
      ruleName: '时间线合理性',
      description: '审批时间线整体逻辑合理',
      severity: 'info',
      evidenceIds: []
    }
  ],
  nextStep: '需人工复核确认',
  nextStepDetails: [
    '确认重复交易记录是否为系统重复提交',
    '核实晚到附件是否为正常业务场景',
    '确认重复邮件是否为误发',
    '确认人工更正是后金额调整是否合规'
  ],
  judgedAt: new Date('2024-05-28T09:35:00'),
  confidence: 0.75
};

export const mockReviewRecords: ReviewRecord[] = [
  {
    id: 'review-001',
    packId: 'pack-001',
    reviewer: '张经理',
    reviewedAt: new Date('2024-05-28T10:00:00'),
    action: 'confirm',
    comment: '已核实重复交易为系统重复导入，已标记删除重复项'
  }
];

export const getMockPackDetail = (packId: string): EvidencePackDetail | undefined => {
  const pack = mockPacks.find(p => p.id === packId);
  if (!pack) return undefined;

  return {
    ...pack,
    transactions: mockTransactions.filter(t => t.packId === packId),
    screenshots: mockScreenshots.filter(s => s.packId === packId),
    emails: mockEmails.filter(e => e.packId === packId),
    corrections: mockCorrections.filter(c => c.packId === packId),
    judgmentResult: packId === 'pack-001' ? mockJudgmentResult : undefined,
    reviewRecords: mockReviewRecords.filter(r => r.packId === packId)
  };
};

export const getMockStats = () => ({
  total: mockPacks.length,
  pending: mockPacks.filter(p => ['pending', 'parsing'].includes(p.status)).length,
  reviewing: mockPacks.filter(p => ['judged', 'reviewing'].includes(p.status)).length,
  completed: mockPacks.filter(p => ['completed', 'archived'].includes(p.status)).length,
  abnormal: mockPacks.filter(p => p.status === 'judged' || p.description?.includes('缺')).length || 1
});
