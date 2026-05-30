import type { Receipt, Invoice, FeeAllocation, Anomaly } from '@/types'

export function generateMockData(): {
  receipts: Receipt[]
  invoices: Invoice[]
  feeAllocations: FeeAllocation[]
  anomalies: Anomaly[]
} {
  const receipts: Receipt[] = [
    {
      id: '1',
      receiptNo: 'BK20240515001',
      receiptDate: '2024-05-15',
      currency: 'USD',
      amount: 48500,
      bankName: '汇丰银行',
      payer: 'ABC Trading Co., Ltd.',
      remark: '',
      status: 'allocated',
      createdAt: '2024-05-15T10:30:00Z',
      exchangeRate: 7.25,
      exchangeRateDate: '2024-05-15',
      bankFee: 500,
      agentFee: 1000
    },
    {
      id: '2',
      receiptNo: 'BK20240516002',
      receiptDate: '2024-05-16',
      currency: 'EUR',
      amount: 35200,
      bankName: '德意志银行',
      payer: 'XYZ GmbH',
      remark: '',
      status: 'pending',
      createdAt: '2024-05-16T09:15:00Z',
      exchangeRate: 7.85,
      exchangeRateDate: '2024-05-10',
      bankFee: 300,
      agentFee: 500
    },
    {
      id: '3',
      receiptNo: 'BK20240517003',
      receiptDate: '2024-05-17',
      currency: 'GBP',
      amount: 28000,
      bankName: '巴克莱银行',
      payer: 'London Trade Ltd.',
      remark: '客户扣除质量保证金',
      status: 'reviewed',
      createdAt: '2024-05-17T14:45:00Z',
      exchangeRate: 9.15,
      exchangeRateDate: '2024-05-17',
      bankFee: 400,
      agentFee: 600
    }
  ]

  const invoices: Invoice[] = [
    {
      id: 'inv1',
      invoiceNo: 'INV202405001',
      invoiceDate: '2024-05-01',
      currency: 'USD',
      amount: 30000,
      customer: 'ABC Trading Co., Ltd.',
      product: '电子产品配件',
      receiptId: '1'
    },
    {
      id: 'inv2',
      invoiceNo: 'INV202405002',
      invoiceDate: '2024-05-05',
      currency: 'USD',
      amount: 20000,
      customer: 'ABC Trading Co., Ltd.',
      product: '机械设备零件',
      receiptId: '1'
    },
    {
      id: 'inv3',
      invoiceNo: 'INV202405003',
      invoiceDate: '2024-05-08',
      currency: 'EUR',
      amount: 25000,
      customer: 'XYZ GmbH',
      product: '化工原料',
      receiptId: '2'
    },
    {
      id: 'inv4',
      invoiceNo: 'INV202405004',
      invoiceDate: '2024-05-10',
      currency: 'EUR',
      amount: 11000,
      customer: 'XYZ GmbH',
      product: '包装材料',
      receiptId: '2'
    },
    {
      id: 'inv5',
      invoiceNo: 'INV202405005',
      invoiceDate: '2024-05-12',
      currency: 'GBP',
      amount: 29000,
      customer: 'London Trade Ltd.',
      product: '纺织品',
      receiptId: '3',
      shortPayment: 1000,
      shortPaymentReason: '质量保证金扣除'
    },
    {
      id: 'inv6',
      invoiceNo: 'INV202405006',
      invoiceDate: '2024-05-14',
      currency: 'USD',
      amount: 15000,
      customer: 'Global Tech Inc.',
      product: '电子元器件',
      receiptId: undefined
    }
  ]

  const feeAllocations: FeeAllocation[] = [
    {
      id: 'alloc1',
      receiptId: '1',
      invoiceId: 'inv1',
      feeType: 'bank_fee',
      amount: 300,
      ratio: 0.6,
      reason: '按发票金额占比分摊银行手续费，该发票占总金额的 60.0%，对应分摊 300.00 USD',
      isManual: false,
      createdAt: '2024-05-15T11:00:00Z'
    },
    {
      id: 'alloc2',
      receiptId: '1',
      invoiceId: 'inv2',
      feeType: 'bank_fee',
      amount: 200,
      ratio: 0.4,
      reason: '按发票金额占比分摊银行手续费，该发票占总金额的 40.0%，对应分摊 200.00 USD',
      isManual: false,
      createdAt: '2024-05-15T11:00:00Z'
    },
    {
      id: 'alloc3',
      receiptId: '1',
      invoiceId: 'inv1',
      feeType: 'agent_fee',
      amount: 600,
      ratio: 0.6,
      reason: '按发票金额占比分摊代理行费用，该发票占总金额的 60.0%，对应分摊 600.00 USD',
      isManual: false,
      createdAt: '2024-05-15T11:00:00Z'
    },
    {
      id: 'alloc4',
      receiptId: '1',
      invoiceId: 'inv2',
      feeType: 'agent_fee',
      amount: 400,
      ratio: 0.4,
      reason: '按发票金额占比分摊代理行费用，该发票占总金额的 40.0%，对应分摊 400.00 USD',
      isManual: false,
      createdAt: '2024-05-15T11:00:00Z'
    },
    {
      id: 'alloc5',
      receiptId: '3',
      invoiceId: 'inv5',
      feeType: 'bank_fee',
      amount: 400,
      ratio: 1,
      reason: '按发票金额占比分摊银行手续费，该发票占总金额的 100.0%，对应分摊 400.00 GBP',
      isManual: false,
      createdAt: '2024-05-17T15:30:00Z'
    },
    {
      id: 'alloc6',
      receiptId: '3',
      invoiceId: 'inv5',
      feeType: 'agent_fee',
      amount: 600,
      ratio: 1,
      reason: '按发票金额占比分摊代理行费用，该发票占总金额的 100.0%，对应分摊 600.00 GBP',
      isManual: false,
      createdAt: '2024-05-17T15:30:00Z'
    },
    {
      id: 'alloc7',
      receiptId: '3',
      invoiceId: 'inv5',
      feeType: 'short_payment',
      amount: 1000,
      ratio: 1,
      reason: '按发票金额占比分摊客户短付，该发票占总金额的 100.0%，对应承担 1000.00 GBP 短付',
      isManual: false,
      createdAt: '2024-05-17T15:30:00Z'
    }
  ]

  const anomalies: Anomaly[] = [
    {
      id: 'anom1',
      receiptId: '2',
      type: 'exchange_rate_date',
      severity: 'warning',
      description: '所选汇率日期(2024-05-10)距离收款日(2024-05-16)超过6天，建议使用收款当日汇率以确保准确性',
      evidence: '汇率日期与收款日相差 6.0 天',
      resolved: false
    }
  ]

  return { receipts, invoices, feeAllocations, anomalies }
}
