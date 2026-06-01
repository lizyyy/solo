import type { GameResult, OperationLog, PauseRecord, SupplementNote } from '@/types'

function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}分${secs}秒`
}

function getFailureReasonText(reason?: string): string {
  switch (reason) {
    case 'rule_misunderstanding':
      return '规则理解错误（风险值过高）'
    case 'timeout':
      return '操作超时（时间耗尽）'
    default:
      return '未知原因'
  }
}

function getOperationTypeText(type: string): string {
  switch (type) {
    case 'place':
      return '放置'
    case 'remove':
      return '移除'
    case 'click':
      return '点击'
    default:
      return type
  }
}

export function exportToJSON(result: GameResult): void {
  const dataStr = JSON.stringify(result, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `保险理赔逃脱屋_${result.sessionId}_${formatDateTime(result.exportMetadata.processingEndTime).replace(/[/:]/g, '-')}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportToCSV(result: GameResult): void {
  const rows: string[][] = []
  
  rows.push(['保险理赔逃脱屋 - 操作日志导出'])
  rows.push([''])
  rows.push(['【基本信息】'])
  rows.push(['会话ID', result.sessionId])
  rows.push(['学生姓名', result.studentName || '未填写'])
  rows.push(['材料包', result.materialPack?.name || ''])
  rows.push(['材料来源', result.exportMetadata.materialSource])
  rows.push(['处理开始时间', formatDateTime(result.exportMetadata.processingStartTime)])
  rows.push(['处理结束时间', formatDateTime(result.exportMetadata.processingEndTime)])
  rows.push(['最终状态', result.status === 'completed' ? '成功完成' : '练习失败'])
  rows.push(['失败原因', result.status === 'failed' ? getFailureReasonText(result.failureReason) : '-'])
  rows.push(['最终分数', result.finalScore.toString()])
  rows.push(['最终资源', result.finalResource.toString()])
  rows.push(['最终风险', result.finalRisk.toString()])
  rows.push([''])

  rows.push(['【关键判定】'])
  result.exportMetadata.keyDecisions.forEach((d, i) => {
    rows.push([`判定${i + 1}`, d])
  })
  rows.push([''])

  rows.push(['【失败诊断详情】'])
  result.diagnosticDetails.forEach((d, i) => {
    rows.push([`详情${i + 1}`, d])
  })
  rows.push([''])

  rows.push(['【操作日志】'])
  rows.push(['序号', '时间', '操作类型', '材料ID', '材料名称', '目标槽位', '是否正确', '分数变化', '风险变化', '资源变化', '原始备注'])
  
  result.operationLogs.forEach((log: OperationLog, idx: number) => {
    const material = result.materialPack?.materials?.find((m: any) => m.id === log.materialId)
    const slot = result.materialPack?.slots?.find((s: any) => s.id === log.targetSlot)
    rows.push([
      (idx + 1).toString(),
      formatDateTime(log.timestamp),
      getOperationTypeText(log.operationType),
      log.materialId,
      material?.title || '',
      slot?.label || log.targetSlot || '',
      log.isCorrect === undefined ? '-' : log.isCorrect ? '是' : '否',
      log.scoreDelta?.toString() || '0',
      log.riskDelta?.toString() || '0',
      log.resourceDelta?.toString() || '0',
      log.rawNote || '',
    ])
  })
  rows.push([''])

  rows.push(['【暂停记录】'])
  rows.push(['序号', '暂停时间', '恢复时间', '暂停原因', '是否故意打断'])
  result.pauseRecords.forEach((record: PauseRecord, idx: number) => {
    rows.push([
      (idx + 1).toString(),
      formatDateTime(record.pauseTime),
      record.resumeTime ? formatDateTime(record.resumeTime) : '-',
      record.reason,
      record.isIntentional ? '是' : '否',
    ])
  })
  rows.push([''])

  rows.push(['【补录备注】'])
  rows.push(['序号', '补录时间', '补录人', '关联操作ID', '备注内容', '差异说明'])
  result.supplementNotes.forEach((note: SupplementNote, idx: number) => {
    rows.push([
      (idx + 1).toString(),
      formatDateTime(note.addedAt),
      note.addedBy,
      note.operationId || '-',
      note.content,
      note.operationId ? '针对特定操作的补录说明' : '全局补充说明',
    ])
  })

  const csvContent = rows.map(row => 
    row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',')
  ).join('\n')

  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `保险理赔逃脱屋_${result.sessionId}_操作日志.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function generateHTMLReport(result: GameResult): string {
  const totalTime = result.exportMetadata.processingEndTime 
    ? Math.floor((new Date(result.exportMetadata.processingEndTime).getTime() - new Date(result.exportMetadata.processingStartTime).getTime()) / 1000)
    : 0

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>保险理赔逃脱屋 - 练习报告</title>
  <style>
    body { font-family: 'Microsoft YaHei', sans-serif; line-height: 1.6; color: #333; max-width: 1000px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 3px solid #ff6b35; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { margin: 0; color: #1a1a2e; font-size: 24px; }
    .section { margin-bottom: 25px; }
    .section h2 { color: #1a1a2e; border-left: 4px solid #4ecdc4; padding-left: 10px; font-size: 18px; margin-bottom: 15px; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .info-item { display: flex; }
    .info-label { font-weight: bold; min-width: 120px; color: #666; }
    .info-value { flex: 1; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
    .status-success { background: #d4edda; color: #155724; }
    .status-failed { background: #f8d7da; color: #721c24; }
    .reason-tag { background: #fff3cd; color: #856404; padding: 2px 8px; border-radius: 4px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 14px; }
    th { background: #f5f5f5; font-weight: bold; }
    tr:nth-child(even) { background: #fafafa; }
    .correct { color: #155724; }
    .incorrect { color: #721c24; }
    .raw-note { font-style: italic; color: #666; background: #fff9e6; padding: 4px 8px; border-left: 2px solid #ffc107; margin-top: 4px; }
    .supplement-note { background: #fff3cd; border: 1px dashed #ffc107; padding: 8px; border-radius: 4px; margin-top: 8px; }
    .supplement-label { color: #856404; font-weight: bold; font-size: 12px; }
    .pause-marker { background: linear-gradient(90deg, transparent, #ffe5d0, transparent); text-align: center; padding: 8px; color: #ff6b35; font-size: 13px; }
    .key-decisions { background: #e8f4f8; border-left: 4px solid #4ecdc4; padding: 15px; }
    .key-decisions ul { margin: 0; padding-left: 20px; }
    .key-decisions li { margin-bottom: 5px; }
    .diagnostic { background: #fff5f5; border-left: 4px solid #e63946; padding: 15px; }
    .diagnostic ul { margin: 0; padding-left: 20px; }
    .handover { background: #f0f9eb; border: 2px solid #2a9d8f; padding: 15px; border-radius: 8px; }
    .handover-title { color: #2a9d8f; font-weight: bold; margin-bottom: 10px; }
    .score-display { font-size: 32px; font-weight: bold; color: #1a1a2e; }
    .score-label { font-size: 14px; color: #666; }
    .metrics { display: flex; gap: 30px; margin: 15px 0; }
    .metric { text-align: center; }
    .metric-value { font-size: 24px; font-weight: bold; }
    .metric-score { color: #2a9d8f; }
    .metric-risk { color: #e63946; }
    .metric-resource { color: #4ecdc4; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 12px; }
    .no-print { display: none; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>保险理赔逃脱屋 - 练习报告</h1>
    <p style="margin: 5px 0; color: #666;">会话ID: ${result.sessionId} | 导出时间: ${formatDateTime(result.exportMetadata.exportedAt)}</p>
  </div>

  <div class="section">
    <h2>一、基本信息</h2>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">学生姓名：</span><span class="info-value">${result.studentName || '未填写'}</span></div>
      <div class="info-item"><span class="info-label">处理时长：</span><span class="info-value">${formatDuration(totalTime)}</span></div>
      <div class="info-item"><span class="info-label">材料包：</span><span class="info-value">${result.materialPack?.name || '-'}</span></div>
      <div class="info-item"><span class="info-label">材料来源：</span><span class="info-value">${result.exportMetadata.materialSource}</span></div>
      <div class="info-item"><span class="info-label">开始时间：</span><span class="info-value">${formatDateTime(result.exportMetadata.processingStartTime)}</span></div>
      <div class="info-item"><span class="info-label">结束时间：</span><span class="info-value">${formatDateTime(result.exportMetadata.processingEndTime)}</span></div>
      <div class="info-item"><span class="info-label">最终状态：</span><span class="info-value"><span class="status-badge ${result.status === 'completed' ? 'status-success' : 'status-failed'}">${result.status === 'completed' ? '成功完成' : '练习失败'}</span></span></div>
      ${result.status === 'failed' ? `<div class="info-item"><span class="info-label">失败原因：</span><span class="info-value"><span class="reason-tag">${getFailureReasonText(result.failureReason)}</span></span></div>` : ''}
    </div>

    <div class="metrics">
      <div class="metric">
        <div class="metric-value metric-score">${result.finalScore}</div>
        <div class="score-label">最终分数</div>
      </div>
      <div class="metric">
        <div class="metric-value metric-risk">${result.finalRisk}</div>
        <div class="score-label">风险值</div>
      </div>
      <div class="metric">
        <div class="metric-value metric-resource">${result.finalResource}</div>
        <div class="score-label">剩余资源</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>二、关键判定（交接用）</h2>
    <div class="key-decisions">
      <ul>
        ${result.exportMetadata.keyDecisions.map(d => `<li>${d}</li>`).join('')}
      </ul>
    </div>
  </div>

  ${result.diagnosticDetails.length > 0 ? `
  <div class="section">
    <h2>三、失败诊断详情</h2>
    <div class="diagnostic">
      <ul>
        ${result.diagnosticDetails.map(d => `<li>${d}</li>`).join('')}
      </ul>
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h2>四、操作时间线（保留原始备注）</h2>
    <table>
      <thead>
        <tr>
          <th width="5%">序号</th>
          <th width="15%">时间</th>
          <th width="8%">操作</th>
          <th width="20%">材料</th>
          <th width="15%">目标槽位</th>
          <th width="8%">正确</th>
          <th width="7%">分数</th>
          <th width="7%">风险</th>
          <th width="15%">备注</th>
        </tr>
      </thead>
      <tbody>
        ${result.operationLogs.map((log: OperationLog, idx: number) => {
          const material = result.materialPack?.materials?.find((m: any) => m.id === log.materialId)
          const slot = result.materialPack?.slots?.find((s: any) => s.id === log.targetSlot)
          const supplement = result.supplementNotes.find((n: SupplementNote) => n.operationId === log.id)
          return `
          <tr>
            <td>${idx + 1}</td>
            <td>${formatDateTime(log.timestamp)}</td>
            <td>${getOperationTypeText(log.operationType)}</td>
            <td>${material?.title || log.materialId}</td>
            <td>${slot?.label || log.targetSlot || '-'}</td>
            <td class="${log.isCorrect ? 'correct' : log.isCorrect === false ? 'incorrect' : ''}">${log.isCorrect === undefined ? '-' : log.isCorrect ? '✓' : '✗'}</td>
            <td>${log.scoreDelta || 0 >= 0 ? '+' : ''}${log.scoreDelta || 0}</td>
            <td>${log.riskDelta || 0 >= 0 ? '+' : ''}${log.riskDelta || 0}</td>
            <td>
              ${log.rawNote ? `<div class="raw-note">${log.rawNote}</div>` : '-'}
              ${supplement ? `<div class="supplement-note"><div class="supplement-label">补录于 ${formatDateTime(supplement.addedAt)} by ${supplement.addedBy}</div>${supplement.content}</div>` : ''}
            </td>
          </tr>
          `
        }).join('')}
      </tbody>
    </table>
  </div>

  ${result.pauseRecords.length > 0 ? `
  <div class="section">
    <h2>五、暂停记录</h2>
    <table>
      <thead>
        <tr>
          <th width="5%">序号</th>
          <th width="25%">暂停时间</th>
          <th width="25%">恢复时间</th>
          <th width="35%">暂停原因</th>
          <th width="10%">故意打断</th>
        </tr>
      </thead>
      <tbody>
        ${result.pauseRecords.map((record: PauseRecord, idx: number) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${formatDateTime(record.pauseTime)}</td>
            <td>${record.resumeTime ? formatDateTime(record.resumeTime) : '-'}</td>
            <td>${record.reason}</td>
            <td>${record.isIntentional ? '✓ 是' : '否'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="section">
    <h2>六、交接信息</h2>
    <div class="handover">
      <div class="handover-title">📋 本练习结果已包含完整操作痕迹，可直接用于交接</div>
      <div class="info-grid" style="margin-top: 10px;">
        <div class="info-item"><span class="info-label">材料来源：</span><span class="info-value">${result.exportMetadata.materialSource}</span></div>
        <div class="info-item"><span class="info-label">处理人：</span><span class="info-value">${result.exportMetadata.handler}</span></div>
        <div class="info-item"><span class="info-label">处理开始：</span><span class="info-value">${formatDateTime(result.exportMetadata.processingStartTime)}</span></div>
        <div class="info-item"><span class="info-label">处理结束：</span><span class="info-value">${formatDateTime(result.exportMetadata.processingEndTime)}</span></div>
      </div>
      <p style="margin-top: 10px; font-size: 13px; color: #666;">
        <strong>说明：</strong>所有操作记录、暂停记录、补录备注均已完整保留。原始备注未做任何清洗，失败原因已自动诊断。
        如需追溯具体判定理由，请查看"关键判定"部分。
      </p>
    </div>
  </div>

  <div class="footer">
    <p>本报告由「保险理赔逃脱屋」系统自动生成 | ${formatDateTime(result.exportMetadata.exportedAt)}</p>
    <p>材料来源：${result.exportMetadata.materialSource} | 处理人：${result.exportMetadata.handler}</p>
  </div>
</body>
</html>`
}

export function printHTMLReport(result: GameResult): void {
  const html = generateHTMLReport(result)
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }
}

export function saveToLocalStorage(result: GameResult): void {
  const key = `escape_room_${result.sessionId}`
  localStorage.setItem(key, JSON.stringify(result))
  
  const sessionsKey = 'escape_room_sessions'
  const sessions = JSON.parse(localStorage.getItem(sessionsKey) || '[]')
  if (!sessions.includes(result.sessionId)) {
    sessions.push(result.sessionId)
    localStorage.setItem(sessionsKey, JSON.stringify(sessions))
  }
}

export function loadFromLocalStorage(sessionId: string): GameResult | null {
  const key = `escape_room_${sessionId}`
  const data = localStorage.getItem(key)
  return data ? JSON.parse(data) : null
}

export function getAllSessions(): string[] {
  return JSON.parse(localStorage.getItem('escape_room_sessions') || '[]')
}
