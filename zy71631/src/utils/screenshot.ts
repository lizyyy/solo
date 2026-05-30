import html2canvas from 'html2canvas'
import { formatDateTime, SPL_MIN, SPL_MAX, ANOMALY_LABELS } from '@/utils'
import type { Anomaly, SeatMeasurement } from '@/types'

interface ReportData {
  anomalies: Anomaly[]
  measurements: SeatMeasurement[]
  bandName: string
  timestamp: string
}

export async function exportScreenshot(
  elementId: string = 'scene-container',
  bandName: string,
): Promise<void> {
  const element = document.getElementById(elementId)
  if (!element) throw new Error(`Element with id "${elementId}" not found`)

  const canvas = await html2canvas(element, {
    backgroundColor: '#0D1117',
    scale: 2,
    useCORS: true,
  })

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')

  const timestamp = formatDateTime(new Date().toISOString())
  const padding = 20

  ctx.fillStyle = 'rgba(13, 17, 23, 0.9)'
  ctx.fillRect(0, 0, canvas.width, 60)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 24px "Space Grotesk", sans-serif'
  ctx.fillText('声场剧院座位沙盘', padding, 38)

  ctx.fillStyle = '#58A6FF'
  ctx.font = '16px "JetBrains Mono", monospace'
  const rightText = `${bandName} | ${timestamp}`
  const rightTextWidth = ctx.measureText(rightText).width
  ctx.fillText(rightText, canvas.width - padding - rightTextWidth, 38)

  const legendWidth = 120
  const legendHeight = 180
  const legendX = canvas.width - padding - legendWidth
  const legendY = canvas.height - padding - legendHeight

  ctx.fillStyle = 'rgba(22, 27, 34, 0.9)'
  ctx.fillRect(legendX - 10, legendY - 10, legendWidth + 20, legendHeight + 40)
  ctx.strokeStyle = '#30363D'
  ctx.lineWidth = 1
  ctx.strokeRect(legendX - 10, legendY - 10, legendWidth + 20, legendHeight + 40)

  const gradient = ctx.createLinearGradient(0, legendY + legendHeight, 0, legendY)
  gradient.addColorStop(0, '#0a1e50')
  gradient.addColorStop(0.2, '#1450a0')
  gradient.addColorStop(0.4, '#28b4b4')
  gradient.addColorStop(0.6, '#78dc3c')
  gradient.addColorStop(0.8, '#ffc828')
  gradient.addColorStop(1, '#e62828')

  ctx.fillStyle = gradient
  ctx.fillRect(legendX, legendY, 14, legendHeight)

  ctx.fillStyle = '#8b949e'
  ctx.font = '11px "JetBrains Mono", monospace'
  ctx.fillText(String(SPL_MAX), legendX + 24, legendY + 8)
  ctx.fillText(String(SPL_MIN), legendX + 24, legendY + legendHeight)

  ctx.fillStyle = '#c9d1d9'
  ctx.font = '11px "Space Grotesk", sans-serif'
  ctx.fillText('dB SPL', legendX + 24, legendY - 2)

  const filename = `声场沙盘_${bandName}_${Date.now()}.png`
  const link = document.createElement('a')
  link.download = filename
  link.href = canvas.toDataURL('image/png')
  link.click()
}

export async function exportReport(
  elementId: string = 'scene-container',
  bandName: string,
  anomalies: Anomaly[],
  measurements: SeatMeasurement[],
): Promise<void> {
  const element = document.getElementById(elementId)
  if (!element) throw new Error(`Element with id "${elementId}" not found`)

  const canvas = await html2canvas(element, {
    backgroundColor: '#0D1117',
    scale: 2,
    useCORS: true,
  })
  const dataUrl = canvas.toDataURL('image/png')

  const timestamp = new Date()
  const timestampStr = formatDateTime(timestamp.toISOString())

  const bandMeasurements = measurements.filter((m) => m.frequencyBand === bandName)
  const splValues = bandMeasurements.map((m) => m.splDB)
  const avgSpl = splValues.length > 0 ? splValues.reduce((a, b) => a + b, 0) / splValues.length : 0
  const minSpl = splValues.length > 0 ? Math.min(...splValues) : 0
  const maxSpl = splValues.length > 0 ? Math.max(...splValues) : 0

  const bandAnomalies = anomalies.filter((a) => a.frequencyBand === bandName)
  const errorCount = bandAnomalies.filter((a) => a.severity === 'error').length
  const warningCount = bandAnomalies.filter((a) => a.severity === 'warning').length

  const reportData: ReportData = {
    anomalies: bandAnomalies,
    measurements: bandMeasurements,
    bandName,
    timestamp: timestampStr,
  }

  const reportHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>声场沙盘报告 - ${bandName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'IBM Plex Sans', system-ui, sans-serif; background: #0D1117; color: #c9d1d9; padding: 40px; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-family: 'Space Grotesk', sans-serif; font-size: 32px; color: #fff; margin-bottom: 8px; }
    .subtitle { color: #8b949e; margin-bottom: 32px; font-size: 14px; }
    .section { background: #161B22; border: 1px solid #30363D; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
    .section-title { font-family: 'Space Grotesk', sans-serif; font-size: 18px; color: #58A6FF; margin-bottom: 16px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; }
    .stat-card { background: #0D1117; border: 1px solid #30363D; border-radius: 6px; padding: 16px; }
    .stat-label { font-size: 12px; color: #8b949e; margin-bottom: 4px; }
    .stat-value { font-family: 'JetBrains Mono', monospace; font-size: 24px; color: #fff; }
    .screenshot-container { text-align: center; }
    .screenshot-container img { max-width: 100%; border-radius: 8px; border: 1px solid #30363D; }
    .anomaly-list { display: flex; flex-direction: column; gap: 12px; }
    .anomaly-item { background: #0D1117; border-left: 4px solid #30363D; border-radius: 4px; padding: 12px 16px; }
    .anomaly-item.error { border-left-color: #f85149; }
    .anomaly-item.warning { border-left-color: #FF8C00; }
    .anomaly-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .anomaly-type { font-weight: 600; font-size: 14px; }
    .anomaly-type.error { color: #f85149; }
    .anomaly-type.warning { color: #FF8C00; }
    .anomaly-source { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #8b949e; }
    .anomaly-message { font-size: 13px; color: #c9d1d9; }
    .anomaly-meta { font-size: 11px; color: #8b949e; margin-top: 4px; font-family: 'JetBrains Mono', monospace; }
    .empty { color: #8b949e; text-align: center; padding: 24px; font-style: italic; }
    @media print {
      body { background: #fff; color: #000; padding: 20px; }
      .section { background: #fff; border-color: #d0d7de; break-inside: avoid; }
      .stat-card { background: #f6f8fa; border-color: #d0d7de; }
      h1, .section-title { color: #000; }
      .subtitle, .stat-label, .anomaly-source, .anomaly-meta, .empty { color: #57606a; }
      .stat-value, .anomaly-message { color: #000; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>声场剧院座位沙盘 - 分析报告</h1>
    <p class="subtitle">频段: ${bandName} | 生成时间: ${timestampStr}</p>

    <div class="section">
      <h2 class="section-title">数据概览</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">座位总数</div>
          <div class="stat-value">${bandMeasurements.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">平均声压级</div>
          <div class="stat-value">${avgSpl.toFixed(1)} dB</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">最小值</div>
          <div class="stat-value">${minSpl.toFixed(1)} dB</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">最大值</div>
          <div class="stat-value">${maxSpl.toFixed(1)} dB</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">严重异常</div>
          <div class="stat-value" style="color: #f85149;">${errorCount}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">警告异常</div>
          <div class="stat-value" style="color: #FF8C00;">${warningCount}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">声场分布图</h2>
      <div class="screenshot-container">
        <img src="${dataUrl}" alt="声场分布图" />
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">异常列表</h2>
      ${bandAnomalies.length > 0 ? `
        <div class="anomaly-list">
          ${bandAnomalies.map((anomaly) => `
            <div class="anomaly-item ${anomaly.severity}">
              <div class="anomaly-header">
                <span class="anomaly-type ${anomaly.severity}">${ANOMALY_LABELS[anomaly.type] || anomaly.type}</span>
                <span class="anomaly-source">${anomaly.dataSource}</span>
              </div>
              <p class="anomaly-message">${anomaly.message}</p>
              <div class="anomaly-meta">
                ${anomaly.seatId ? `座位: ${anomaly.seatId} | ` : ''}
                ${anomaly.speakerId ? `扬声器: ${anomaly.speakerId} | ` : ''}
                频段: ${anomaly.frequencyBand}
              </div>
            </div>
          `).join('')}
        </div>
      ` : '<div class="empty">当前频段无异常记录</div>'}
    </div>
  </div>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
  `

  const reportWindow = window.open('', '_blank')
  if (reportWindow) {
    reportWindow.document.write(reportHtml)
    reportWindow.document.close()
  }

  void reportData
}
