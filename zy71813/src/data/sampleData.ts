import type { ShortageRecord } from '../types';

export const sampleRecords: ShortageRecord[] = [
  {
    id: 'STR-2024-05-001',
    storeId: 'ST001',
    storeName: '朝阳大悦城店',
    accountingPeriod: '2024-05',
    amount: 1250.00,
    status: 'pending',
    issueCategory: 'fee_carryover',
    source: 'bank_statement',
    sourceRef: 'BS-20240528-001',
    conclusion: '',
    pendingReason: '5月28日银行手续费扣款1250元，发票未到，需确认是否跨期到6月记账。门店财务称5月已计提，但对账单无对应记录，总部会计认为应入6月费用。',
    attachments: [
      {
        id: 'ATT-001',
        name: '5月银行对账单.pdf',
        type: 'bank_statement',
        uploadedBy: '张会计（总部）',
        uploadedAt: '2024-05-30T09:30:00Z',
        version: 2,
        fileHash: 'hash-v2',
        note: '5月28日扣除手续费1250元'
      },
      {
        id: 'ATT-002',
        name: '5月退款清单.xlsx',
        type: 'refund_list',
        uploadedBy: '李店长（门店）',
        uploadedAt: '2024-05-29T14:20:00Z',
        version: 1,
        fileHash: 'hash-r1'
      }
    ],
    versionHistory: [
      {
        id: 'V1',
        version: 1,
        timestamp: '2024-05-29T10:00:00Z',
        modifiedBy: '张会计（总部）',
        changeReason: '创建记录',
        changes: [
          { field: 'amount', oldValue: '', newValue: '1250', changeType: 'conclusion_changed' },
          { field: 'status', oldValue: '', newValue: 'investigating', changeType: 'conclusion_changed' },
          { field: 'issueCategory', oldValue: '', newValue: 'fee_carryover', changeType: 'conclusion_changed' }
        ],
        snapshot: {
          amount: 1250,
          status: 'investigating',
          conclusion: '',
          issueCategory: 'fee_carryover',
          attachments: []
        }
      },
      {
        id: 'V2',
        version: 2,
        timestamp: '2024-05-29T14:20:00Z',
        modifiedBy: '李店长（门店）',
        changeReason: '补充退款清单',
        changes: [
          { field: 'attachment:5月退款清单.xlsx', oldValue: '(无)', newValue: '新增附件 v1', changeType: 'material_only' }
        ],
        snapshot: {
          amount: 1250,
          status: 'investigating',
          conclusion: '',
          issueCategory: 'fee_carryover',
          attachments: []
        }
      },
      {
        id: 'V3',
        version: 3,
        timestamp: '2024-05-30T09:30:00Z',
        modifiedBy: '张会计（总部）',
        changeReason: '对账单版本更新，状态调整为待处理',
        changes: [
          { field: 'attachment:5月银行对账单.pdf', oldValue: 'v1', newValue: 'v2', changeType: 'material_only' },
          { field: 'status', oldValue: 'investigating', newValue: 'pending', changeType: 'conclusion_changed' },
          { field: 'pendingReason', oldValue: '', newValue: '5月28日银行手续费扣款1250元，发票未到，需确认是否跨期到6月记账。门店财务称5月已计提，但对账单无对应记录，总部会计认为应入6月费用。', changeType: 'conclusion_changed' }
        ],
        snapshot: {
          amount: 1250,
          status: 'pending',
          conclusion: '',
          issueCategory: 'fee_carryover',
          attachments: []
        }
      }
    ],
    currentVersion: 3,
    createdAt: '2024-05-29T10:00:00Z',
    updatedAt: '2024-05-30T09:30:00Z',
    hasUnresolvedChanges: true,
    latestAlert: ''
  },
  {
    id: 'STR-2024-05-002',
    storeId: 'ST002',
    storeName: '上海陆家嘴店',
    accountingPeriod: '2024-05',
    amount: 3500.00,
    status: 'investigating',
    issueCategory: 'refund_early_arrival',
    source: 'refund_list',
    sourceRef: 'RF-20240530-008',
    conclusion: '',
    pendingReason: '退款清单显示5月30日退款3500元，实际结算6月1日到账。门店5月已入账，总部认为应入6月。需要确认权责发生制原则下的归属期。',
    attachments: [
      {
        id: 'ATT-003',
        name: '5月退款清单_v1.xlsx',
        type: 'refund_list',
        uploadedBy: '王财务（门店）',
        uploadedAt: '2024-05-30T11:00:00Z',
        version: 1,
        fileHash: 'hash-rf1'
      },
      {
        id: 'ATT-004',
        name: '6月1日银行回单.jpg',
        type: 'settlement_attachment',
        uploadedBy: '王财务（门店）',
        uploadedAt: '2024-05-30T11:00:00Z',
        version: 1,
        fileHash: 'hash-st1',
        note: '⚠️ 结算附件晚补，实际到账日为6月1日'
      }
    ],
    versionHistory: [
      {
        id: 'V1',
        version: 1,
        timestamp: '2024-05-30T09:00:00Z',
        modifiedBy: '刘会计（总部）',
        changeReason: '创建记录 - 退款清单早到',
        changes: [
          { field: 'amount', oldValue: '', newValue: '3500', changeType: 'conclusion_changed' },
          { field: 'status', oldValue: '', newValue: 'pending', changeType: 'conclusion_changed' },
          { field: 'issueCategory', oldValue: '', newValue: 'refund_early_arrival', changeType: 'conclusion_changed' }
        ],
        snapshot: {
          amount: 3500,
          status: 'pending',
          conclusion: '',
          issueCategory: 'refund_early_arrival',
          attachments: []
        }
      },
      {
        id: 'V2',
        version: 2,
        timestamp: '2024-05-30T11:00:00Z',
        modifiedBy: '王财务（门店）',
        changeReason: '补充退款清单和结算回单',
        changes: [
          { field: 'attachment:5月退款清单_v1.xlsx', oldValue: '(无)', newValue: '新增附件 v1', changeType: 'material_only' },
          { field: 'attachment:6月1日银行回单.jpg', oldValue: '(无)', newValue: '新增附件 v1', changeType: 'material_only' },
          { field: 'status', oldValue: 'pending', newValue: 'investigating', changeType: 'conclusion_changed' },
          { field: 'pendingReason', oldValue: '', newValue: '退款清单显示5月30日退款3500元，实际结算6月1日到账。门店5月已入账，总部认为应入6月。需要确认权责发生制原则下的归属期。', changeType: 'conclusion_changed' }
        ],
        snapshot: {
          amount: 3500,
          status: 'investigating',
          conclusion: '',
          issueCategory: 'refund_early_arrival',
          attachments: []
        }
      }
    ],
    currentVersion: 2,
    createdAt: '2024-05-30T09:00:00Z',
    updatedAt: '2024-05-30T11:00:00Z',
    hasUnresolvedChanges: false,
    latestAlert: ''
  },
  {
    id: 'STR-2024-05-003',
    storeId: 'ST003',
    storeName: '深圳南山店',
    accountingPeriod: '2024-05',
    amount: 890.50,
    status: 'resolved',
    issueCategory: 'attachment_late_submit',
    source: 'settlement_attachment',
    sourceRef: 'SA-20240515-023',
    conclusion: '5月15日POS机结算手续费890.50元，结算附件5月31日才补传。确认该笔费用归属于5月，予以入账。',
    pendingReason: '',
    attachments: [
      {
        id: 'ATT-005',
        name: 'POS机结算单_5月15日.pdf',
        type: 'settlement_attachment',
        uploadedBy: '陈经理（门店）',
        uploadedAt: '2024-05-31T16:45:00Z',
        version: 2,
        fileHash: 'hash-pos2',
        note: '5月31日补传'
      },
      {
        id: 'ATT-006',
        name: 'POS机结算单_5月15日_旧版.pdf',
        type: 'settlement_attachment',
        uploadedBy: '陈经理（门店）',
        uploadedAt: '2024-05-31T10:00:00Z',
        version: 1,
        fileHash: 'hash-pos1',
        note: '⚠️ 旧版本回传！后发现金额有误已更新'
      }
    ],
    versionHistory: [
      {
        id: 'V1',
        version: 1,
        timestamp: '2024-05-28T15:00:00Z',
        modifiedBy: '赵会计（总部）',
        changeReason: '创建记录 - 结算附件晚补',
        changes: [
          { field: 'amount', oldValue: '', newValue: '900.00', changeType: 'conclusion_changed' },
          { field: 'status', oldValue: '', newValue: 'pending', changeType: 'conclusion_changed' },
          { field: 'issueCategory', oldValue: '', newValue: 'attachment_late_submit', changeType: 'conclusion_changed' }
        ],
        snapshot: {
          amount: 900.00,
          status: 'pending',
          conclusion: '',
          issueCategory: 'attachment_late_submit',
          attachments: []
        }
      },
      {
        id: 'V2',
        version: 2,
        timestamp: '2024-05-31T10:00:00Z',
        modifiedBy: '陈经理（门店）',
        changeReason: '首次上传结算附件（旧版本）',
        changes: [
          { field: 'attachment:POS机结算单_5月15日.pdf', oldValue: '(无)', newValue: '新增附件 v1', changeType: 'material_only' }
        ],
        snapshot: {
          amount: 900.00,
          status: 'pending',
          conclusion: '',
          issueCategory: 'attachment_late_submit',
          attachments: []
        }
      },
      {
        id: 'V3',
        version: 3,
        timestamp: '2024-05-31T14:30:00Z',
        modifiedBy: '赵会计（总部）',
        changeReason: '检测到附件版本回传问题，要求重传',
        changes: [
          { field: 'status', oldValue: 'pending', newValue: 'disputed', changeType: 'conclusion_changed' },
          { field: 'attachment:POS机结算单_5月15日.pdf', oldValue: 'v1', newValue: 'v1 (旧版本回传！)', changeType: 'conclusion_changed' }
        ],
        snapshot: {
          amount: 900.00,
          status: 'disputed',
          conclusion: '',
          issueCategory: 'attachment_late_submit',
          attachments: []
        }
      },
      {
        id: 'V4',
        version: 4,
        timestamp: '2024-05-31T16:45:00Z',
        modifiedBy: '陈经理（门店）',
        changeReason: '重新上传正确版本，金额修正为890.50',
        changes: [
          { field: 'attachment:POS机结算单_5月15日.pdf', oldValue: 'v1 (旧版本回传！)', newValue: 'v2', changeType: 'material_only' },
          { field: 'amount', oldValue: '900', newValue: '890.5', changeType: 'conclusion_changed' },
          { field: 'status', oldValue: 'disputed', newValue: 'resolved', changeType: 'conclusion_changed' },
          { field: 'conclusion', oldValue: '', newValue: '5月15日POS机结算手续费890.50元，结算附件5月31日才补传。确认该笔费用归属于5月，予以入账。', changeType: 'conclusion_changed' }
        ],
        snapshot: {
          amount: 890.50,
          status: 'resolved',
          conclusion: '5月15日POS机结算手续费890.50元，结算附件5月31日才补传。确认该笔费用归属于5月，予以入账。',
          issueCategory: 'attachment_late_submit',
          attachments: []
        }
      }
    ],
    currentVersion: 4,
    createdAt: '2024-05-28T15:00:00Z',
    updatedAt: '2024-05-31T16:45:00Z',
    hasUnresolvedChanges: false,
    latestAlert: '⚠️ 该记录曾上传旧版本附件，已修正为v2。请注意核对金额变化：900.00 → 890.50'
  },
  {
    id: 'STR-2024-05-004',
    storeId: 'ST004',
    storeName: '广州天河店',
    accountingPeriod: '2024-05',
    amount: 2100.00,
    status: 'disputed',
    issueCategory: 'statement_manual_edit',
    source: 'manual_adjustment',
    sourceRef: 'MA-20240525-005',
    conclusion: '',
    pendingReason: '对账单5月25日有一笔2100元手工调整，备注写"调账"但无详细说明。门店称是客户退款冲销，总部要求提供原始退款凭证和审批记录。',
    attachments: [
      {
        id: 'ATT-007',
        name: '5月银行对账单_调整版.xlsx',
        type: 'bank_statement',
        uploadedBy: '林会计（门店）',
        uploadedAt: '2024-05-30T13:00:00Z',
        version: 1,
        fileHash: 'hash-bs1',
        note: '含手工调整记录'
      }
    ],
    versionHistory: [
      {
        id: 'V1',
        version: 1,
        timestamp: '2024-05-30T10:00:00Z',
        modifiedBy: '周会计（总部）',
        changeReason: '创建记录 - 对账单手工改动',
        changes: [
          { field: 'amount', oldValue: '', newValue: '2100', changeType: 'conclusion_changed' },
          { field: 'status', oldValue: '', newValue: 'pending', changeType: 'conclusion_changed' },
          { field: 'issueCategory', oldValue: '', newValue: 'statement_manual_edit', changeType: 'conclusion_changed' }
        ],
        snapshot: {
          amount: 2100,
          status: 'pending',
          conclusion: '',
          issueCategory: 'statement_manual_edit',
          attachments: []
        }
      },
      {
        id: 'V2',
        version: 2,
        timestamp: '2024-05-30T13:00:00Z',
        modifiedBy: '林会计（门店）',
        changeReason: '上传对账单，但缺少调整审批记录',
        changes: [
          { field: 'attachment:5月银行对账单_调整版.xlsx', oldValue: '(无)', newValue: '新增附件 v1', changeType: 'material_only' },
          { field: 'status', oldValue: 'pending', newValue: 'disputed', changeType: 'conclusion_changed' },
          { field: 'pendingReason', oldValue: '', newValue: '对账单5月25日有一笔2100元手工调整，备注写"调账"但无详细说明。门店称是客户退款冲销，总部要求提供原始退款凭证和审批记录。', changeType: 'conclusion_changed' }
        ],
        snapshot: {
          amount: 2100,
          status: 'disputed',
          conclusion: '',
          issueCategory: 'statement_manual_edit',
          attachments: []
        }
      }
    ],
    currentVersion: 2,
    createdAt: '2024-05-30T10:00:00Z',
    updatedAt: '2024-05-30T13:00:00Z',
    hasUnresolvedChanges: true,
    latestAlert: '⚠️ 手工调整无审批记录，需门店补充原始凭证'
  }
];

export const currentUser = {
  id: 'U001',
  name: '张会计（总部）',
  role: 'hq_accountant' as const
};
