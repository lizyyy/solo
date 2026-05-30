import * as XLSX from 'xlsx'
import type { Receipt, Invoice, FeeAllocation, AuditLog, Anomaly } from '@/types'

export function exportToExcel(
  receipts: Receipt[],
  invoices: Invoice[],
  allocations: FeeAllocation[],
  auditLogs: AuditLog[],
  anomalies: Anomaly[]
): void {
  const wb = XLSX.utils.book_new()

  const receiptData = receipts.map(r => ({
    '收款流水号': r.receiptNo,
    '收款日期': r.receiptDate,
    '币种': r.currency,
    '收款金额': r.amount,
    '银行名称': r.bankName,
    '付款方': r.payer,
    '银行手续费': r.bankFee || 0,
    '代理行费用': r.agentFee || 0,
    '汇率': r.exchangeRate || '',
    '汇率日期': r.exchangeRateDate || '',
    '状态': getStatusText(r.status),
    '备注': r.remark
  }))
  const ws1 = XLSX.utils.json_to_sheet(receiptData)
  XLSX.utils.book_append_sheet(wb, ws1, '收款流水')

  const invoiceData = invoices.map(i => ({
    '发票号': i.invoiceNo,
    '发票日期': i.invoiceDate,
    '币种': i.currency,
    '发票金额': i.amount,
    '客户': i.customer,
    '产品': i.product,
    '关联收款号': receipts.find(r => r.id === i.receiptId)?.receiptNo || '',
    '短付金额': i.shortPayment || 0,
    '短付原因': i.shortPaymentReason || ''
  }))
  const ws2 = XLSX.utils.json_to_sheet(invoiceData)
  XLSX.utils.book_append_sheet(wb, ws2, '发票明细')

  const allocationData = allocations.map(a => ({
    '收款流水号': receipts.find(r => r.id === a.receiptId)?.receiptNo || '',
    '发票号': invoices.find(i => i.id === a.invoiceId)?.invoiceNo || '',
    '费用类型': getFeeTypeText(a.feeType),
    '分摊金额': a.amount,
    '分摊比例': `${(a.ratio * 100).toFixed(2)}%`,
    '分摊理由': a.reason,
    '是否人工调整': a.isManual ? '是' : '否'
  }))
  const ws3 = XLSX.utils.json_to_sheet(allocationData)
  XLSX.utils.book_append_sheet(wb, ws3, '费用分摊明细')

  const anomalyData = anomalies.map(a => ({
    '收款流水号': receipts.find(r => r.id === a.receiptId)?.receiptNo || '',
    '异常类型': getAnomalyTypeText(a.type),
    '严重程度': a.severity === 'error' ? '错误' : '警告',
    '描述': a.description,
    '证据': a.evidence,
    '状态': a.resolved ? '已解决' : '待处理',
    '解决人': a.resolvedBy || '',
    '解决时间': a.resolvedAt || ''
  }))
  const ws4 = XLSX.utils.json_to_sheet(anomalyData)
  XLSX.utils.book_append_sheet(wb, ws4, '异常记录')

  const auditData = auditLogs.map(l => ({
    '收款流水号': receipts.find(r => r.id === l.receiptId)?.receiptNo || '',
    '操作类型': getActionText(l.action),
    '操作人': l.operator,
    '操作时间': l.timestamp,
    '备注': l.remark
  }))
  const ws5 = XLSX.utils.json_to_sheet(auditData)
  XLSX.utils.book_append_sheet(wb, ws5, '审计日志')

  XLSX.writeFile(wb, `跨境收款手续费分摊_${new Date().toISOString().split('T')[0]}.xlsx`)
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    pending: '待分摊',
    allocated: '已分摊',
    reviewed: '已复核',
    rejected: '已驳回'
  }
  return map[status] || status
}

function getFeeTypeText(type: string): string {
  const map: Record<string, string> = {
    bank_fee: '银行手续费',
    agent_fee: '代理行费用',
    short_payment: '客户短付',
    other: '其他费用'
  }
  return map[type] || type
}

function getAnomalyTypeText(type: string): string {
  const map: Record<string, string> = {
    duplicate_fee: '重复扣费',
    exchange_rate_date: '汇率日期异常',
    short_payment_dispute: '短付争议',
    mismatch: '数据不匹配'
  }
  return map[type] || type
}

function getActionText(action: string): string {
  const map: Record<string, string> = {
    create: '创建',
    update: '更新',
    allocate: '分摊',
    review: '复核通过',
    reject: '驳回',
    export: '导出'
  }
  return map[action] || action
}

export function exportBackup(data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `跨境收款手续费分摊系统备份_${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
