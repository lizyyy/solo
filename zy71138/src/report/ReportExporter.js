export class ReportExporter {
  constructor(sceneManager, validator) {
    this.sceneManager = sceneManager;
    this.validator = validator;
  }

  generateReport() {
    const validationSummary = this.validator.getSummary();
    const barriersData = this.getBarriersData();
    const timestamp = new Date().toLocaleString('zh-CN');

    const report = {
      title: '扶梯检修围挡预演报告',
      generatedAt: timestamp,
      summary: {
        totalChecks: validationSummary.total,
        errors: validationSummary.errors,
        warnings: validationSummary.warnings,
        passed: validationSummary.passed,
        status: validationSummary.passed ? '通过' : '不通过'
      },
      barriers: barriersData,
      validationResults: validationSummary.results,
      statistics: this.generateStatistics()
    };

    return report;
  }

  getBarriersData() {
    return this.sceneManager.barriers.map(b => ({
      id: b.data.id,
      name: b.data.name,
      floor: b.data.floor,
      position: { 
        x: Math.round(b.mesh.position.x), 
        z: Math.round(b.mesh.position.z) 
      },
      size: { width: b.data.width, depth: b.data.depth },
      rotation: b.mesh.rotation.y || 0
    }));
  }

  generateStatistics() {
    const fireDoors = this.sceneManager.fireDoors;
    const escalators = this.sceneManager.escalators;
    const barriers = this.sceneManager.barriers;

    const floors = ['1F', '2F', '3F'];
    const floorStats = floors.map(floor => ({
      floor,
      fireDoors: fireDoors.filter(f => f.data.floor === floor).length,
      escalators: escalators.filter(e => e.data.floor === floor).length,
      barriers: barriers.filter(b => b.data.floor === floor).length
    }));

    return {
      totalFireDoors: fireDoors.length,
      totalEscalators: escalators.length,
      totalBarriers: barriers.length,
      floorStats
    };
  }

  exportToHTML() {
    const report = this.generateReport();
    
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 40px; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    h1 { color: #1a1a2e; font-size: 28px; margin-bottom: 8px; }
    .subtitle { color: #666; margin-bottom: 32px; font-size: 14px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
    .summary-card { padding: 20px; border-radius: 8px; text-align: center; }
    .summary-card.passed { background: linear-gradient(135deg, #11998e, #38ef7d); color: white; }
    .summary-card.failed { background: linear-gradient(135deg, #eb3349, #f45c43); color: white; }
    .summary-card.warning { background: linear-gradient(135deg, #f093fb, #f5576c); color: white; }
    .summary-card.total { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
    .summary-card .number { font-size: 36px; font-weight: bold; }
    .summary-card .label { font-size: 14px; opacity: 0.9; }
    h2 { color: #1a1a2e; font-size: 20px; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 2px solid #e94560; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; color: #333; }
    tr:hover { background: #f8f9fa; }
    .result-error { color: #dc3545; font-weight: 600; }
    .result-warning { color: #ffc107; font-weight: 600; }
    .result-success { color: #28a745; font-weight: 600; }
    .barrier-item { display: inline-block; padding: 6px 12px; background: #e9ecef; border-radius: 4px; margin: 4px; font-size: 13px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${report.title}</h1>
    <p class="subtitle">生成时间: ${report.generatedAt}</p>
    
    <div class="summary">
      <div class="summary-card total">
        <div class="number">${report.summary.totalChecks}</div>
        <div class="label">总检查项</div>
      </div>
      <div class="summary-card failed">
        <div class="number">${report.summary.errors}</div>
        <div class="label">严重错误</div>
      </div>
      <div class="summary-card warning">
        <div class="number">${report.summary.warnings}</div>
        <div class="label">警告</div>
      </div>
      <div class="summary-card ${report.summary.passed ? 'passed' : 'failed'}">
        <div class="number">${report.summary.status}</div>
        <div class="label">整体结果</div>
      </div>
    </div>

    <h2>📊 统计信息</h2>
    <table>
      <thead>
        <tr>
          <th>楼层</th>
          <th>消防门数量</th>
          <th>扶梯数量</th>
          <th>围挡数量</th>
        </tr>
      </thead>
      <tbody>
        ${report.statistics.floorStats.map(s => `
          <tr>
            <td><strong>${s.floor}</strong></td>
            <td>${s.fireDoors}</td>
            <td>${s.escalators}</td>
            <td>${s.barriers}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>🚧 围挡布置</h2>
    <div>
      ${report.barriers.length === 0 ? '<p style="color: #999;">暂无围挡</p>' : 
        report.barriers.map(b => `
          <span class="barrier-item">
            <strong>${b.name}</strong> (${b.floor}) 
            位置: (${b.position.x}, ${b.position.z}) 
            尺寸: ${b.size.width}×${b.size.depth}
          </span>
        `).join('')
      }
    </div>

    <h2>✅ 校验结果详情</h2>
    <table>
      <thead>
        <tr>
          <th>类型</th>
          <th>分类</th>
          <th>消息</th>
          <th>详情</th>
        </tr>
      </thead>
      <tbody>
        ${report.validationResults.map(r => `
          <tr>
            <td class="result-${r.type}">
              ${r.type === 'error' ? '❌ 错误' : r.type === 'warning' ? '⚠️ 警告' : '✅ 通过'}
            </td>
            <td>${r.category}</td>
            <td>${r.message}</td>
            <td>${r.details || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="footer">
      <p>扶梯检修围挡预演系统 | 本报告由系统自动生成</p>
    </div>
  </div>
</body>
</html>
    `;

    return html;
  }

  exportToJSON() {
    const report = this.generateReport();
    return JSON.stringify(report, null, 2);
  }

  downloadHTML() {
    const html = this.exportToHTML();
    this.downloadFile(html, 'escalator-maintenance-report.html', 'text/html');
  }

  downloadJSON() {
    const json = this.exportToJSON();
    this.downloadFile(json, 'escalator-maintenance-report.json', 'application/json');
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
