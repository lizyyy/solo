export class ReportExporter {
  constructor(app) {
    this.app = app
  }

  exportReport() {
    const report = this.generateReport()
    this.downloadReport(report)
  }

  generateReport() {
    const timestamp = new Date().toLocaleString('zh-CN')
    const stats = this.app.sightlineAnalyzer.getStatistics()
    const analysis = this.app.sightlineAnalyzer.getAnalysisResults()
    const blockedViewpoints = this.app.sightlineAnalyzer.getBlockedViewpoints()
    const blockingObstacles = this.app.sightlineAnalyzer.getBlockingObstacles()

    const recommendations = this.generateRecommendations(stats, blockedViewpoints, blockingObstacles)

    return {
      reportInfo: {
        title: '游乐设施排队视线分析报告',
        generatedAt: timestamp,
        version: '1.0.0'
      },
      statistics: stats,
      detailedAnalysis: analysis,
      blockedViewpoints: blockedViewpoints,
      blockingObstacles: blockingObstacles,
      recommendations: recommendations
    }
  }

  generateRecommendations(stats, blocked, obstacles) {
    const recommendations = []

    if (stats.visibilityRate < 60) {
      recommendations.push({
        priority: 'HIGH',
        category: '整体布局',
        content: `当前可见率仅为${stats.visibilityRate}%，低于安全标准（建议≥80%）。建议重新评估提示屏位置或增加屏幕数量。`
      })
    } else if (stats.visibilityRate < 80) {
      recommendations.push({
        priority: 'MEDIUM',
        category: '整体布局',
        content: `当前可见率为${stats.visibilityRate}%，建议优化部分位置的视线。`
      })
    }

    if (Object.keys(obstacles).length > 0) {
      const sortedObstacles = Object.entries(obstacles)
        .sort((a, b) => b[1].count - a[1].count)
      
      sortedObstacles.forEach(([name, info]) => {
        if (info.count >= 3) {
          recommendations.push({
            priority: 'HIGH',
            category: '遮挡物移除',
            content: `「${name}」造成了${info.count}次视线遮挡，影响视点：${info.viewpoints.join('、')}。建议移除或迁移该遮挡物。`
          })
        } else {
          recommendations.push({
            priority: 'LOW',
            category: '遮挡物优化',
            content: `「${name}」造成了${info.count}次视线遮挡，可考虑优化位置。`
          })
        }
      })
    }

    if (blocked.length > 0) {
      const blockedNames = blocked.map(b => b.viewpoint).join('、')
      recommendations.push({
        priority: 'MEDIUM',
        category: '特定区域',
        content: `以下位置无法看到任何提示屏：${blockedNames}。建议在这些区域附近增设辅助屏幕。`
      })
    }

    return recommendations
  }

  downloadReport(report) {
    const htmlContent = this.generateHTMLReport(report)
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `视线分析报告_${new Date().toISOString().slice(0, 10)}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  generateHTMLReport(report) {
    const priorityColors = {
      HIGH: '#ef4444',
      MEDIUM: '#f59e0b',
      LOW: '#3b82f6'
    }

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.reportInfo.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; padding: 40px; line-height: 1.6; }
    .container { max-width: 1000px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    h1 { color: #e94560; font-size: 28px; margin-bottom: 8px; }
    h2 { color: #0f3460; font-size: 20px; margin: 30px 0 15px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
    h3 { color: #1e293b; font-size: 16px; margin: 20px 0 10px; }
    .meta { color: #64748b; font-size: 14px; margin-bottom: 30px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .stat-card { background: linear-gradient(135deg, #16213e, #0f3460); color: white; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; }
    .stat-label { font-size: 12px; opacity: 0.8; margin-top: 4px; }
    .good { color: #4ade80; }
    .bad { color: #f87171; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-weight: 600; color: #334155; }
    tr:hover { background: #f8fafc; }
    .status-visible { color: #059669; font-weight: 500; }
    .status-blocked { color: #dc2626; font-weight: 500; }
    .recommendation { padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid; }
    .recommendation.HIGH { background: #fef2f2; border-color: #ef4444; }
    .recommendation.MEDIUM { background: #fffbeb; border-color: #f59e0b; }
    .recommendation.LOW { background: #eff6ff; border-color: #3b82f6; }
    .priority-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-right: 8px; color: white; }
    .HIGH .priority-tag { background: #ef4444; }
    .MEDIUM .priority-tag { background: #f59e0b; }
    .LOW .priority-tag { background: #3b82f6; }
    .obstacle-item { display: flex; justify-content: space-between; padding: 10px 15px; background: #f8fafc; margin: 8px 0; border-radius: 6px; }
    .obstacle-count { background: #e94560; color: white; padding: 2px 10px; border-radius: 12px; font-weight: 600; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${report.reportInfo.title}</h1>
    <div class="meta">
      生成时间: ${report.reportInfo.generatedAt} | 
      版本: ${report.reportInfo.version}
    </div>

    <h2>📊 统计概览</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${report.statistics.totalViewpoints}</div>
        <div class="stat-label">总检测视点</div>
      </div>
      <div class="stat-card">
        <div class="stat-value good">${report.statistics.visibleViewpoints}</div>
        <div class="stat-label">可见视点</div>
      </div>
      <div class="stat-card">
        <div class="stat-value bad">${report.statistics.blockedViewpoints}</div>
        <div class="stat-label">遮挡视点</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${report.statistics.visibilityRate}%</div>
        <div class="stat-label">整体可见率</div>
      </div>
    </div>

    <h2>📋 详细分析结果</h2>
    <table>
      <thead>
        <tr>
          <th>视点名称</th>
          <th>位置坐标</th>
          <th>可见屏幕</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        ${report.detailedAnalysis.map(vp => `
          <tr>
            <td><strong>${vp.viewpoint}</strong></td>
            <td>(${vp.position.x.toFixed(1)}, ${vp.position.z.toFixed(1)})</td>
            <td>
              ${vp.screenResults.map(sr => `
                <div>
                  ${sr.screenName}: 
                  <span class="${sr.isVisible ? 'status-visible' : 'status-blocked'}">
                    ${sr.isVisible ? '✓ 可见 (' + sr.distance + 'm)' : '✗ 被' + sr.blockingObject + '遮挡'}
                  </span>
                </div>
              `).join('')}
            </td>
            <td class="${vp.hasVisibleScreen ? 'status-visible' : 'status-blocked'}">
              ${vp.hasVisibleScreen ? '✓ 可见' : '✗ 完全遮挡'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    ${report.blockedViewpoints.length > 0 ? `
    <h2>⚠️ 完全遮挡的视点</h2>
    <p>以下位置的游客无法看到任何安全提示屏：</p>
    <ul>
      ${report.blockedViewpoints.map(b => `
        <li><strong>${b.viewpoint}</strong> (${b.position.x.toFixed(1)}, ${b.position.z.toFixed(1)})</li>
      `).join('')}
    </ul>
    ` : ''}

    ${Object.keys(report.blockingObstacles).length > 0 ? `
    <h2>🧱 主要遮挡物</h2>
    ${Object.entries(report.blockingObstacles).map(([name, info]) => `
      <div class="obstacle-item">
        <div>
          <strong>${name}</strong><br>
          <small>影响视点: ${info.viewpoints.join(', ')}</small>
        </div>
        <span class="obstacle-count">${info.count}次</span>
      </div>
    `).join('')}
    ` : ''}

    <h2>💡 改进建议</h2>
    ${report.recommendations.map(r => `
      <div class="recommendation ${r.priority}">
        <span class="priority-tag">${r.priority === 'HIGH' ? '高优先级' : r.priority === 'MEDIUM' ? '中优先级' : '低优先级'}</span>
        <strong>[${r.category}]</strong> ${r.content}
      </div>
    `).join('')}

    <div class="footer">
      本报告由「游乐设施排队视线分析系统」自动生成
    </div>
  </div>
</body>
</html>`
  }
}
