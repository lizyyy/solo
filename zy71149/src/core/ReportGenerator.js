export class ReportGenerator {
  generateReport(validationResult, route, zones, factoryInfo) {
    const now = new Date();
    const totalDistance = this.calculateDistance(route);
    const estimatedTime = Math.ceil(totalDistance / 30 * 60);

    const report = {
      title: "危化品转运路线校验报告",
      generatedAt: now.toLocaleString('zh-CN'),
      factoryName: factoryInfo?.name || "化工厂区",
      routeName: "规划路线",
      summary: {
        totalPoints: route.length,
        totalDistance: Math.round(totalDistance * 10) / 10,
        estimatedTime: estimatedTime,
        isValid: validationResult.isValid,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      },
      zoneSummary: {
        speedZones: zones.filter(z => z.type === 'speedZone').length,
        noStopZones: zones.filter(z => z.type === 'noStopZone').length,
        washPoints: zones.filter(z => z.type === 'washPoint').length
      },
      details: validationResult.details,
      recommendations: this.generateRecommendations(validationResult, route, zones),
      routePoints: route.map((p, i) => ({
        index: i + 1,
        x: Math.round(p.x * 10) / 10,
        z: Math.round(p.z * 10) / 10
      }))
    };

    return report;
  }

  generateRecommendations(validationResult, route, zones) {
    const recommendations = [];

    const noStopIssues = validationResult.details.find(d => d.ruleId === 'noStopZone');
    const speedIssues = validationResult.details.find(d => d.ruleId === 'speedZone');
    const washIssues = validationResult.details.find(d => d.ruleId === 'washPointDistance');
    const continuityIssues = validationResult.details.find(d => d.ruleId === 'routeContinuity');

    if (noStopIssues && !noStopIssues.passed) {
      recommendations.push({
        priority: "high",
        category: "安全合规",
        text: "调整路线以避开禁停区域，确保运输安全。建议绕行外围环路。"
      });
    }

    if (speedIssues && !speedIssues.passed) {
      recommendations.push({
        priority: "medium",
        category: "合规性",
        text: "确保路线经过所有限速区域，这些区域需要特别注意车速控制。"
      });
    }

    if (washIssues && !washIssues.passed) {
      recommendations.push({
        priority: "medium",
        category: "应急准备",
        text: "建议调整路线，使更多路段位于洗消点30米范围内，提高应急响应能力。"
      });
    }

    if (continuityIssues && !continuityIssues.passed) {
      recommendations.push({
        priority: "low",
        category: "路线优化",
        text: "添加更多路径点使路线更加平滑，避免过长的直线路段。"
      });
    }

    if (route.length > 0 && route.length < 5) {
      recommendations.push({
        priority: "low",
        category: "路线优化",
        text: "建议增加路径点数量，使路线规划更加精确。"
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: "low",
        category: "最佳实践",
        text: "路线规划合理，符合所有安全规范。建议进行实际演练验证。"
      });
    }

    return recommendations;
  }

  calculateDistance(route) {
    let distance = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const dx = route[i + 1].x - route[i].x;
      const dz = route[i + 1].z - route[i].z;
      distance += Math.sqrt(dx * dx + dz * dz);
    }
    return distance;
  }

  formatReportHTML(report) {
    const priorityColors = {
      high: '#ef4444',
      medium: '#f59e0b',
      low: '#3b82f6'
    };

    const priorityLabels = {
      high: '高',
      medium: '中',
      low: '低'
    };

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; padding: 20px; color: #1f2937; }
    .report-container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
    .report-header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 30px; }
    .report-header h1 { font-size: 24px; margin-bottom: 8px; }
    .report-header .subtitle { font-size: 14px; opacity: 0.8; }
    .report-content { padding: 30px; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 16px; font-weight: 600; color: #1e3a5f; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
    .summary-card { background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; }
    .summary-card .value { font-size: 28px; font-weight: 700; color: #1e3a5f; }
    .summary-card .label { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .summary-card.success .value { color: #22c55e; }
    .summary-card.error .value { color: #ef4444; }
    .summary-card.warning .value { color: #f59e0b; }
    .zone-stats { display: flex; gap: 20px; }
    .zone-stat { flex: 1; text-align: center; padding: 12px; background: #f8fafc; border-radius: 8px; }
    .zone-stat .value { font-size: 24px; font-weight: 600; color: #1e3a5f; }
    .zone-stat .label { font-size: 12px; color: #6b7280; }
    .result-item { padding: 12px 15px; border-radius: 8px; margin-bottom: 10px; }
    .result-item.passed { background: #f0fdf4; border-left: 3px solid #22c55e; }
    .result-item.failed { background: #fef2f2; border-left: 3px solid #ef4444; }
    .result-item.warning { background: #fffbeb; border-left: 3px solid #f59e0b; }
    .result-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
    .result-message { font-size: 13px; color: #6b7280; }
    .result-details { margin-top: 8px; padding-left: 16px; }
    .result-details li { font-size: 12px; color: #6b7280; margin-bottom: 2px; }
    .recommendation { padding: 12px 15px; border-radius: 8px; margin-bottom: 10px; background: #f8fafc; border-left: 3px solid #3b82f6; }
    .recommendation-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .priority-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; color: white; }
    .category { font-size: 12px; color: #6b7280; }
    .recommendation-text { font-size: 13px; }
    .route-table { width: 100%; border-collapse: collapse; }
    .route-table th, .route-table td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
    .route-table th { background: #f8fafc; font-weight: 600; color: #374151; }
    .route-table tr:hover { background: #f9fafb; }
    .report-footer { padding: 20px 30px; background: #f8fafc; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="report-header">
      <h1>${report.title}</h1>
      <div class="subtitle">厂区: ${report.factoryName} | 生成时间: ${report.generatedAt}</div>
    </div>
    
    <div class="report-content">
      <div class="section">
        <h2 class="section-title">路线概览</h2>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="value">${report.summary.totalPoints}</div>
            <div class="label">路径点数</div>
          </div>
          <div class="summary-card">
            <div class="value">${report.summary.totalDistance}m</div>
            <div class="label">总距离</div>
          </div>
          <div class="summary-card">
            <div class="value">${report.summary.estimatedTime}min</div>
            <div class="label">预计时间</div>
          </div>
          <div class="summary-card ${report.summary.isValid ? 'success' : 'error'}">
            <div class="value">${report.summary.isValid ? '通过' : '不通过'}</div>
            <div class="label">校验结果</div>
          </div>
          <div class="summary-card ${report.summary.errors > 0 ? 'error' : 'success'}">
            <div class="value">${report.summary.errors}</div>
            <div class="label">错误</div>
          </div>
          <div class="summary-card ${report.summary.warnings > 0 ? 'warning' : 'success'}">
            <div class="value">${report.summary.warnings}</div>
            <div class="label">警告</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">场景元素统计</h2>
        <div class="zone-stats">
          <div class="zone-stat">
            <div class="value">${report.zoneSummary.speedZones}</div>
            <div class="label">限速区</div>
          </div>
          <div class="zone-stat">
            <div class="value">${report.zoneSummary.noStopZones}</div>
            <div class="label">禁停区</div>
          </div>
          <div class="zone-stat">
            <div class="value">${report.zoneSummary.washPoints}</div>
            <div class="label">洗消点</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">规则校验详情</h2>
        ${report.details.map(d => `
          <div class="result-item ${d.passed ? 'passed' : d.type === 'error' ? 'failed' : 'warning'}">
            <div class="result-title">${d.ruleName}</div>
            <div class="result-message">${d.message}</div>
            ${d.details && d.details.length > 0 ? `
              <ul class="result-details">
                ${d.details.map(detail => `<li>${detail}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        `).join('')}
      </div>

      <div class="section">
        <h2 class="section-title">优化建议</h2>
        ${report.recommendations.map(r => `
          <div class="recommendation">
            <div class="recommendation-header">
              <span class="priority-badge" style="background: ${priorityColors[r.priority]}">${priorityLabels[r.priority]}优先级</span>
              <span class="category">${r.category}</span>
            </div>
            <div class="recommendation-text">${r.text}</div>
          </div>
        `).join('')}
      </div>

      <div class="section">
        <h2 class="section-title">路径点明细</h2>
        <table class="route-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>X坐标</th>
              <th>Z坐标</th>
            </tr>
          </thead>
          <tbody>
            ${report.routePoints.map(p => `
              <tr>
                <td>${p.index}</td>
                <td>${p.x}</td>
                <td>${p.z}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="report-footer">
      本报告由厂区危化路线沙盘系统自动生成
    </div>
  </div>
</body>
</html>`;
  }

  downloadReport(report) {
    const html = this.formatReportHTML(report);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `危化品转运路线报告_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  downloadJSON(report) {
    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `危化品转运路线报告_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
