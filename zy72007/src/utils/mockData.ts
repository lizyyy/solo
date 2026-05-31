import { InvestmentRecord, RecordStatus, MaterialType, OperationType } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 10);
const formatDate = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ');

const now = new Date();
const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

export const mockRecords: InvestmentRecord[] = [
  {
    id: 'rec001',
    investorName: '张三',
    amount: 500000,
    status: RecordStatus.CONFIRMED,
    suggestion: '【材料齐全】收款流水、审批邮件齐全，金额匹配，建议确认入账\n\n【建议补充】请上传投资者手写的风险确认书或回访备注原件照片',
    handler: '老曹',
    materials: [
      {
        id: generateId(),
        recordId: 'rec001',
        type: MaterialType.PAYMENT,
        title: '招商银行收款回单',
        content: '交易日期：2026-05-20\n交易金额：¥500,000.00\n付款人：张三\n收款人：XX私募投资基金\n交易流水号：CMB2026052000012345',
        source: '运营部门提供',
        amount: 500000,
        createdAt: formatDate(twoDaysAgo),
      },
      {
        id: generateId(),
        recordId: 'rec001',
        type: MaterialType.APPROVAL,
        title: '王总审批邮件',
        content: '发件人：王总 <wangzong@company.com\n收件人：运营部\n日期：2026-05-21\n\n同意张三的私募基金申购，风险等级符合要求。',
        source: '邮件系统导出',
        createdAt: formatDate(twoDaysAgo),
      },
      {
        id: generateId(),
        recordId: 'rec001',
        type: MaterialType.HANDWRITTEN,
        title: '回访记录-张三',
        content: '2026年5月22日电话回访：\n- 投资者了解产品风险\n- 确认投资期限：12个月\n- 投资者签字：张三',
        source: '客户经理现场记录',
        createdAt: formatDate(oneDayAgo),
      },
    ],
    operationLogs: [
      {
        id: generateId(),
        recordId: 'rec001',
        type: OperationType.CREATE,
        operator: '系统',
        newStatus: RecordStatus.PENDING,
        diffNote: '系统自动创建回访记录',
        createdAt: formatDate(twoDaysAgo),
      },
      {
        id: generateId(),
        recordId: 'rec001',
        type: OperationType.CONFIRM,
        operator: '老曹',
        oldStatus: RecordStatus.PENDING,
        newStatus: RecordStatus.CONFIRMED,
        diffNote: '材料齐全，金额匹配，确认入账',
        createdAt: formatDate(oneDayAgo),
      },
    ],
    notes: [],
    createdAt: formatDate(twoDaysAgo),
    updatedAt: formatDate(oneDayAgo),
  },
  {
    id: 'rec002',
    investorName: '李四',
    amount: 280000,
    status: RecordStatus.MANUAL_ADJUSTED,
    previousStatus: RecordStatus.PENDING_MATERIAL,
    suggestion: '【材料齐全】收款流水、审批邮件齐全，金额匹配，建议确认入账\n\n【人工改判说明】原登记金额300,000元，实际到账280,000元，差额20,000元为前期服务费扣除',
    handler: '老曹',
    materials: [
      {
        id: generateId(),
        recordId: 'rec002',
        type: MaterialType.PAYMENT,
        title: '工商银行收款回单',
        content: '交易日期：2026-05-25\n交易金额：¥280,000.00\n付款人：李四\n收款人：XX私募投资基金\n交易流水号：ICBC202605258888',
        source: '运营部门补充提供',
        amount: 280000,
        createdAt: formatDate(now),
      },
      {
        id: generateId(),
        recordId: 'rec002',
        type: MaterialType.REFUND,
        title: '退款申请单',
        content: '申请人：李四\n申请日期：2026-05-23\n申请退款金额：¥20,000.00\n退款原因：服务费抵扣\n审批状态：已审批',
        source: '财务系统',
        amount: 20000,
        createdAt: formatDate(oneDayAgo),
      },
      {
        id: generateId(),
        recordId: 'rec002',
        type: MaterialType.APPROVAL,
        title: '李总审批邮件',
        content: '发件人：李总 <lizong@company.com\n收件人：运营部\n日期：2026-05-21\n\n同意李四的私募基金申购。',
        source: '邮件系统导出',
        createdAt: formatDate(twoDaysAgo),
      },
    ],
    operationLogs: [
      {
        id: generateId(),
        recordId: 'rec002',
        type: OperationType.CREATE,
        operator: '系统',
        newStatus: RecordStatus.PENDING,
        diffNote: '系统自动创建回访记录，初始登记金额300,000元',
        createdAt: formatDate(twoDaysAgo),
      },
      {
        id: generateId(),
        recordId: 'rec002',
        type: OperationType.SUSPEND,
        operator: '老曹',
        oldStatus: RecordStatus.PENDING,
        newStatus: RecordStatus.PENDING_MATERIAL,
        diffNote: '缺失收款流水凭证，挂起待补',
        createdAt: formatDate(twoDaysAgo),
      },
      {
        id: generateId(),
        recordId: 'rec002',
        type: OperationType.ADJUST,
        operator: '老曹',
        oldStatus: RecordStatus.PENDING_MATERIAL,
        newStatus: RecordStatus.MANUAL_ADJUSTED,
        oldAmount: 300000,
        newAmount: 280000,
        diffNote: '补充收款流水后发现金额差异，人工改判为280,000元（扣除20,000元服务费',
        createdAt: formatDate(now),
      },
    ],
    notes: [
      {
        id: generateId(),
        recordId: 'rec002',
        content: '李四来电确认20,000元为服务费，已在合同中约定，无需额外开票。',
        author: '老曹',
        createdAt: formatDate(now),
      },
    ],
    createdAt: formatDate(twoDaysAgo),
    updatedAt: formatDate(now),
  },
  {
    id: 'rec003',
    investorName: '王五',
    amount: 800000,
    status: RecordStatus.PENDING_MATERIAL,
    suggestion: '【缺失关键凭证】请联系运营部门提供投资者的银行收款流水凭证，这是入账的必要依据\n\n【建议补充】请上传投资者手写的风险确认书或回访备注原件照片',
    handler: '老曹',
    materials: [
      {
        id: generateId(),
        recordId: 'rec003',
        type: MaterialType.APPROVAL,
        title: '张总审批邮件',
        content: '发件人：张总 <zhangzong@company.com\n收件人：运营部\n日期：2026-05-28\n\n同意王五的私募基金申购。',
        source: '邮件系统导出',
        createdAt: formatDate(oneDayAgo),
      },
    ],
    operationLogs: [
      {
        id: generateId(),
        recordId: 'rec003',
        type: OperationType.CREATE,
        operator: '系统',
        newStatus: RecordStatus.PENDING,
        diffNote: '系统自动创建回访记录',
        createdAt: formatDate(oneDayAgo),
      },
      {
        id: generateId(),
        recordId: 'rec003',
        type: OperationType.SUSPEND,
        operator: '老曹',
        oldStatus: RecordStatus.PENDING,
        newStatus: RecordStatus.PENDING_MATERIAL,
        diffNote: '缺失收款流水，待运营补充后再处理',
        createdAt: formatDate(now),
      },
    ],
    notes: [],
    createdAt: formatDate(oneDayAgo),
    updatedAt: formatDate(now),
  },
];

export function loadInitialData(): InvestmentRecord[] {
  const stored = localStorage.getItem('private_equity_records');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return mockRecords;
    }
  }
  return mockRecords;
}

export function saveData(records: InvestmentRecord[]): void {
  localStorage.setItem('private_equity_records', JSON.stringify(records));
}
