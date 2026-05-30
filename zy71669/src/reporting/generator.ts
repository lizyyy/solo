import { SimulationResult, ReportConfig, ComparisonResult, KitchenLayout } from '../types';
import { generateHeatmapSVG } from '../visualization/heatmap';

export function generateReport(
  result: SimulationResult,
  layout: KitchenLayout,
  config: ReportConfig = {
    format: 'html',
    includeHeatmap: true,
    includeStats: true,
    includeAnomalies: true,
    includeDetectionPoints: true,
  },
): string {
  switch (config.format) {
    case 'html':
      return generateHTMLReport(result, layout, config);
    case 'markdown':
      return generateMarkdownReport(result, layout, config);
    case 'json':
      return generateJSONReport(result, layout, config);
    default:
      return generateHTMLReport(result, layout, config);
  }
}

function generateHTMLReport(
  result: SimulationResult,
  layout: KitchenLayout,
  config: ReportConfig,
): string {
  const heatmapSVG = config.includeHeatmap 
    ? generateHeatmapSVG(result, layout, { colorScheme: 'viridis', showLegend: true, showGrid: false })
    : '';

  const statsHTML = config.includeStats ? generateStatsHTML(result) : '';
  const anomaliesHTML = config.includeAnomalies ? generateAnomaliesHTML(result) : '';
  const detectionHTML = config.includeDetectionPoints ? generateDetectionHTML(result) : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${result.layoutName} - 油烟扩散模拟报告</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; background: #f5f6fa; }
    .header { text-align: center; margin-bottom: 30px; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header h1 { color: #2d3436; margin-bottom: 10px; }
    .header .meta { color: #636e72; font-size: 14px; }
    .section { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .section h2 { color: #2d3436; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #74b9ff; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-card .label { font-size: 12px; opacity: 0.9; margin-bottom: 5px; }
    .stat-card .value { font-size: 24px; font-weight: bold; }
    .stat-card .unit { font-size: 12px; opacity: 0.8; }
    .heatmap-container { text-align: center; overflow-x: auto; }
    .heatmap-container svg { max-width: 100%; height: auto; }
    .anomaly-list { list-style: none; }
    .anomaly-item { padding: 12px; margin-bottom: 10px; border-radius: 6px; border-left: 4px solid; }
    .anomaly-error { background: #ffebee; border-color: #e74c3c; }
    .anomaly-warning { background: #fff3cd; border-color: #f39c12; }
    .anomaly-info { background: #d1ecf1; border-color: #3498db; }
    .anomaly-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
    .anomaly-category { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: rgba(0,0,0,0.1); }
    .anomaly-message { font-weight: 500; margin-bottom: 5px; }
    .anomaly-suggestion { font-size: 13px; color: #636e72; }
    .detection-table { width: 100%; border-collapse: collapse; }
    .detection-table th, .detection-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    .detection-table th { background: #f8f9fa; font-weight: 600; }
    .detection-table tr:hover { background: #f8f9fa; }
    .status-exceeded { color: #e74c3c; font-weight: bold; }
    .status-ok { color: #27ae60; font-weight: bold; }
    .footer { text-align: center; color: #636e72; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🍳 厨房油烟扩散模拟报告</h1>
    <div class="meta">
      <strong>${result.layoutName}</strong> | 版本: ${result.version} | 生成时间: ${new Date(result.timestamp).toLocaleString('zh-CN')}
    </div>
    <div class="meta">模拟耗时: ${result.simulationTime}ms | 网格: ${result.gridSize.width}×${result.gridSize.height}</div>
  </div>

  ${statsHTML}
  ${config.includeHeatmap ? `<div class="section"><h2>📊 油烟浓度热力图</h2><div class="heatmap-container">${heatmapSVG}</div></div>` : ''}
  ${detectionHTML}
  ${anomaliesHTML}

  <div class="footer">
    <p>厨房油烟扩散模拟系统 | 报告自动生成</p>
  </div>
</body>
</html>`;
}

function generateStatsHTML(result: SimulationResult): string {
  const stats = result.overallStats;
  return `
  <div class="section">
    <h2>📈 模拟统计</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">最大浓度</div>
        <div class="value">${stats.maxConcentration.toFixed(2)}</div>
        <div class="unit">mg/m³</div>
      </div>
      <div class="stat-card">
        <div class="label">平均浓度</div>
        <div class="value">${stats.avgConcentration.toFixed(2)}</div>
        <div class="unit">mg/m³</div>
      </div>
      <div class="stat-card">
        <div class="label">排风效率</div>
        <div class="value">${(stats.exhaustEfficiency * 100).toFixed(1)}</div>
        <div class="unit">%</div>
      </div>
      <div class="stat-card">
        <div class="label">总风量</div>
        <div class="value">${stats.totalAirflow.toFixed(0)}</div>
        <div class="unit">m³/h</div>
      </div>
    </div>
  </div>`;
}

function generateAnomaliesHTML(result: SimulationResult): string {
  if (result.anomalies.length === 0) {
    return `
    <div class="section">
      <h2>⚠️ 异常检测</h2>
      <p style="color: #27ae60; padding: 20px; text-align: center;">✅ 未检测到异常，方案合规</p>
    </div>`;
  }

  const categoryLabels: Record<string, string> = {
    data: '数据问题',
    rule: '规则问题',
    material: '材料问题',
  };

  const anomaliesHTML = result.anomalies
    .sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
    .map(anomaly => `
    <li class="anomaly-item anomaly-${anomaly.severity}">
      <div class="anomaly-header">
        <span class="anomaly-category">${categoryLabels[anomaly.category] || anomaly.category}</span>
        <span style="font-weight: bold;">${anomaly.severity.toUpperCase()}</span>
      </div>
      <div class="anomaly-message">${anomaly.message}</div>
      <div class="anomaly-suggestion">💡 建议: ${anomaly.suggestion}</div>
      ${anomaly.field ? `<div style="font-size: 11px; color: #999; margin-top: 5px;">字段: ${anomaly.field}</div>` : ''}
    </li>
  `).join('');

  return `
  <div class="section">
    <h2>⚠️ 异常检测 (${result.anomalies.length}项)</h2>
    <ul class="anomaly-list">${anomaliesHTML}</ul>
  </div>`;
}

function generateDetectionHTML(result: SimulationResult): string {
  if (result.detectionPointResults.length === 0) return '';

  const rows = result.detectionPointResults.map(point => `
    <tr>
      <td>${point.name}</td>
      <td>(${point.position.x.toFixed(1)}, ${point.position.y.toFixed(1)}) ${point.position.unit}</td>
      <td style="font-family: monospace;">${point.concentration.toFixed(3)} mg/m³</td>
      <td>${point.threshold ? point.threshold.toFixed(3) + ' mg/m³' : '-'}</td>
      <td class="${point.exceeded ? 'status-exceeded' : 'status-ok'}">${point.exceeded ? '❌ 超限' : '✅ 正常'}</td>
    </tr>
  `).join('');

  return `
  <div class="section">
    <h2>📍 检测点结果</h2>
    <table class="detection-table">
      <thead>
        <tr>
          <th>检测点</th>
          <th>位置</th>
          <th>浓度</th>
          <th>阈值</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function generateMarkdownReport(
  result: SimulationResult,
  layout: KitchenLayout,
  config: ReportConfig,
): string {
  let md = `# 厨房油烟扩散模拟报告\n\n`;
  md += `**${result.layoutName}** | 版本: ${result.version} | 生成时间: ${new Date(result.timestamp).toLocaleString('zh-CN')}\n\n`;

  if (config.includeStats) {
    const stats = result.overallStats;
    md += `## 模拟统计\n\n`;
    md += `| 指标 | 数值 | 单位 |\n`;
    md += `|------|------|------|\n`;
    md += `| 最大浓度 | ${stats.maxConcentration.toFixed(3)} | mg/m³ |\n`;
    md += `| 平均浓度 | ${stats.avgConcentration.toFixed(3)} | mg/m³ |\n`;
    md += `| 排风效率 | ${(stats.exhaustEfficiency * 100).toFixed(1)} | % |\n`;
    md += `| 总风量 | ${stats.totalAirflow.toFixed(0)} | m³/h |\n\n`;
  }

  if (config.includeDetectionPoints && result.detectionPointResults.length > 0) {
    md += `## 检测点结果\n\n`;
    md += `| 检测点 | 位置 | 浓度(mg/m³) | 阈值 | 状态 |\n`;
    md += `|--------|------|-------------|------|------|\n`;
    for (const point of result.detectionPointResults) {
      md += `| ${point.name} | (${point.position.x}, ${point.position.y}) | ${point.concentration.toFixed(3)} | ${point.threshold || '-'} | ${point.exceeded ? '❌ 超限' : '✅ 正常'} |\n`;
    }
    md += '\n';
  }

  if (config.includeAnomalies && result.anomalies.length > 0) {
    const categoryLabels: Record<string, string> = { data: '数据问题', rule: '规则问题', material: '材料问题' };
    md += `## 异常检测\n\n`;
    for (const anomaly of result.anomalies) {
      md += `### ${anomaly.severity.toUpperCase()}: ${categoryLabels[anomaly.category]}\n\n`;
      md += `- **问题**: ${anomaly.message}\n`;
      md += `- **建议**: ${anomaly.suggestion}\n\n`;
    }
  }

  return md;
}

function generateJSONReport(
  result: SimulationResult,
  layout: KitchenLayout,
  config: ReportConfig,
): string {
  const report = {
    title: '厨房油烟扩散模拟报告',
    layoutName: result.layoutName,
    version: result.version,
    timestamp: result.timestamp,
    simulationTime: result.simulationTime,
    gridSize: result.gridSize,
    gridResolution: result.gridResolution,
    ...(config.includeStats && { stats: result.overallStats }),
    ...(config.includeDetectionPoints && { detectionPoints: result.detectionPointResults }),
    ...(config.includeAnomalies && { anomalies: result.anomalies }),
  };
  return JSON.stringify(report, null, 2);
}

export function generateComparisonReport(comparison: ComparisonResult): string {
  let md = `# 方案对比报告\n\n`;
  md += `## 方案: ${comparison.layout1Name} vs ${comparison.layout2Name}\n\n`;

  md += `## 参数差异\n\n`;
  if (comparison.differences.length === 0) {
    md += `无显著参数差异\n\n`;
  } else {
    md += `| 字段 | 方案1 | 方案2 |\n`;
    md += `|------|-------|-------|\n`;
    for (const diff of comparison.differences) {
      md += `| ${diff.field} | ${JSON.stringify(diff.value1)} | ${JSON.stringify(diff.value2)} |\n`;
    }
    md += '\n';
  }

  md += `## 性能对比\n\n`;
  md += `| 指标 | ${comparison.layout1Name} | ${comparison.layout2Name} | 变化 | 变化率 |\n`;
  md += `|------|--------------------------|--------------------------|------|--------|\n`;
  for (const stat of comparison.statDifferences) {
    const arrow = stat.change > 0 ? '↑' : stat.change < 0 ? '↓' : '→';
    const changeColor = stat.changePercent < 0 ? '✅' : stat.changePercent > 0 ? '⚠️' : '';
    md += `| ${stat.metric} | ${stat.value1.toFixed(2)} | ${stat.value2.toFixed(2)} | ${arrow} ${Math.abs(stat.change).toFixed(2)} | ${changeColor} ${stat.changePercent > 0 ? '+' : ''}${stat.changePercent.toFixed(1)}% |\n`;
  }

  return md;
}
