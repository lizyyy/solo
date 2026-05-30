import type { SettlementPlan, ExceptionRecord, PlatformTransaction, WithdrawalRecord, ForwardContract } from '../data/types'

export function exportToCSV(
  plans: SettlementPlan[],
  exceptions: ExceptionRecord[],
  transactions: PlatformTransaction[],
  withdrawals: WithdrawalRecord[],
  contracts: ForwardContract[]
): string {
  const headers = [
    '计划ID',
    '订单号',
    '平台',
    '币种',
    '金额',
    '结汇汇率',
    '结汇人民币金额',
    '计划结汇日',
    '锁汇合约ID',
    '提现记录ID',
    '状态',
    '异常原因',
  ]

  const txMap = new Map(transactions.map((t) => [t.id, t]))

  const rows = plans.map((p) => {
    const tx = txMap.get(p.transactionId)
    return [
      p.id,
      tx?.orderId ?? '',
      tx?.platform ?? '',
      p.currency,
      p.amount.toString(),
      p.settledRate.toString(),
      p.settledAmountCNY.toFixed(2),
      p.plannedDate,
      p.forwardContractId ?? '',
      p.withdrawalId,
      p.status === 'planned' ? '待执行' : p.status === 'executed' ? '已执行' : '异常跳过',
      p.exceptionReason ?? '',
    ].join(',')
  })

  const exceptionHeaders = [
    '',
    '异常ID',
    '类型',
    '描述',
    '影响金额',
    '币种',
    '原因',
    '状态',
  ]

  const exceptionRows = exceptions.map((e) => {
    const typeLabel =
      e.type === 'withdrawal_delay'
        ? '提现延迟'
        : e.type === 'forward_duplicate'
        ? '锁汇重复'
        : '汇率日期错误'
    return [
      '',
      e.id,
      typeLabel,
      `"${e.description}"`,
      e.impactAmount.toString(),
      e.impactCurrency,
      `"${e.reason}"`,
      e.status === 'unresolved' ? '未解决' : e.status === 'skipped' ? '已跳过' : '已解决',
    ].join(',')
  })

  return [headers.join(','), ...rows, '', exceptionHeaders.join(','), ...exceptionRows].join('\n')
}

export function downloadCSV(content: string, filename: string): void {
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadPDFReport(
  plans: SettlementPlan[],
  exceptions: ExceptionRecord[],
  dateFrom: string,
  dateTo: string
): void {
  const executed = plans.filter((p) => p.status === 'executed')
  const skipped = plans.filter((p) => p.status === 'skipped_exception')
  const totalCNY = executed.reduce((s, p) => s + p.settledAmountCNY, 0)

  const html = `
    <html>
    <head><meta charset="utf-8"><title>结汇排程报告</title>
    <style>
      body{font-family:sans-serif;padding:32px;color:#1a1f2e}
      h1{font-size:22px;border-bottom:2px solid #00d4aa;padding-bottom:8px}
      h2{font-size:16px;margin-top:24px;color:#38bdf8}
      table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}
      th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}
      th{background:#1a1f2e;color:#fff}
      .summary{display:flex;gap:24px;margin:16px 0}
      .summary-card{flex:1;background:#f8f9fa;border-radius:8px;padding:16px}
      .summary-card .value{font-size:24px;font-weight:700;color:#00d4aa}
      .exception{color:#ef4444}
    </style></head>
    <body>
    <h1>结汇排程报告</h1>
    <p>报告日期：${new Date().toISOString().slice(0, 10)} | 数据范围：${dateFrom} ~ ${dateTo}</p>
    <div class="summary">
      <div class="summary-card"><div>已执行结汇总额(CNY)</div><div class="value">${totalCNY.toLocaleString()}</div></div>
      <div class="summary-card"><div>已执行笔数</div><div class="value">${executed.length}</div></div>
      <div class="summary-card"><div>异常跳过笔数</div><div class="value exception">${skipped.length}</div></div>
    </div>
    <h2>结汇明细</h2>
    <table><tr><th>计划ID</th><th>币种</th><th>金额</th><th>汇率</th><th>人民币金额</th><th>计划日</th><th>状态</th></tr>
    ${plans.map((p) => `<tr><td>${p.id}</td><td>${p.currency}</td><td>${p.amount.toLocaleString()}</td><td>${p.settledRate}</td><td>${p.settledAmountCNY.toFixed(2)}</td><td>${p.plannedDate}</td><td>${p.status === 'executed' ? '已执行' : p.status === 'planned' ? '待执行' : '异常跳过'}</td></tr>`).join('')}
    </table>
    ${exceptions.length > 0 ? `<h2>异常记录</h2><table><tr><th>异常ID</th><th>类型</th><th>描述</th><th>影响金额</th><th>原因</th></tr>${exceptions.map((e) => `<tr class="exception"><td>${e.id}</td><td>${e.type === 'withdrawal_delay' ? '提现延迟' : e.type === 'forward_duplicate' ? '锁汇重复' : '汇率日期错误'}</td><td>${e.description}</td><td>${e.impactAmount.toLocaleString()} ${e.impactCurrency}</td><td>${e.reason}</td></tr>`).join('')}</table>` : ''}
    </body></html>
  `

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    setTimeout(() => {
      win.print()
    }, 500)
  }
}
