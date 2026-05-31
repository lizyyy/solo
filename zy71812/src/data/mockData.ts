import { RateTable, RefundItem, SettlementAttachment, ManualConfirmation, OperationLog } from '../types';
import { sha256 } from '../utils/hash';
import { addDays, getToday } from '../utils/date';

const today = getToday();

export const mockRates: RateTable[] = [
  {
    id: 'rate_001',
    supplierId: 'sup_001',
    supplierName: '北京华信物流有限公司',
    rateType: 'service_fee',
    rate: 0.03,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-06-30',
    version: 'v1.0',
  },
  {
    id: 'rate_002',
    supplierId: 'sup_002',
    supplierName: '上海迅捷供应链管理有限公司',
    rateType: 'commission',
    rate: 0.05,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    version: 'v1.2',
  },
  {
    id: 'rate_003',
    supplierId: 'sup_003',
    supplierName: '广州恒达仓储服务有限公司',
    rateType: 'penalty',
    rate: 0.02,
    effectiveFrom: '2026-03-01',
    effectiveTo: '2026-12-31',
    version: 'v1.0',
  },
  {
    id: 'rate_004',
    supplierId: 'sup_001',
    supplierName: '北京华信物流有限公司',
    rateType: 'service_fee',
    rate: 0.035,
    effectiveFrom: '2026-07-01',
    effectiveTo: '2026-12-31',
    version: 'v1.1',
  },
];

async function createAttachments(refundId: string, scenarios: string[]): Promise<SettlementAttachment[]> {
  const attachments: SettlementAttachment[] = [];
  
  const reviewDeadline = addDays(today, -7);
  const normalUpload = addDays(today, -14);
  const lateUpload = addDays(today, -3);

  if (scenarios.includes('normal')) {
    const content = `发票内容：服务费结算，金额已核对无误`;
    attachments.push({
      id: `att_${refundId}_01`,
      refundId,
      fileName: `增值税专用发票_${refundId}.pdf`,
      fileType: 'invoice',
      uploadDate: normalUpload,
      reviewDeadline,
      isLate: false,
      hash: await sha256(content + refundId),
      content,
    });
  }

  if (scenarios.includes('late')) {
    const content = `结算单内容：晚到的结算附件，需复核`;
    attachments.push({
      id: `att_${refundId}_02`,
      refundId,
      fileName: `结算确认单_${refundId}.pdf`,
      fileType: 'settlement',
      uploadDate: lateUpload,
      reviewDeadline,
      isLate: true,
      hash: await sha256(content + refundId),
      content,
    });
  }

  if (scenarios.includes('proof')) {
    const content = `退款凭证：银行回单，交易流水号已确认`;
    attachments.push({
      id: `att_${refundId}_03`,
      refundId,
      fileName: `银行回单_${refundId}.pdf`,
      fileType: 'proof',
      uploadDate: normalUpload,
      reviewDeadline,
      isLate: false,
      hash: await sha256(content + refundId),
      content,
    });
  }

  return attachments;
}

export async function generateMockData(): Promise<{
  rates: RateTable[];
  refunds: RefundItem[];
  operations: OperationLog[];
}> {
  const refunds: RefundItem[] = [];
  const operations: OperationLog[] = [];

  const baseData = [
    {
      id: 'ref_001',
      serialNo: 'TX202605150001',
      supplierId: 'sup_001',
      supplierName: '北京华信物流有限公司',
      amount: 15000.00,
      feeAmount: 450.00,
      refundDate: addDays(today, -45),
      belongPeriod: '2026-04',
      entryDate: addDays(today, -43),
      writeOffDate: addDays(today, -40),
      rateId: 'rate_001',
      scenarios: ['normal'],
      attachments: ['normal', 'proof'],
      status: 'normal' as const,
    },
    {
      id: 'ref_002',
      serialNo: 'TX202605150002',
      supplierId: 'sup_002',
      supplierName: '上海迅捷供应链管理有限公司',
      amount: 28000.00,
      feeAmount: 1400.00,
      refundDate: addDays(today, -35),
      belongPeriod: '2026-04',
      entryDate: addDays(today, -5),
      writeOffDate: addDays(today, -3),
      rateId: 'rate_002',
      scenarios: ['cross_period'],
      attachments: ['normal', 'settlement'],
      status: 'normal' as const,
    },
    {
      id: 'ref_003',
      serialNo: 'TX202605150003',
      supplierId: 'sup_001',
      supplierName: '北京华信物流有限公司',
      amount: 8500.00,
      feeAmount: 255.00,
      refundDate: addDays(today, -50),
      belongPeriod: '2026-04',
      entryDate: addDays(today, -48),
      writeOffDate: null,
      rateId: 'rate_001',
      scenarios: ['pending'],
      attachments: ['normal'],
      status: 'normal' as const,
    },
    {
      id: 'ref_004',
      serialNo: 'TX202605150004',
      supplierId: 'sup_003',
      supplierName: '广州恒达仓储服务有限公司',
      amount: 12000.00,
      feeAmount: 240.00,
      refundDate: addDays(today, -20),
      belongPeriod: '2026-05',
      entryDate: addDays(today, -18),
      writeOffDate: addDays(today, -15),
      rateId: 'rate_003',
      scenarios: ['late_attachment'],
      attachments: ['normal', 'late'],
      status: 'normal' as const,
    },
    {
      id: 'ref_005',
      serialNo: 'TX202605150005',
      supplierId: 'sup_002',
      supplierName: '上海迅捷供应链管理有限公司',
      amount: 35000.00,
      feeAmount: 1750.00,
      refundDate: addDays(today, -25),
      belongPeriod: '2026-05',
      entryDate: addDays(today, -23),
      writeOffDate: addDays(today, -20),
      rateId: 'rate_002',
      scenarios: ['duplicate'],
      attachments: ['normal', 'proof'],
      status: 'normal' as const,
    },
    {
      id: 'ref_006',
      serialNo: 'TX202605150005',
      supplierId: 'sup_002',
      supplierName: '上海迅捷供应链管理有限公司',
      amount: 35000.00,
      feeAmount: 1750.00,
      refundDate: addDays(today, -25),
      belongPeriod: '2026-05',
      entryDate: addDays(today, -22),
      writeOffDate: addDays(today, -20),
      rateId: 'rate_002',
      scenarios: ['duplicate'],
      attachments: ['normal'],
      status: 'normal' as const,
    },
    {
      id: 'ref_007',
      serialNo: 'TX202605150007',
      supplierId: 'sup_001',
      supplierName: '北京华信物流有限公司',
      amount: 22000.00,
      feeAmount: 770.00,
      refundDate: addDays(today, -10),
      belongPeriod: '2026-05',
      entryDate: addDays(today, -8),
      writeOffDate: addDays(today, -5),
      rateId: 'rate_004',
      scenarios: ['normal', 'manual_correction'],
      attachments: ['normal', 'proof', 'late'],
      status: 'normal' as const,
    },
    {
      id: 'ref_008',
      serialNo: 'TX202605150008',
      supplierId: 'sup_003',
      supplierName: '广州恒达仓储服务有限公司',
      amount: 5500.00,
      feeAmount: 110.00,
      refundDate: addDays(today, -60),
      belongPeriod: '2026-03',
      entryDate: addDays(today, -58),
      writeOffDate: null,
      rateId: 'rate_003',
      scenarios: ['pending', 'cross_period'],
      attachments: ['normal'],
      status: 'normal' as const,
    },
  ];

  for (const data of baseData) {
    const attachments = await createAttachments(data.id, data.attachments);
    
    const confirmations: ManualConfirmation[] = [];
    if (data.scenarios.includes('manual_correction')) {
      confirmations.push({
        id: `conf_${data.id}_01`,
        refundId: data.id,
        operator: '张会计',
        conclusion: 'adjusted',
        explanation: '手续费计算有误，原费率3%应为3.5%，已调整。根据2026年Q2新费率表执行。',
        reconciliationNote: '对账差异：¥110.00，已与供应商确认，调整后金额正确。',
        confirmedAt: new Date().toISOString(),
        evidenceChainHash: await sha256(`manual_correction_${data.id}`),
      });
    }

    refunds.push({
      id: data.id,
      serialNo: data.serialNo,
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      amount: data.amount,
      feeAmount: data.feeAmount,
      refundDate: data.refundDate,
      belongPeriod: data.belongPeriod,
      entryDate: data.entryDate,
      writeOffDate: data.writeOffDate,
      status: data.status,
      rateId: data.rateId,
      anomalies: [],
      attachments,
      confirmations,
    });

    operations.push({
      id: `op_${data.id}_01`,
      refundId: data.id,
      operator: '系统',
      action: 'import',
      oldValue: null,
      newValue: { id: data.id, serialNo: data.serialNo },
      remark: '数据导入',
      operatedAt: new Date().toISOString(),
      snapshotHash: await sha256(`import_${data.id}_${Date.now()}`),
    });
  }

  return {
    rates: mockRates,
    refunds,
    operations,
  };
}

export const getSupplierList = () => [
  { id: 'sup_001', name: '北京华信物流有限公司' },
  { id: 'sup_002', name: '上海迅捷供应链管理有限公司' },
  { id: 'sup_003', name: '广州恒达仓储服务有限公司' },
];
