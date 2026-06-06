import { Remittance, RemittanceStatus, ScreeningVersion } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 10);

const remittancesV1: Remittance[] = [
  {
    id: generateId(),
    transactionId: 'TXN-20240601-001',
    payer: '上海东方贸易有限公司',
    payee: 'Hong Kong International Trading Ltd.',
    amount: 125000,
    currency: 'USD',
    transactionDate: '2024-06-01',
    status: RemittanceStatus.NORMAL,
    ruleHits: [
      {
        id: generateId(),
        ruleName: '常规跨境汇款',
        ruleDescription: '金额在正常范围内，交易对手信息完整',
        matchedMaterials: ['贸易合同扫描件', '发票副本', '报关单'],
        confidence: 0.95,
        isCrossSettlement: false
      }
    ],
    manualNotes: [
      {
        id: generateId(),
        author: '张财务',
        timestamp: '2024-06-01 10:30:00',
        content: '资料齐全，交易背景清晰，正常通过',
        source: '6月跨境台账.xlsx'
      }
    ],
    createdAt: '2024-06-01 09:00:00',
    updatedAt: '2024-06-01 10:30:00'
  },
  {
    id: generateId(),
    transactionId: 'TXN-20240601-002',
    payer: '北京科技创新有限公司',
    payee: 'Singapore Tech Solutions Pte Ltd',
    amount: 580000,
    currency: 'USD',
    transactionDate: '2024-06-01',
    status: RemittanceStatus.ABNORMAL,
    ruleHits: [
      {
        id: generateId(),
        ruleName: '大额敏感交易',
        ruleDescription: '单笔金额超过50万美元，需额外审核',
        matchedMaterials: ['服务协议', '董事会决议', '税务备案表'],
        confidence: 0.88,
        isCrossSettlement: false
      },
      {
        id: generateId(),
        ruleName: '收款方关注名单',
        ruleDescription: '收款方曾出现在历史风险交易中',
        matchedMaterials: ['历史交易记录', '风险预警系统查询结果'],
        confidence: 0.72,
        isCrossSettlement: false
      }
    ],
    manualNotes: [
      {
        id: generateId(),
        author: '李复核',
        timestamp: '2024-06-01 14:20:00',
        content: '金额较大，但资料完整，建议复核后通过',
        source: '6月跨境台账.xlsx'
      },
      {
        id: generateId(),
        author: '王主管',
        timestamp: '2024-06-01 16:45:00',
        content: '这个收款方有问题！上个月刚被预警过，不能通过',
        source: '人工复核补充表.xlsx'
      }
    ],
    createdAt: '2024-06-01 09:05:00',
    updatedAt: '2024-06-01 16:45:00'
  },
  {
    id: generateId(),
    transactionId: 'TXN-20240602-003',
    payer: '广州电子制造有限公司',
    payee: 'Taiwan Electronics Co.',
    amount: 85000,
    currency: 'USD',
    transactionDate: '2024-06-02',
    status: RemittanceStatus.PENDING,
    ruleHits: [
      {
        id: generateId(),
        ruleName: '退款跨清算日',
        ruleDescription: '原始交易与退款日期跨越多个清算日',
        matchedMaterials: ['原始汇款凭证', '退款申请书', '银行清算日历', '对账流水'],
        confidence: 0.91,
        isCrossSettlement: true
      }
    ],
    manualNotes: [
      {
        id: generateId(),
        author: '赵会计',
        timestamp: '2024-06-02 11:15:00',
        content: '客户部分退货，需要退款，但跨了周末清算',
        source: '6月跨境台账.xlsx'
      },
      {
        id: generateId(),
        author: '孙经理',
        timestamp: '2024-06-02 13:30:00',
        content: '这个退款理由不太对，需要进一步核实交易真实性',
        source: '人工复核补充表.xlsx'
      }
    ],
    crossSettlementAnalysis: {
      originalDate: '2024-05-28',
      refundDate: '2024-06-02',
      settlementDates: ['2024-05-28', '2024-05-29', '2024-05-30', '2024-05-31', '2024-06-01', '2024-06-02'],
      daysAcross: 5,
      evidenceChain: [
        {
          type: '原始交易凭证',
          description: '2024-05-28 汇出货款85,000美元',
          reference: '凭证号: OUT-20240528-017'
        },
        {
          type: '退款申请',
          description: '2024-06-02 收到客户退款申请，退货金额42,500美元',
          reference: '申请号: REF-20240602-003'
        },
        {
          type: '清算日历',
          description: '5月28-31日为工作日，6月1-2日为周末',
          reference: '银行2024年清算日历'
        },
        {
          type: '对账流水',
          description: '银行对账单显示资金在5月30日完成清算',
          reference: '对账单页: 2024-05-P12'
        }
      ]
    },
    createdAt: '2024-06-02 10:00:00',
    updatedAt: '2024-06-02 13:30:00'
  },
  {
    id: generateId(),
    transactionId: 'TXN-20240603-004',
    payer: '深圳服装出口有限公司',
    payee: 'EU Fashion Import GmbH',
    amount: 230000,
    currency: 'EUR',
    transactionDate: '2024-06-03',
    status: RemittanceStatus.NORMAL,
    ruleHits: [
      {
        id: generateId(),
        ruleName: '常规贸易汇款',
        ruleDescription: '服装出口贸易，单据齐全',
        matchedMaterials: ['出口合同', '商业发票', '装箱单', '提单副本'],
        confidence: 0.97,
        isCrossSettlement: false
      }
    ],
    manualNotes: [
      {
        id: generateId(),
        author: '陈财务',
        timestamp: '2024-06-03 09:45:00',
        content: '贸易背景真实，单据匹配，正常通过',
        source: '6月跨境台账.xlsx'
      }
    ],
    createdAt: '2024-06-03 09:00:00',
    updatedAt: '2024-06-03 09:45:00'
  },
  {
    id: generateId(),
    transactionId: 'TXN-20240603-005',
    payer: '杭州软件开发有限公司',
    payee: 'US Software Licensing Inc.',
    amount: 156000,
    currency: 'USD',
    transactionDate: '2024-06-03',
    status: RemittanceStatus.PENDING,
    ruleHits: [
      {
        id: generateId(),
        ruleName: '软件服务预付款',
        ruleDescription: '预付超过30%的软件服务费，需补充材料',
        matchedMaterials: ['软件许可协议', '付款计划表'],
        confidence: 0.78,
        isCrossSettlement: false
      }
    ],
    manualNotes: [
      {
        id: generateId(),
        author: '周会计',
        timestamp: '2024-06-03 15:20:00',
        content: '缺少税务备案表和完税证明，待补充',
        source: '6月跨境台账.xlsx'
      }
    ],
    createdAt: '2024-06-03 14:30:00',
    updatedAt: '2024-06-03 15:20:00'
  },
  {
    id: generateId(),
    transactionId: 'TXN-20240604-006',
    payer: '成都医疗器械有限公司',
    payee: 'Japan Medical Equipment Co.',
    amount: 420000,
    currency: 'USD',
    transactionDate: '2024-06-04',
    status: RemittanceStatus.ABNORMAL,
    ruleHits: [
      {
        id: generateId(),
        ruleName: '敏感国家/地区交易',
        ruleDescription: '涉及受制裁国家的中间商',
        matchedMaterials: ['最终用户声明', '供应链追溯报告'],
        confidence: 0.85,
        isCrossSettlement: false
      }
    ],
    manualNotes: [
      {
        id: generateId(),
        author: '吴复核',
        timestamp: '2024-06-04 10:30:00',
        content: '虽然中间商在受限地区，但最终用户是日本正规医院，建议特殊审批',
        source: '6月跨境台账.xlsx'
      },
      {
        id: generateId(),
        author: '郑合规',
        timestamp: '2024-06-04 11:45:00',
        content: '合规系统明确禁止，不能通融',
        source: '合规部复核意见.xlsx'
      }
    ],
    createdAt: '2024-06-04 09:00:00',
    updatedAt: '2024-06-04 11:45:00'
  }
];

const remittancesV2: Remittance[] = remittancesV1.map(r => {
  if (r.transactionId === 'TXN-20240601-002') {
    return {
      ...r,
      status: RemittanceStatus.PENDING,
      manualNotes: [
        ...r.manualNotes,
        {
          id: generateId(),
          author: '钱总监',
          timestamp: '2024-06-05 09:00:00',
          content: '经核查，该收款方预警已解除，补充材料后可通过',
          source: '人工复核表-修订版.xlsx'
        }
      ],
      updatedAt: '2024-06-05 09:00:00'
    };
  }
  if (r.transactionId === 'TXN-20240603-005') {
    return {
      ...r,
      status: RemittanceStatus.NORMAL,
      ruleHits: [
        ...r.ruleHits,
        {
          id: generateId(),
          ruleName: '材料补全验证',
          ruleDescription: '已补充税务备案表和完税证明',
          matchedMaterials: ['税务备案表', '完税证明'],
          confidence: 0.95,
          isCrossSettlement: false
        }
      ],
      manualNotes: [
        ...r.manualNotes,
        {
          id: generateId(),
          author: '周会计',
          timestamp: '2024-06-05 14:30:00',
          content: '材料已补全，状态更新为正常',
          source: '人工复核表-修订版.xlsx'
        }
      ],
      updatedAt: '2024-06-05 14:30:00'
    };
  }
  return r;
});

remittancesV2.push({
  id: generateId(),
  transactionId: 'TXN-20240605-007',
  payer: '南京汽车零部件有限公司',
  payee: 'Germany Auto Parts GmbH',
  amount: 310000,
  currency: 'EUR',
  transactionDate: '2024-06-05',
  status: RemittanceStatus.NORMAL,
  ruleHits: [
    {
      id: generateId(),
      ruleName: '常规汽车零部件采购',
      ruleDescription: '长期合作供应商，交易记录良好',
      matchedMaterials: ['采购合同', '发票', '入库单'],
      confidence: 0.96,
      isCrossSettlement: false
    }
  ],
  manualNotes: [
    {
      id: generateId(),
      author: '林财务',
      timestamp: '2024-06-05 16:00:00',
      content: '长期合作供应商，历史交易正常，通过',
      source: '6月跨境台账-补充.xlsx'
    }
  ],
  createdAt: '2024-06-05 15:00:00',
  updatedAt: '2024-06-05 16:00:00'
});

export const screeningVersions: ScreeningVersion[] = [
  {
    id: 'v1',
    name: '2024年6月第1次筛查',
    timestamp: '2024-06-04 18:00:00',
    totalCount: remittancesV1.length,
    normalCount: remittancesV1.filter(r => r.status === RemittanceStatus.NORMAL).length,
    abnormalCount: remittancesV1.filter(r => r.status === RemittanceStatus.ABNORMAL).length,
    pendingCount: remittancesV1.filter(r => r.status === RemittanceStatus.PENDING).length,
    remittances: remittancesV1
  },
  {
    id: 'v2',
    name: '2024年6月第2次筛查（人工复核后）',
    timestamp: '2024-06-05 18:00:00',
    totalCount: remittancesV2.length,
    normalCount: remittancesV2.filter(r => r.status === RemittanceStatus.NORMAL).length,
    abnormalCount: remittancesV2.filter(r => r.status === RemittanceStatus.ABNORMAL).length,
    pendingCount: remittancesV2.filter(r => r.status === RemittanceStatus.PENDING).length,
    remittances: remittancesV2
  }
];

export const getLatestVersion = (): ScreeningVersion => {
  return screeningVersions[screeningVersions.length - 1];
};

export const getVersionById = (id: string): ScreeningVersion | undefined => {
  return screeningVersions.find(v => v.id === id);
};

export const getRemittanceById = (versionId: string, remittanceId: string): Remittance | undefined => {
  const version = getVersionById(versionId);
  return version?.remittances.find(r => r.id === remittanceId);
};
