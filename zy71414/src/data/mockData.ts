import type {
  DiscountApplication,
  Supplier,
  Payable,
  StatusTransition,
  PaymentRecord,
  EvidenceItem,
} from '../types';
import { DiscountCalculator } from '../services/DiscountCalculator';

const SUPPLIERS: Supplier[] = [
  { id: 'S001', name: '华为技术有限公司', level: 'A', creditRating: 95, historicalDiscountCount: 28 },
  { id: 'S002', name: '中兴通讯股份有限公司', level: 'A', creditRating: 92, historicalDiscountCount: 22 },
  { id: 'S003', name: '比亚迪股份有限公司', level: 'B', creditRating: 88, historicalDiscountCount: 15 },
  { id: 'S004', name: '宁德时代新能源科技', level: 'A', creditRating: 93, historicalDiscountCount: 19 },
  { id: 'S005', name: '小米科技有限责任公司', level: 'B', creditRating: 85, historicalDiscountCount: 12 },
  { id: 'S006', name: '联想集团有限公司', level: 'B', creditRating: 82, historicalDiscountCount: 8 },
  { id: 'S007', name: '海尔集团公司', level: 'C', creditRating: 75, historicalDiscountCount: 5 },
  { id: 'S008', name: '美的集团股份有限公司', level: 'C', creditRating: 78, historicalDiscountCount: 6 },
  { id: 'S009', name: '格力电器股份有限公司', level: 'D', creditRating: 68, historicalDiscountCount: 3 },
  { id: 'S010', name: '四川长虹电子控股', level: 'D', creditRating: 62, historicalDiscountCount: 2 },
];

function generatePayables(): Payable[] {
  const payables: Payable[] = [];
  const invoices = ['INV-2024-001', 'INV-2024-002', 'INV-2024-003', 'INV-2024-004', 'INV-2024-005'];
  
  for (let i = 0; i < 30; i++) {
    const supplierIndex = i % SUPPLIERS.length;
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 90) + 30);
    
    payables.push({
      id: `PAY-${String(i + 1).padStart(4, '0')}`,
      supplierId: SUPPLIERS[supplierIndex].id,
      amount: Math.floor(Math.random() * 5000000) + 100000,
      dueDate: dueDate.toISOString().split('T')[0],
      invoiceNo: invoices[i % invoices.length] + `-${i}`,
      relatedContracts: [`CT-${String(i + 1).padStart(3, '0')}`],
    });
  }
  return payables;
}

const PAYABLES = generatePayables();

function generateApplications(): DiscountApplication[] {
  const statuses: DiscountApplication['status'][] = [
    'DRAFT', 'SUBMITTED', 'APPROVING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'PAID', 'CANCELLED'
  ];
  const creators = ['张三', '李四', '王五', '赵六', '钱七'];
  const apps: DiscountApplication[] = [];

  for (let i = 0; i < 20; i++) {
    const payable = PAYABLES[i];
    const supplier = SUPPLIERS.find((s) => s.id === payable.supplierId)!;
    const today = new Date();
    const proposedDate = new Date(payable.dueDate);
    proposedDate.setDate(proposedDate.getDate() - Math.floor(Math.random() * 60) - 15);
    
    const discountRate = 0.04 + Math.random() * 0.06;
    const calc = DiscountCalculator.calculate(
      payable.amount,
      payable.dueDate,
      proposedDate.toISOString().split('T')[0],
      discountRate
    );

    const createdAt = new Date(today);
    createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 30));

    apps.push({
      id: `APP-${String(i + 1).padStart(4, '0')}`,
      applicationNo: `DISC2024${String(i + 1).padStart(6, '0')}`,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierLevel: supplier.level,
      payableId: payable.id,
      payableAmount: payable.amount,
      originalDueDate: payable.dueDate,
      proposedDueDate: proposedDate.toISOString().split('T')[0],
      discountRate,
      discountAmount: calc.discountAmount,
      actualPaymentAmount: calc.actualPayment,
      status: statuses[i % statuses.length],
      currentVersion: Math.floor(Math.random() * 3) + 1,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      createdBy: creators[i % creators.length],
      remark: i % 3 === 0 ? '优先处理该供应商款项' : undefined,
    });
  }
  return apps;
}

const APPLICATIONS = generateApplications();

function generateTransitions(): StatusTransition[] {
  const transitions: StatusTransition[] = [];
  const operators = ['张三', '李四', '王五', '赵六', '钱七'];
  const remarks = [
    '申请提交，等待审批',
    '进入审批流程',
    '审批通过',
    '资料不全，驳回',
    '申请人撤回',
    '已完成付款',
    '取消申请',
  ];

  APPLICATIONS.forEach((app, index) => {
    const createdAt = new Date(app.createdAt);
    const transitionCount = Math.floor(Math.random() * 4) + 1;

    for (let i = 0; i < transitionCount; i++) {
      const transTime = new Date(createdAt);
      transTime.setHours(transTime.getHours() + i * 4);

      transitions.push({
        id: `TRANS-${String(index * 10 + i).padStart(6, '0')}`,
        applicationId: app.id,
        fromStatus: i === 0 ? 'DRAFT' : (['SUBMITTED', 'APPROVING', 'APPROVED'][i - 1] as any),
        toStatus: i === 0 ? 'SUBMITTED' : (['APPROVING', 'APPROVED', 'PAID'][i - 1] as any) || app.status,
        operator: operators[(index + i) % operators.length],
        operatorIp: `192.168.1.${Math.floor(Math.random() * 255)}`,
        timestamp: transTime.toISOString(),
        remark: remarks[i % remarks.length],
      });
    }
  });

  return transitions;
}

const TRANSITIONS = generateTransitions();

function generatePayments(): PaymentRecord[] {
  const payments: PaymentRecord[] = [];
  const operators = ['财务A', '财务B', '财务C'];
  let paymentCounter = 1;

  APPLICATIONS.filter((a) => a.status === 'PAID').forEach((app, index) => {
    const payCount = Math.random() > 0.7 ? 2 : 1;
    const firstPaymentId = `PAY-${String(paymentCounter).padStart(6, '0')}`;

    for (let i = 0; i < payCount; i++) {
      const payDate = new Date(app.updatedAt);
      payDate.setDate(payDate.getDate() + i);

      payments.push({
        id: `PAY-${String(paymentCounter++).padStart(6, '0')}`,
        applicationId: app.id,
        paymentNo: `PAY2024${String(paymentCounter).padStart(8, '0')}`,
        amount: app.actualPaymentAmount,
        paymentDate: payDate.toISOString().split('T')[0],
        isDuplicate: i > 0,
        duplicateOf: i > 0 ? firstPaymentId : null,
        version: i + 1,
        operator: operators[index % operators.length],
        status: 'SUCCESS',
      });
    }
  });

  return payments;
}

const PAYMENTS = generatePayments();

function generateEvidence(): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];
  const operators = ['张三', '李四', '王五', '赵六', '钱七'];
  let counter = 1;

  APPLICATIONS.forEach((app, index) => {
    const createdAt = new Date(app.createdAt);

    evidence.push({
      id: `EVD-${String(counter++).padStart(6, '0')}`,
      applicationId: app.id,
      type: 'STATUS_CHANGE',
      content: `创建申请，状态变为草稿`,
      operator: app.createdBy,
      timestamp: createdAt.toISOString(),
      metadata: { from: null, to: 'DRAFT' },
    });

    evidence.push({
      id: `EVD-${String(counter++).padStart(6, '0')}`,
      applicationId: app.id,
      type: 'ATTACHMENT',
      content: `上传发票扫描件: INV-${index + 1}.pdf`,
      operator: operators[index % operators.length],
      timestamp: new Date(createdAt.getTime() + 1800000).toISOString(),
      metadata: { fileName: `INV-${index + 1}.pdf`, fileSize: `${Math.floor(Math.random() * 5000)}KB` },
    });

    if (index % 2 === 0) {
      evidence.push({
        id: `EVD-${String(counter++).padStart(6, '0')}`,
        applicationId: app.id,
        type: 'FIELD_CHANGE',
        content: `修改折扣率从4.5%调整为5.2%`,
        operator: operators[(index + 1) % operators.length],
        timestamp: new Date(createdAt.getTime() + 7200000).toISOString(),
        metadata: { field: 'discountRate', oldValue: 0.045, newValue: 0.052 },
      });
    }

    evidence.push({
      id: `EVD-${String(counter++).padStart(6, '0')}`,
      applicationId: app.id,
      type: 'COMMENT',
      content: `请财务同事尽快审核，该供应商款项优先级较高`,
      operator: operators[(index + 2) % operators.length],
      timestamp: new Date(createdAt.getTime() + 14400000).toISOString(),
      metadata: {},
    });

    if (app.status === 'PAID') {
      evidence.push({
        id: `EVD-${String(counter++).padStart(6, '0')}`,
        applicationId: app.id,
        type: 'PAYMENT',
        content: `付款完成，金额: ${app.actualPaymentAmount.toLocaleString()}元`,
        operator: '财务A',
        timestamp: new Date(createdAt.getTime() + 86400000).toISOString(),
        metadata: { amount: app.actualPaymentAmount, method: '银行转账' },
      });
    }
  });

  return evidence;
}

const EVIDENCE = generateEvidence();

export {
  SUPPLIERS,
  PAYABLES,
  APPLICATIONS,
  TRANSITIONS,
  PAYMENTS,
  EVIDENCE,
};
