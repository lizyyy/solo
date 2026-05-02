import {
  EvaluationResult,
  Report,
  MarkdownReport,
  HtmlReport,
  Risk,
  RiskType,
} from '../models/types.js';

export interface ComparisonReportInput {
  results: EvaluationResult[];
}

export class Reporter {
  generateMarkdownReport(result: EvaluationResult): MarkdownReport {
    const content = this.buildMarkdownContent(result);
    return {
      format: 'markdown',
      content,
    };
  }

  generateHtmlReport(result: EvaluationResult): HtmlReport {
    const content = this.buildHtmlContent(result);
    return {
      format: 'html',
      content,
    };
  }

  generateComparisonMarkdownReport(input: ComparisonReportInput): MarkdownReport {
    const content = this.buildComparisonMarkdownContent(input);
    return {
      format: 'markdown',
      content,
    };
  }

  generateComparisonHtmlReport(input: ComparisonReportInput): HtmlReport {
    const content = this.buildComparisonHtmlContent(input);
    return {
      format: 'html',
      content,
    };
  }

  private buildMarkdownContent(result: EvaluationResult): string {
    const lines: string[] = [];

    lines.push(`# 补光灯方案评估报告`);
    lines.push('');
    lines.push(`## 方案信息`);
    lines.push('');
    lines.push(`- **方案名称**: ${result.scenarioName}`);
    lines.push(`- **方案 ID**: ${result.scenarioId}`);
    lines.push('');

    lines.push(`## 综合评分`);
    lines.push('');
    lines.push(`| 维度 | 得分 | 满分 |`);
    lines.push(`|------|------|------|`);
    lines.push(`| 覆盖率 | ${result.score.breakdown.coverage.toFixed(1)} | ${result.score.maxTotal * 0.4} |`);
    lines.push(`| 费用效率 | ${result.score.breakdown.costEfficiency.toFixed(1)} | ${result.score.maxTotal * 0.25} |`);
    lines.push(`| 温升风险 | ${result.score.breakdown.heatRisk.toFixed(1)} | ${result.score.maxTotal * 0.2} |`);
    lines.push(`| 排程 | ${result.score.breakdown.scheduling.toFixed(1)} | ${result.score.maxTotal * 0.15} |`);
    lines.push(`| **总分** | **${result.score.total.toFixed(1)}** | **${result.score.maxTotal}** |`);
    lines.push('');
    lines.push(`**等级**: ${result.score.letterGrade}`);
    lines.push('');

    lines.push(`## 光照覆盖率`);
    lines.push('');
    const overallCoverage = (result.overallCoverage.coverageRatio * 100).toFixed(1);
    lines.push(`**整体覆盖率**: ${overallCoverage}% (${result.overallCoverage.coveredPoints}/${result.overallCoverage.totalPoints} 采样点)`);
    lines.push('');
    lines.push(`### 各托盘详情`);
    lines.push('');

    for (const tray of result.trayCoverages) {
      const name = tray.trayName || tray.trayId;
      const coverage = (tray.coverageRatio * 100).toFixed(1);
      const status = tray.meetsRequirement ? '✅ 达标' : '❌ 不达标';
      
      lines.push(`#### ${name} ${status}`);
      lines.push('');
      lines.push(`- 覆盖率: ${coverage}%`);
      lines.push(`- 采样点: ${tray.coveredPoints}/${tray.totalPoints}`);
      lines.push(`- 最小照度: ${tray.minLux.toFixed(0)} lux`);
      lines.push(`- 最大照度: ${tray.maxLux.toFixed(0)} lux`);
      lines.push(`- 平均照度: ${tray.avgLux.toFixed(0)} lux`);
      
      if (tray.darkZones.length > 0) {
        lines.push(`- ⚠️ 暗区数量: ${tray.darkZones.length} 个采样点`);
      }
      lines.push('');
    }

    lines.push(`## 用电与费用`);
    lines.push('');
    lines.push(`- **每日用电量**: ${result.consumption.totalKwh.toFixed(2)} kWh`);
    lines.push(`- **每日电费**: ¥${result.consumption.totalCost.toFixed(2)}`);
    lines.push(`- **预算状态**: ${result.consumption.budgetExceeded ? '❌ 超出预算' : '✅ 预算内'}`);
    if (result.consumption.budgetExceeded) {
      lines.push(`- **超出金额**: ¥${result.consumption.budgetExcess.toFixed(2)}`);
    }
    lines.push('');

    if (result.consumption.perLight.length > 0) {
      lines.push(`### 各灯具用电明细`);
      lines.push('');
      lines.push(`| 灯具 ID | 功率 | 每日时长 | 每日用电 | 每日电费 |`);
      lines.push(`|---------|------|----------|----------|----------|`);
      
      for (const light of result.consumption.perLight) {
        const name = light.lightName || light.lightId;
        lines.push(`| ${name} | ${light.power}W | ${light.dailyHours.toFixed(1)}h | ${light.dailyKwh.toFixed(2)}kWh | ¥${light.dailyCost.toFixed(2)} |`);
      }
      lines.push('');
    }

    lines.push(`## 风险警告`);
    lines.push('');

    if (result.risks.length === 0) {
      lines.push(`✅ 未检测到风险`);
    } else {
      const highRisks = result.risks.filter(r => r.severity === 'high');
      const mediumRisks = result.risks.filter(r => r.severity === 'medium');
      const lowRisks = result.risks.filter(r => r.severity === 'low');

      if (highRisks.length > 0) {
        lines.push(`### 🔴 高风险 (${highRisks.length})`);
        lines.push('');
        for (const risk of highRisks) {
          lines.push(`- ${this.getRiskTypeLabel(risk.type)}: ${risk.message}`);
        }
        lines.push('');
      }

      if (mediumRisks.length > 0) {
        lines.push(`### 🟡 中风险 (${mediumRisks.length})`);
        lines.push('');
        for (const risk of mediumRisks) {
          lines.push(`- ${this.getRiskTypeLabel(risk.type)}: ${risk.message}`);
        }
        lines.push('');
      }

      if (lowRisks.length > 0) {
        lines.push(`### 🟢 低风险/提示 (${lowRisks.length})`);
        lines.push('');
        for (const risk of lowRisks) {
          lines.push(`- ${this.getRiskTypeLabel(risk.type)}: ${risk.message}`);
        }
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
    lines.push(`*报告生成时间: ${new Date().toLocaleString('zh-CN')}*`);

    return lines.join('\n');
  }

  private buildHtmlContent(result: EvaluationResult): string {
    const overallCoverage = (result.overallCoverage.coverageRatio * 100).toFixed(1);
    const coverageColor = result.overallCoverage.coverageRatio >= 0.95 ? '#22c55e' :
                          result.overallCoverage.coverageRatio >= 0.8 ? '#eab308' : '#ef4444';

    const gradeColors: Record<string, string> = {
      'S': '#f59e0b',
      'A+': '#22c55e', 'A': '#22c55e', 'A-': '#22c55e',
      'B+': '#eab308', 'B': '#eab308', 'B-': '#eab308',
      'C+': '#f97316', 'C': '#f97316', 'C-': '#f97316',
      'D': '#ef4444', 'F': '#dc2626',
    };

    const gradeColor = gradeColors[result.score.letterGrade] || '#6b7280';

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>补光灯方案评估报告 - ${result.scenarioName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f8fafc;
      padding: 2rem;
      color: #1e293b;
      line-height: 1.6;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
    }
    .header h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    .header .meta { opacity: 0.9; font-size: 0.9rem; }
    .content { padding: 2rem; }
    section { margin-bottom: 2rem; }
    h2 {
      font-size: 1.25rem;
      color: #334155;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 0.5rem;
      margin-bottom: 1rem;
    }
    .score-card {
      display: flex;
      align-items: center;
      gap: 2rem;
      background: #f1f5f9;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 1rem;
    }
    .total-score {
      text-align: center;
    }
    .total-score .value {
      font-size: 3rem;
      font-weight: bold;
      color: #334155;
    }
    .total-score .max { font-size: 1rem; color: #64748b; }
    .grade-badge {
      font-size: 2.5rem;
      font-weight: bold;
      color: ${gradeColor};
      border: 3px solid ${gradeColor};
      border-radius: 50%;
      width: 80px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .score-breakdown {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }
    .score-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .score-item .label { font-weight: 500; }
    .score-item .value { font-weight: bold; color: #475569; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
    }
    th, td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
    }
    tr:hover { background: #f8fafc; }
    .coverage-bar {
      height: 20px;
      background: #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      margin: 0.5rem 0;
    }
    .coverage-bar .fill {
      height: 100%;
      background: ${coverageColor};
      width: ${overallCoverage}%;
      transition: width 0.3s ease;
    }
    .coverage-text {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
      color: #64748b;
    }
    .tray-card {
      background: #f8fafc;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    .tray-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .tray-name { font-weight: 600; font-size: 1.1rem; }
    .tray-status {
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .tray-status.ok { background: #dcfce7; color: #166534; }
    .tray-status.bad { background: #fee2e2; color: #991b1b; }
    .tray-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      font-size: 0.9rem;
    }
    .tray-stat .label { color: #64748b; font-size: 0.8rem; }
    .tray-stat .value { font-weight: 600; }
    .risk-section { margin-top: 1rem; }
    .risk-item {
      padding: 0.75rem 1rem;
      border-radius: 6px;
      margin-bottom: 0.5rem;
      border-left: 4px solid;
    }
    .risk-high { background: #fef2f2; border-color: #ef4444; }
    .risk-medium { background: #fefce8; border-color: #eab308; }
    .risk-low { background: #f0fdf4; border-color: #22c55e; }
    .risk-title { font-weight: 500; margin-bottom: 0.25rem; }
    .risk-desc { font-size: 0.9rem; color: #475569; }
    .footer {
      text-align: center;
      padding: 1.5rem;
      color: #64748b;
      font-size: 0.85rem;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌱 补光灯方案评估报告</h1>
      <div class="meta">
        方案: ${result.scenarioName} | ID: ${result.scenarioId}
      </div>
    </div>
    <div class="content">
      
      <section>
        <h2>📊 综合评分</h2>
        <div class="score-card">
          <div class="total-score">
            <div class="value">${result.score.total.toFixed(1)}<span class="max">/${result.score.maxTotal}</span></div>
          </div>
          <div class="grade-badge">${result.score.letterGrade}</div>
          <div class="score-breakdown">
            <div class="score-item">
              <span class="label">覆盖率</span>
              <span class="value">${result.score.breakdown.coverage.toFixed(1)}</span>
            </div>
            <div class="score-item">
              <span class="label">费用效率</span>
              <span class="value">${result.score.breakdown.costEfficiency.toFixed(1)}</span>
            </div>
            <div class="score-item">
              <span class="label">温升风险</span>
              <span class="value">${result.score.breakdown.heatRisk.toFixed(1)}</span>
            </div>
            <div class="score-item">
              <span class="label">排程</span>
              <span class="value">${result.score.breakdown.scheduling.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>💡 光照覆盖率</h2>
        <div class="coverage-bar">
          <div class="fill"></div>
        </div>
        <div class="coverage-text">
          <span>整体覆盖率: ${overallCoverage}%</span>
          <span>${result.overallCoverage.coveredPoints}/${result.overallCoverage.totalPoints} 采样点达标</span>
        </div>
        
        <h3 style="margin-top: 1.5rem; font-size: 1rem; color: #475569;">各托盘详情</h3>
        ${result.trayCoverages.map(tray => {
          const name = tray.trayName || tray.trayId;
          const coverage = (tray.coverageRatio * 100).toFixed(1);
          return `
          <div class="tray-card">
            <div class="tray-header">
              <span class="tray-name">${name}</span>
              <span class="tray-status ${tray.meetsRequirement ? 'ok' : 'bad'}">
                ${tray.meetsRequirement ? '✅ 达标' : '❌ 不达标'}
              </span>
            </div>
            <div class="tray-stats">
              <div class="tray-stat">
                <div class="label">覆盖率</div>
                <div class="value">${coverage}%</div>
              </div>
              <div class="tray-stat">
                <div class="label">采样点</div>
                <div class="value">${tray.coveredPoints}/${tray.totalPoints}</div>
              </div>
              <div class="tray-stat">
                <div class="label">最小照度</div>
                <div class="value">${tray.minLux.toFixed(0)} lux</div>
              </div>
              <div class="tray-stat">
                <div class="label">平均照度</div>
                <div class="value">${tray.avgLux.toFixed(0)} lux</div>
              </div>
            </div>
            ${tray.darkZones.length > 0 ? `<div style="margin-top: 0.75rem; padding: 0.5rem; background: #fef2f2; border-radius: 4px; font-size: 0.9rem; color: #991b1b;">
              ⚠️ 有 ${tray.darkZones.length} 个采样点光照不足
            </div>` : ''}
          </div>`;
        }).join('')}
      </section>

      <section>
        <h2>⚡ 用电与费用</h2>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1rem;">
          <div style="background: #f0f9ff; padding: 1rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.85rem; color: #0369a1;">每日用电量</div>
            <div style="font-size: 1.5rem; font-weight: bold; color: #0284c7;">${result.consumption.totalKwh.toFixed(2)} kWh</div>
          </div>
          <div style="background: #fdf4ff; padding: 1rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.85rem; color: #991b1b;">每日电费</div>
            <div style="font-size: 1.5rem; font-weight: bold; color: #a855f7;">¥${result.consumption.totalCost.toFixed(2)}</div>
          </div>
          <div style="background: ${result.consumption.budgetExceeded ? '#fef2f2' : '#f0fdf4'}; padding: 1rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.85rem; color: ${result.consumption.budgetExceeded ? '#991b1b' : '#166534'};">预算状态</div>
            <div style="font-size: 1.5rem; font-weight: bold; color: ${result.consumption.budgetExceeded ? '#dc2626' : '#16a34a'};">
              ${result.consumption.budgetExceeded ? '❌ 超出' : '✅ 内'}
            </div>
          </div>
        </div>
        
        ${result.consumption.perLight.length > 0 ? `
        <h3 style="margin-top: 1.5rem; font-size: 1rem; color: #475569;">各灯具用电明细</h3>
        <table>
          <thead>
            <tr>
              <th>灯具</th>
              <th>功率</th>
              <th>每日时长</th>
              <th>用电量</th>
              <th>电费</th>
            </tr>
          </thead>
          <tbody>
            ${result.consumption.perLight.map(light => {
              const name = light.lightName || light.lightId;
              return `
              <tr>
                <td>${name}</td>
                <td>${light.power}W</td>
                <td>${light.dailyHours.toFixed(1)}h</td>
                <td>${light.dailyKwh.toFixed(2)}kWh</td>
                <td>¥${light.dailyCost.toFixed(2)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>` : ''}
      </section>

      ${result.risks.length > 0 ? `
      <section>
        <h2>⚠️ 风险警告</h2>
        <div class="risk-section">
          ${result.risks.filter(r => r.severity === 'high').map(risk => `
            <div class="risk-item risk-high">
              <div class="risk-title">🔴 ${this.getRiskTypeLabel(risk.type)}</div>
              <div class="risk-desc">${risk.message}</div>
            </div>`).join('')}
          
          ${result.risks.filter(r => r.severity === 'medium').map(risk => `
            <div class="risk-item risk-medium">
              <div class="risk-title">🟡 ${this.getRiskTypeLabel(risk.type)}</div>
              <div class="risk-desc">${risk.message}</div>
            </div>`).join('')}
          
          ${result.risks.filter(r => r.severity === 'low').map(risk => `
            <div class="risk-item risk-low">
              <div class="risk-title">🟢 ${this.getRiskTypeLabel(risk.type)}</div>
              <div class="risk-desc">${risk.message}</div>
            </div>`).join('')}
        </div>
      </section>` : `
      <section>
        <h2>✅ 风险状态</h2>
        <div style="background: #f0fdf4; padding: 1rem; border-radius: 8px; color: #166534;">
          未检测到风险，方案状态良好。
        </div>
      </section>`}

    </div>
    <div class="footer">
      报告生成时间: ${new Date().toLocaleString('zh-CN')}
    </div>
  </div>
</body>
</html>`;

    return html;
  }

  private buildComparisonMarkdownContent(input: ComparisonReportInput): string {
    const lines: string[] = [];

    lines.push(`# 补光灯方案对比报告`);
    lines.push('');
    lines.push(`共比较 ${input.results.length} 个方案`);
    lines.push('');

    lines.push(`## 综合评分对比`);
    lines.push('');
    lines.push(`| 方案名称 | 总分 | 等级 | 覆盖率 | 日电费 | 风险数 |`);
    lines.push(`|----------|------|------|--------|--------|--------|`);

    const sorted = [...input.results].sort((a, b) => b.score.total - a.score.total);

    for (const result of sorted) {
      const coverage = (result.overallCoverage.coverageRatio * 100).toFixed(0);
      const cost = result.consumption.totalCost.toFixed(2);
      lines.push(`| ${result.scenarioName} | ${result.score.total.toFixed(1)}/${result.score.maxTotal} | ${result.score.letterGrade} | ${coverage}% | ¥${cost} | ${result.risks.length} |`);
    }
    lines.push('');

    lines.push(`## 各方案详情`);
    lines.push('');

    for (let i = 0; i < sorted.length; i++) {
      const result = sorted[i];
      const rank = i + 1;
      
      lines.push(`### 第 ${rank} 名: ${result.scenarioName}`);
      lines.push('');
      lines.push(`- **评分**: ${result.score.total.toFixed(1)} / ${result.score.maxTotal} (${result.score.letterGrade})`);
      lines.push(`- **覆盖率**: ${(result.overallCoverage.coverageRatio * 100).toFixed(1)}%`);
      lines.push(`- **日用电量**: ${result.consumption.totalKwh.toFixed(2)} kWh`);
      lines.push(`- **日电费**: ¥${result.consumption.totalCost.toFixed(2)}`);
      lines.push(`- **风险数**: ${result.risks.length} 个`);
      
      if (i === 0) {
        lines.push(`- 🏆 **推荐方案**`);
      }
      lines.push('');

      if (result.risks.length > 0) {
        const highRisks = result.risks.filter(r => r.severity === 'high');
        if (highRisks.length > 0) {
          lines.push(`> ⚠️ 高风险: ${highRisks.map(r => r.message).join('; ')}`);
          lines.push('');
        }
      }
    }

    lines.push('---');
    lines.push('');
    lines.push(`*报告生成时间: ${new Date().toLocaleString('zh-CN')}*`);

    return lines.join('\n');
  }

  private buildComparisonHtmlContent(input: ComparisonReportInput): string {
    const sorted = [...input.results].sort((a, b) => b.score.total - a.score.total);
    
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>补光灯方案对比报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      padding: 2rem;
      color: #1e293b;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      text-align: center;
    }
    .header h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    .content { padding: 2rem; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 2rem;
    }
    th, td {
      padding: 1rem;
      text-align: center;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
    }
    td:first-child { text-align: left; font-weight: 500; }
    .rank-1 { background: #fef3c7; }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .badge-a { background: #dcfce7; color: #166534; }
    .badge-b { background: #fefce8; color: #854d0e; }
    .badge-c { background: #fff7ed; color: #9a3412; }
    .badge-d { background: #fef2f2; color: #991b1b; }
    .footer {
      text-align: center;
      padding: 1.5rem;
      color: #64748b;
      font-size: 0.85rem;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌱 补光灯方案对比报告</h1>
      <p>共比较 ${input.results.length} 个方案</p>
    </div>
    <div class="content">
      <table>
        <thead>
          <tr>
            <th>排名</th>
            <th>方案名称</th>
            <th>总分</th>
            <th>等级</th>
            <th>覆盖率</th>
            <th>日电费</th>
            <th>风险数</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map((r, i) => {
            const coverage = (r.overallCoverage.coverageRatio * 100).toFixed(0);
            const cost = r.consumption.totalCost.toFixed(2);
            const gradeClass = r.score.letterGrade.startsWith('A') ? 'badge-a' :
                               r.score.letterGrade.startsWith('B') ? 'badge-b' :
                               r.score.letterGrade.startsWith('C') ? 'badge-c' : 'badge-d';
            return `
            <tr class="${i === 0 ? 'rank-1' : ''}">
              <td>${i === 0 ? '🏆 第1' : `第${i + 1}`}</td>
              <td>${r.scenarioName}</td>
              <td>${r.score.total.toFixed(1)}</td>
              <td><span class="badge ${gradeClass}">${r.score.letterGrade}</span></td>
              <td>${coverage}%</td>
              <td>¥${cost}</td>
              <td>${r.risks.length}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="footer">
      报告生成时间: ${new Date().toLocaleString('zh-CN')}
    </div>
  </div>
</body>
</html>`;

    return html;
  }

  private getRiskTypeLabel(type: RiskType): string {
    const labels: Record<RiskType, string> = {
      [RiskType.DARK_ZONE]: '暗区警告',
      [RiskType.OVERLAP_WASTE]: '重叠浪费',
      [RiskType.HEAT_RISK]: '温升风险',
      [RiskType.TIME_CONFLICT]: '时段冲突',
      [RiskType.BUDGET_EXCEEDED]: '预算超额',
      [RiskType.OUTSIDE_ROOM]: '位置异常',
      [RiskType.INVALID_CONFIG]: '配置错误',
    };
    return labels[type] || '未知风险';
  }
}
