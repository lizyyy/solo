import type { Receipt, Invoice, FeeAllocation, FeeType } from '@/types'

export function calculateFeeAllocations(
  receipt: Receipt,
  invoices: Invoice[],
  feeType: FeeType,
  totalFee: number,
  currency: string
): Omit<FeeAllocation, 'id' | 'createdAt'>[] {
  if (invoices.length === 0) return []
  
  const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0)
  if (totalInvoiceAmount === 0) return []

  const allocations: Omit<FeeAllocation, 'id' | 'createdAt'>[] = []
  let remainingFee = totalFee

  invoices.forEach((invoice, index) => {
    const ratio = invoice.amount / totalInvoiceAmount
    
    let allocatedAmount: number
    if (index === invoices.length - 1) {
      allocatedAmount = Number(remainingFee.toFixed(2))
    } else {
      allocatedAmount = Number((totalFee * ratio).toFixed(2))
      remainingFee -= allocatedAmount
    }

    const ratioPercent = (ratio * 100).toFixed(1)
    let reason = ''

    switch (feeType) {
      case 'bank_fee':
        reason = `按发票金额占比分摊银行手续费，该发票占总金额的 ${ratioPercent}%，对应分摊 ${allocatedAmount} ${currency}`
        break
      case 'agent_fee':
        reason = `按发票金额占比分摊代理行费用，该发票占总金额的 ${ratioPercent}%，对应分摊 ${allocatedAmount} ${currency}`
        break
      case 'short_payment':
        reason = `按发票金额占比分摊客户短付，该发票占总金额的 ${ratioPercent}%，对应承担 ${allocatedAmount} ${currency} 短付`
        break
      default:
        reason = `按发票金额占比分摊费用，该发票占总金额的 ${ratioPercent}%，对应分摊 ${allocatedAmount} ${currency}`
    }

    allocations.push({
      receiptId: receipt.id,
      invoiceId: invoice.id,
      feeType,
      amount: allocatedAmount,
      ratio: Number(ratio.toFixed(4)),
      reason,
      isManual: false
    })
  })

  return allocations
}

export function detectAnomalies(receipt: Receipt, allReceipts: Receipt[]): { type: string; severity: string; description: string; evidence: string }[] {
  const anomalies: { type: string; severity: string; description: string; evidence: string }[] = []

  const duplicateFees = allReceipts.filter(r =>
    r.id !== receipt.id &&
    r.bankName === receipt.bankName &&
    r.receiptDate === receipt.receiptDate &&
    r.bankFee === receipt.bankFee &&
    receipt.bankFee && receipt.bankFee > 0
  )

  if (duplicateFees.length > 0) {
    anomalies.push({
      type: 'duplicate_fee',
      severity: 'error',
      description: `系统检测到${receipt.bankName}在${receipt.receiptDate}有两笔相同金额(${receipt.bankFee})的扣费，可能存在重复扣除，请人工核实`,
      evidence: `收款流水 ${receipt.receiptNo} 与 ${duplicateFees.map(r => r.receiptNo).join('、')} 扣费记录重复`
    })
  }

  if (receipt.exchangeRateDate && receipt.receiptDate) {
    const rateDate = new Date(receipt.exchangeRateDate)
    const recDate = new Date(receipt.receiptDate)
    const diffDays = Math.abs(rateDate.getTime() - recDate.getTime()) / (1000 * 60 * 60 * 24)
    
    if (diffDays > 3) {
      anomalies.push({
        type: 'exchange_rate_date',
        severity: 'warning',
        description: `所选汇率日期(${receipt.exchangeRateDate})距离收款日(${receipt.receiptDate})超过${Math.floor(diffDays)}天，建议使用收款当日汇率以确保准确性`,
        evidence: `汇率日期与收款日相差 ${diffDays.toFixed(1)} 天`
      })
    }
  }

  return anomalies
}

export function checkShortPayment(receipt: Receipt, invoices: Invoice[]): { isShort: boolean; diffAmount: number; diffRatio: number; reason: string } {
  const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0)
  const totalFees = (receipt.bankFee || 0) + (receipt.agentFee || 0)
  const expectedAmount = totalInvoiceAmount - totalFees
  const diffAmount = receipt.amount - expectedAmount
  const diffRatio = totalInvoiceAmount > 0 ? diffAmount / totalInvoiceAmount : 0

  const isShort = Math.abs(diffRatio) > 0.05 && receipt.remark === ''

  let reason = ''
  if (isShort) {
    if (diffAmount < 0) {
      reason = `收款金额与发票金额（扣除费用后）差异较大，差额 ${Math.abs(diffAmount).toFixed(2)} ${receipt.currency}（占比 ${(Math.abs(diffRatio) * 100).toFixed(1)}%），已标记为待核实短付，请勿直接作为折扣处理`
    } else {
      reason = `收款金额超出预期 ${diffAmount.toFixed(2)} ${receipt.currency}（占比 ${(diffRatio * 100).toFixed(1)}%），请核实是否为多收或其他款项`
    }
  }

  return { isShort, diffAmount, diffRatio, reason }
}
