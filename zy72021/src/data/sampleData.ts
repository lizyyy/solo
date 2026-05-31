import type { ReconciliationRecord } from '@/types'

export const sampleRecords: Partial<ReconciliationRecord>[] = [
  {
    id: 'rec-smooth-001',
    pharmacyName: '康民大药房（朝阳店）',
    flowNo: 'YB-2026-04-001',
    flowAmount: 128500.0,
    contractAmount: 128500.0,
    insuranceAmount: 115650.0,
    source: 'flow',
    paymentFlows: [
      {
        id: 'pf-001',
        flowNo: 'SK-20260415-001',
        amount: 128500.0,
        payDate: '2026-04-15',
        payType: '医保垫付',
        remark: '2026年4月医保垫付款',
      },
    ],
    refundRequests: [],
    approvalMails: [
      {
        id: 'mail-001',
        mailSubject: '康民大药房4月医保垫付审批通过',
        mailFrom: '医保科-王主管',
        mailDate: '2026-04-10',
        mailSummary: '确认4月垫付金额128500.00元，已通过审批',
      },
    ],
    notes: [],
  },
  {
    id: 'rec-pending-002',
    pharmacyName: '德善堂药房（海淀店）',
    flowNo: 'YB-2026-04-002',
    flowAmount: 89200.0,
    contractAmount: null,
    insuranceAmount: null,
    source: 'flow',
    paymentFlows: [
      {
        id: 'pf-002',
        flowNo: 'SK-20260416-002',
        amount: 89200.0,
        payDate: '2026-04-16',
        payType: '医保垫付',
        remark: '合同扫描件尚未提交，金额待核实',
      },
    ],
    refundRequests: [
      {
        id: 'rf-002',
        refundNo: 'TK-20260418-001',
        refundAmount: 3500.0,
        refundDate: '2026-04-18',
        status: '审批中',
      },
    ],
    approvalMails: [
      {
        id: 'mail-002',
        mailSubject: '德善堂4月垫付审批-待补充材料',
        mailFrom: '医保科-王主管',
        mailDate: '2026-04-12',
        mailSummary: '合同扫描件缺失，请补交后再行审批',
      },
    ],
    notes: [
      {
        id: 'note-002',
        content: '阿宁备注：已联系药房补交合同扫描件，预计4月20日前提交',
        author: '阿宁',
        createdAt: '2026-04-17T10:30:00Z',
      },
    ],
  },
  {
    id: 'rec-diff-003',
    pharmacyName: '益民药房（西城店）',
    flowNo: 'YB-2026-03-005',
    flowAmount: 67800.0,
    contractAmount: 72000.0,
    insuranceAmount: 61200.0,
    source: 'contract',
    paymentFlows: [
      {
        id: 'pf-003',
        flowNo: 'SK-20260320-005',
        amount: 67800.0,
        payDate: '2026-03-20',
        payType: '医保垫付',
        remark: '按旧口径结算',
      },
    ],
    refundRequests: [],
    approvalMails: [
      {
        id: 'mail-003',
        mailSubject: '益民药房3月垫付-口径差异说明',
        mailFrom: '医保科-王主管',
        mailDate: '2026-03-25',
        mailSummary:
          '3月合同约定金额72000元，实际流水67800元。差异原因：3月15日起执行新结算口径，合同仍按旧口径签署',
      },
    ],
    notes: [
      {
        id: 'note-003a',
        content: '此条来自合同扫描件，金额口径与流水不一致，需核实新旧口径切换日期',
        author: '阿宁',
        createdAt: '2026-04-01T14:20:00Z',
      },
      {
        id: 'note-003b',
        content: '老板确认：按旧口径处理，差异4200元记入4月调整',
        author: '阿宁',
        createdAt: '2026-04-05T09:10:00Z',
      },
    ],
  },
]

export const edgeCaseRecords: Partial<ReconciliationRecord>[] = [
  {
    id: 'rec-empty-004',
    pharmacyName: '',
    flowNo: 'YB-2026-04-004',
    flowAmount: null,
    contractAmount: null,
    insuranceAmount: null,
    source: 'flow',
    paymentFlows: [],
    refundRequests: [],
    approvalMails: [],
    notes: [],
  },
  {
    id: 'rec-dup-005',
    pharmacyName: '康民大药房（朝阳店）',
    flowNo: 'YB-2026-04-001',
    flowAmount: 128500.0,
    contractAmount: 128500.0,
    insuranceAmount: 115650.0,
    source: 'flow',
    paymentFlows: [
      {
        id: 'pf-005',
        flowNo: 'SK-20260415-001',
        amount: 128500.0,
        payDate: '2026-04-15',
        payType: '医保垫付',
        remark: '重复导入测试',
      },
    ],
    refundRequests: [],
    approvalMails: [],
    notes: [],
  },
  {
    id: 'rec-boundary-006',
    pharmacyName: '惠民药店（东城店）',
    flowNo: 'YB-2026-04-999',
    flowAmount: 0,
    contractAmount: 0,
    insuranceAmount: 0,
    source: 'manual',
    paymentFlows: [
      {
        id: 'pf-006',
        flowNo: 'SK-20260430-999',
        amount: 0,
        payDate: '2026-04-30',
        payType: '医保垫付',
        remark: '边界测试：零金额记录',
      },
    ],
    refundRequests: [],
    approvalMails: [],
    notes: [],
  },
]
