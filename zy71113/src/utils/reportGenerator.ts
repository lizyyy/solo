import jsPDF from 'jspdf'
import type { SignalPhase, Conflict, AccidentPoint } from '../types'

interface ReportData {
  intersectionName: string
  currentTime: number
  signalPhases: SignalPhase[]
  conflicts: Conflict[]
  accidentPoints: AccidentPoint[]
}

export async function generateReport(data: ReportData, canvasElement?: HTMLCanvasElement | null) {
  const reportWindow = window.open('', '_blank')
  if (!reportWindow) {
    alert('请允许弹出窗口以生成报告')
    return
  }

  const conflictTypeNames: Record<string, string> = {
    phase_offset: '相位偏移',
    pedestrian_conflict: '行人冲突',
    trajectory_async: '轨迹不同步',
  }

  const severityNames: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低',
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>事故复盘报告 - ${data.intersectionName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Microsoft YaHei', sans-serif; padding: 40px; background: #f5f5f5; }
        .report { max-width: 800px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { font-size: 24px; color: #1a365d; margin-bottom: 10px; }
        .subtitle { color: #64748b; margin-bottom: 30px; font-size: 14px; }
        .section { margin-bottom: 30px; }
        .section-title { font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #3182ce; }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
        .info-item { background: #f8fafc; padding: 12px; border-radius: 6px; }
        .info-label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
        .info-value { font-size: 14px; color: #1e293b; font-weight: 500; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f1f5f9; font-weight: 600; color: #475569; }
        .severity-high { color: #e53e3e; font-weight: 600; }
        .severity-medium { color: #d69e2e; font-weight: 600; }
        .severity-low { color: #3182ce; font-weight: 600; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="report">
        <h1>路口信号相位回放分析报告</h1>
        <div class="subtitle">路口名称：${data.intersectionName} | 导出时间：${new Date().toLocaleString('zh-CN')}</div>
        
        <div class="section">
          <div class="section-title">基本信息</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">回放时间点</div>
              <div class="info-value">${data.currentTime.toFixed(2)} 秒</div>
            </div>
            <div class="info-item">
              <div class="info-label">冲突总数</div>
              <div class="info-value">${data.conflicts.length} 处</div>
            </div>
            <div class="info-item">
              <div class="info-label">事故点数</div>
              <div class="info-value">${data.accidentPoints.length} 处</div>
            </div>
            <div class="info-item">
              <div class="info-label">信号相位</div>
              <div class="info-value">${data.signalPhases.length} 个</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">冲突检测详情</div>
          ${data.conflicts.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>类型</th>
                  <th>严重程度</th>
                  <th>描述</th>
                </tr>
              </thead>
              <tbody>
                ${data.conflicts.map((c) => `
                  <tr>
                    <td>${c.time.toFixed(2)}s</td>
                    <td>${conflictTypeNames[c.type]}</td>
                    <td class="severity-${c.severity}">${severityNames[c.severity]}</td>
                    <td>${c.description}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="color: #64748b; padding: 20px; text-align: center;">未检测到冲突</p>'}
        </div>

        <div class="section">
          <div class="section-title">事故点记录</div>
          ${data.accidentPoints.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>类型</th>
                  <th>位置</th>
                  <th>描述</th>
                </tr>
              </thead>
              <tbody>
                ${data.accidentPoints.map((a) => `
                  <tr>
                    <td>${a.time.toFixed(2)}s</td>
                    <td>${a.type}</td>
                    <td>(${a.x.toFixed(2)}, ${a.y.toFixed(2)})</td>
                    <td>${a.description}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="color: #64748b; padding: 20px; text-align: center;">暂无事故点记录</p>'}
        </div>

        <div class="footer">
          本报告由路口信号相位回放系统自动生成
        </div>
      </div>
    </body>
    </html>
  `

  reportWindow.document.write(htmlContent)
  reportWindow.document.close()

  if (canvasElement) {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4')
      pdf.setFontSize(20)
      pdf.text('Traffic Intersection Analysis Report', 20, 20)
      pdf.setFontSize(12)
      pdf.text(`Intersection: ${data.intersectionName}`, 20, 35)
      pdf.text(`Generated: ${new Date().toLocaleString('zh-CN')}`, 20, 42)
      pdf.text(`Time: ${data.currentTime.toFixed(2)}s`, 20, 49)
      pdf.text(`Conflicts: ${data.conflicts.length}`, 20, 56)
      
      const imgData = canvasElement.toDataURL('image/png')
      pdf.addImage(imgData, 'PNG', 20, 70, 170, 100)
      
      pdf.save(`intersection-report-${Date.now()}.pdf`)
    } catch (err) {
      console.error('PDF generation failed:', err)
    }
  }
}
