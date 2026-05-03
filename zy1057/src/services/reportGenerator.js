import dayjs from 'dayjs'
import { RISK_LEVELS, RISK_LEVEL_LABELS, RISK_TYPE_LABELS, sortRisksByPriority } from './rulesEngine'

const MATERIAL_TYPE_LABELS = {
  audio: '音频',
  video: '视频',
  image: '图片',
  font: '字体',
}

const getRiskLevelBadge = (level) => {
  const colors = {
    [RISK_LEVELS.CRITICAL]: { bg: '#ff4d4f', label: '严重' },
    [RISK_LEVELS.HIGH]: { bg: '#ff7a45', label: '高' },
    [RISK_LEVELS.MEDIUM]: { bg: '#faad14', label: '中' },
    [RISK_LEVELS.LOW]: { bg: '#1890ff', label: '低' },
  }
  return colors[level] || colors[RISK_LEVELS.LOW]
}

export const generateMarkdownReport = (checkResult, project, timelines, materials) => {
  const { risks, stats, attributionList, materialStats } = checkResult
  const sortedRisks = sortRisksByPriority(risks)
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
  
  let md = `# 素材授权体检报告\n\n`
  
  md += `> 报告生成时间: ${now}\n\n`
  
  md += `## 一、项目摘要\n\n`
  
  md += `| 项目名称 | 客户 | 目标平台 | 状态 |\n`
  md += `|----------|------|----------|------|\n`
  md += `| ${project?.name || '未命名项目'} | ${project?.client_name || '-'} | ${project?.target_platforms?.join('、') || '-'} | ${project?.status || '草稿'} |\n\n`
  
  md += `**素材用量统计:**\n\n`
  md += `- 总素材数: ${materialStats.total} 个\n`
  md += `- 按类型分类: ${Object.entries(materialStats.byType).map(([type, count]) => `${MATERIAL_TYPE_LABELS[type] || type} ${count}个`).join('、')}\n`
  if (materialStats.expiringSoon > 0) {
    md += `- 30天内即将过期: ${materialStats.expiringSoon} 个\n`
  }
  if (materialStats.expired > 0) {
    md += `- 已过期: ${materialStats.expired} 个\n`
  }
  if (materialStats.nonCommercial > 0) {
    md += `- 非商用素材: ${materialStats.nonCommercial} 个\n`
  }
  if (materialStats.needsAttribution > 0) {
    md += `- 需要署名: ${materialStats.needsAttribution} 个\n`
  }
  md += '\n'
  
  md += `## 二、风险概览\n\n`
  
  md += `| 风险等级 | 数量 |\n`
  md += `|----------|------|\n`
  md += `| 严重 | ${stats.critical} |\n`
  md += `| 高 | ${stats.high} |\n`
  md += `| 中 | ${stats.medium} |\n`
  md += `| 低 | ${stats.low} |\n`
  md += `| **总计** | **${stats.total}** |\n\n`
  
  if (stats.total === 0) {
    md += `✅ **恭喜！未检测到授权风险**\n\n`
  } else {
    md += `## 三、风险明细\n\n`
    
    for (const risk of sortedRisks) {
      const levelLabel = RISK_LEVEL_LABELS[risk.level]
      
      md += `### ${levelLabel}: ${risk.title}\n\n`
      md += `- **素材名称**: ${risk.material_name}\n`
      md += `- **问题描述**: ${risk.message}\n`
      md += `- **详细信息**: ${risk.detail}\n`
      md += `- **处理建议**: ${risk.suggestion}\n\n`
    }
  }
  
  md += `## 四、待补充署名清单\n\n`
  
  if (attributionList.length === 0) {
    md += `无需要署名的素材。\n\n`
  } else {
    md += `| 素材名称 | 建议署名文本 |\n`
    md += `|----------|--------------|\n`
    for (const item of attributionList) {
      md += `| ${item.material_name} | ${item.attribution_text} |\n`
    }
    md += '\n'
  }
  
  md += `---\n\n`
  md += `*本报告由 Media License Checker 生成*`
  
  return md
}

export const generateHTMLReport = (checkResult, project, timelines, materials) => {
  const { risks, stats, attributionList, materialStats } = checkResult
  const sortedRisks = sortRisksByPriority(risks)
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
  
  const getRiskLevelClass = (level) => {
    const classes = {
      [RISK_LEVELS.CRITICAL]: 'report-risk-critical',
      [RISK_LEVELS.HIGH]: 'report-risk-high',
      [RISK_LEVELS.MEDIUM]: 'report-risk-medium',
      [RISK_LEVELS.LOW]: 'report-risk-low',
    }
    return classes[level] || classes[RISK_LEVELS.LOW]
  }
  
  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>素材授权体检报告</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      margin: 0;
      padding: 40px 20px;
    }
    .report-container {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .report-title {
      font-size: 28px;
      font-weight: bold;
      text-align: center;
      color: #1890ff;
      padding-bottom: 16px;
      border-bottom: 3px solid #1890ff;
      margin-bottom: 24px;
    }
    .report-meta {
      text-align: right;
      color: #999;
      font-size: 13px;
      margin-bottom: 32px;
    }
    .report-section {
      margin-bottom: 32px;
    }
    .report-section h2 {
      font-size: 20px;
      color: #333;
      padding-bottom: 8px;
      border-bottom: 2px solid #e8e8e8;
      margin-bottom: 16px;
    }
    .report-section h3 {
      font-size: 16px;
      color: #555;
      margin-bottom: 12px;
    }
    .report-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .report-table th,
    .report-table td {
      border: 1px solid #e8e8e8;
      padding: 10px 12px;
      text-align: left;
    }
    .report-table th {
      background-color: #fafafa;
      font-weight: 600;
      color: #333;
    }
    .report-table td {
      color: #666;
    }
    .stats-summary {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .stat-item {
      padding: 16px 24px;
      border-radius: 8px;
      text-align: center;
      min-width: 100px;
    }
    .stat-item .stat-value {
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .stat-item .stat-label {
      font-size: 13px;
      color: #666;
    }
    .stat-critical { background: #fff1f0; }
    .stat-critical .stat-value { color: #ff4d4f; }
    .stat-high { background: #fff7e6; }
    .stat-high .stat-value { color: #ff7a45; }
    .stat-medium { background: #fffbe6; }
    .stat-medium .stat-value { color: #faad14; }
    .stat-low { background: #e6f7ff; }
    .stat-low .stat-value { color: #1890ff; }
    .stat-total { background: #f0f0f0; }
    .stat-total .stat-value { color: #333; }
    .risk-item {
      margin-bottom: 16px;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid;
    }
    .risk-item h4 {
      margin: 0 0 8px 0;
      font-size: 16px;
    }
    .risk-item p {
      margin: 4px 0;
      font-size: 14px;
      color: #666;
    }
    .risk-item .suggestion {
      margin-top: 12px;
      padding: 10px;
      background: rgba(255,255,255,0.5);
      border-radius: 4px;
      font-size: 13px;
    }
    .risk-critical { background: #fff1f0; border-left-color: #ff4d4f; }
    .risk-high { background: #fff7e6; border-left-color: #ff7a45; }
    .risk-medium { background: #fffbe6; border-left-color: #faad14; }
    .risk-low { background: #e6f7ff; border-left-color: #1890ff; }
    .success-message {
      padding: 16px;
      background: #f6ffed;
      border: 1px solid #b7eb8f;
      border-radius: 8px;
      color: #52c41a;
      text-align: center;
      font-size: 16px;
    }
    .report-footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid #e8e8e8;
      text-align: right;
      color: #999;
      font-size: 12px;
    }
    .material-stats {
      background: #fafafa;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .material-stats ul {
      margin: 0;
      padding-left: 20px;
    }
    .material-stats li {
      margin: 4px 0;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="report-container">
    <h1 class="report-title">素材授权体检报告</h1>
    <div class="report-meta">报告生成时间: ${now}</div>
    
    <div class="report-section">
      <h2>一、项目摘要</h2>
      <table class="report-table">
        <tr>
          <th>项目名称</th>
          <th>客户</th>
          <th>目标平台</th>
          <th>状态</th>
        </tr>
        <tr>
          <td>${project?.name || '未命名项目'}</td>
          <td>${project?.client_name || '-'}</td>
          <td>${project?.target_platforms?.join('、') || '-'}</td>
          <td>${project?.status || '草稿'}</td>
        </tr>
      </table>
      
      <h3>素材用量统计</h3>
      <div class="material-stats">
        <ul>
          <li>总素材数: ${materialStats.total} 个</li>
          <li>按类型分类: ${Object.entries(materialStats.byType).map(([type, count]) => `${MATERIAL_TYPE_LABELS[type] || type} ${count}个`).join('、')}</li>
          ${materialStats.expiringSoon > 0 ? `<li style="color: #faad14;">30天内即将过期: ${materialStats.expiringSoon} 个</li>` : ''}
          ${materialStats.expired > 0 ? `<li style="color: #ff4d4f;">已过期: ${materialStats.expired} 个</li>` : ''}
          ${materialStats.nonCommercial > 0 ? `<li style="color: #ff7a45;">非商用素材: ${materialStats.nonCommercial} 个</li>` : ''}
          ${materialStats.needsAttribution > 0 ? `<li>需要署名: ${materialStats.needsAttribution} 个</li>` : ''}
        </ul>
      </div>
    </div>
    
    <div class="report-section">
      <h2>二、风险概览</h2>
      <div class="stats-summary">
        ${stats.critical > 0 ? `<div class="stat-item stat-critical"><div class="stat-value">${stats.critical}</div><div class="stat-label">严重</div></div>` : ''}
        ${stats.high > 0 ? `<div class="stat-item stat-high"><div class="stat-value">${stats.high}</div><div class="stat-label">高</div></div>` : ''}
        ${stats.medium > 0 ? `<div class="stat-item stat-medium"><div class="stat-value">${stats.medium}</div><div class="stat-label">中</div></div>` : ''}
        ${stats.low > 0 ? `<div class="stat-item stat-low"><div class="stat-value">${stats.low}</div><div class="stat-label">低</div></div>` : ''}
        <div class="stat-item stat-total"><div class="stat-value">${stats.total}</div><div class="stat-label">总计</div></div>
      </div>
    </div>
    
    <div class="report-section">
      <h2>三、风险明细</h2>
      ${stats.total === 0 ? `
        <div class="success-message">
          ✅ 恭喜！未检测到授权风险
        </div>
      ` : sortedRisks.map(risk => `
        <div class="risk-item ${getRiskLevelClass(risk.level)}">
          <h4>【${RISK_LEVEL_LABELS[risk.level]}】${risk.title}</h4>
          <p><strong>素材名称:</strong> ${risk.material_name}</p>
          <p><strong>问题描述:</strong> ${risk.message}</p>
          <p><strong>详细信息:</strong> ${risk.detail}</p>
          <div class="suggestion">
            <strong>💡 处理建议:</strong> ${risk.suggestion}
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="report-section">
      <h2>四、待补充署名清单</h2>
      ${attributionList.length === 0 ? `
        <p style="color: #666;">无需要署名的素材。</p>
      ` : `
        <table class="report-table">
          <tr>
            <th>素材名称</th>
            <th>建议署名文本</th>
          </tr>
          ${attributionList.map(item => `
            <tr>
              <td>${item.material_name}</td>
              <td>${item.attribution_text}</td>
            </tr>
          `).join('')}
        </table>
      `}
    </div>
    
    <div class="report-footer">
      本报告由 Media License Checker 生成
    </div>
  </div>
</body>
</html>`
  
  return html
}
