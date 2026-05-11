const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const DataStore = require('../stores/DataStore');

function generateReport(options) {
  const store = new DataStore(options.dataDir || './data');
  const toilets = store.getAllToilets();
  const complaints = store.getAllComplaints();
  const route = store.generateCleaningRoute();
  const invalidToilets = store.getToiletsWithErrors();
  const warnings = store.getToiletsWithWarnings();
  const duplicates = store.getDuplicates();

  const outputDir = options.output || './reports';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date();
  const dateStr = timestamp.toISOString().slice(0, 10);
  const timeStr = timestamp.toLocaleString('zh-CN');

  const reportData = {
    generatedAt: timestamp.toISOString(),
    summary: {
      totalToilets: toilets.length,
      validToilets: toilets.length - invalidToilets.length,
      invalidToilets: invalidToilets.length,
      totalComplaints: complaints.length,
      activeComplaints: complaints.filter(c => c.status === '待处理' || c.status === '处理中').length,
      duplicates: duplicates.length,
      warnings: warnings.length,
      criticalPriority: route.statistics.critical,
      highPriority: route.statistics.high,
      normalPriority: route.statistics.normal
    },
    route: route,
    anomalies: {
      invalid: invalidToilets,
      warnings: warnings,
      duplicates: duplicates
    },
    topIssues: getTopIssues(store)
  };

  const jsonPath = path.join(outputDir, `toilet-report-${dateStr}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2), 'utf8');

  const htmlPath = path.join(outputDir, `toilet-report-${dateStr}.html`);
  const htmlContent = generateHtmlReport(reportData, timeStr);
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');

  console.log(chalk.bold.green('\n┌─────────────────────────────────────────────┐'));
  console.log(chalk.bold.green('│              业务报告生成完成                │'));
  console.log(chalk.bold.green('└─────────────────────────────────────────────┘\n'));

  console.log(chalk.bold('📄 报告文件:'));
  console.log(chalk.white(`  JSON格式: ${jsonPath}`));
  console.log(chalk.white(`  HTML格式: ${htmlPath}`));

  console.log('\n' + chalk.bold('📊 报告摘要:'));
  const summary = reportData.summary;
  console.log(chalk.cyan(`  公厕总数: ${summary.totalToilets} (有效: ${summary.validToilets}, 无效: ${summary.invalidToilets})`));
  console.log(chalk.cyan(`  投诉总数: ${summary.totalComplaints} (待处理: ${summary.activeComplaints})`));
  console.log(chalk.red(`  紧急优先级: ${summary.criticalPriority}`));
  console.log(chalk.yellow(`  高优先级: ${summary.highPriority}`));
  console.log(chalk.green(`  正常优先级: ${summary.normalPriority}`));
  
  if (summary.duplicates > 0) {
    console.log(chalk.magenta(`  重复数据: ${summary.duplicates}`));
  }
  if (summary.warnings > 0) {
    console.log(chalk.yellow(`  业务预警: ${summary.warnings}`));
  }

  console.log('\n' + chalk.gray('💡 HTML报告可用浏览器打开查看，包含详细路线规划和异常分析'));
}

function getTopIssues(store) {
  const toilets = store.getAllToilets();
  const complaints = store.getAllComplaints();

  const toiletComplaintMap = {};
  complaints.forEach(c => {
    if (!toiletComplaintMap[c.toiletId]) {
      toiletComplaintMap[c.toiletId] = [];
    }
    toiletComplaintMap[c.toiletId].push(c);
  });

  const toiletsWithIssues = toilets
    .filter(t => t.isValid)
    .map(t => ({
      id: t.id,
      name: t.name,
      district: t.district,
      flowWeight: t.flowWeight,
      complaintCount: (toiletComplaintMap[t.id] || []).filter(c => c.status === '待处理' || c.status === '处理中').length,
      supplyStock: t.supplyStock,
      priorityScore: t.priorityScore,
      priorityLevel: t.priorityLevel,
      warnings: t.warnings || []
    }))
    .filter(t => t.complaintCount > 0 || t.flowWeight >= 7 || t.supplyStock < 10 || t.warnings.length > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 10);

  const complaintTypeStats = {};
  complaints.forEach(c => {
    if (!complaintTypeStats[c.complaintType]) {
      complaintTypeStats[c.complaintType] = { total: 0, pending: 0 };
    }
    complaintTypeStats[c.complaintType].total++;
    if (c.status === '待处理' || c.status === '处理中') {
      complaintTypeStats[c.complaintType].pending++;
    }
  });

  return {
    topToilets: toiletsWithIssues,
    complaintTypes: Object.entries(complaintTypeStats)
      .map(([type, stats]) => ({ type, ...stats }))
      .sort((a, b) => b.pending - a.pending)
  };
}

function generateHtmlReport(data, timeStr) {
  const { summary, route, anomalies, topIssues } = data;

  const getPriorityBadge = (level) => {
    const colors = {
      critical: 'background-color: #dc3545; color: white;',
      high: 'background-color: #ffc107; color: black;',
      normal: 'background-color: #28a745; color: white;',
      invalid: 'background-color: #6c757d; color: white;'
    };
    return `<span style="padding: 2px 8px; border-radius: 4px; font-size: 12px; ${colors[level] || colors.invalid}">${level}</span>`;
  };

  const priorityColor = {
    critical: '#dc3545',
    high: '#ffc107',
    normal: '#28a745'
  };

  const routeByDistrict = Object.entries(route.byDistrict || {});

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>城市公厕保洁路线分析报告 - ${timeStr}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f6f8; color: #333; line-height: 1.6; padding: 20px; }
    .container { max-width: 1400px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header .subtitle { opacity: 0.9; font-size: 14px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .summary-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .summary-card .label { font-size: 13px; color: #666; margin-bottom: 5px; }
    .summary-card .value { font-size: 28px; font-weight: bold; color: #1e3c72; }
    .summary-card.critical .value { color: #dc3545; }
    .summary-card.high .value { color: #ffc107; }
    .summary-card.warning .value { color: #fd7e14; }
    .summary-card.danger .value { color: #dc3545; }
    .section { background: white; border-radius: 12px; padding: 25px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .section h2 { font-size: 18px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e9ecef; color: #1e3c72; }
    .section h3 { font-size: 15px; margin: 15px 0 10px; color: #495057; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 12px 10px; text-align: left; border-bottom: 1px solid #e9ecef; }
    th { background: #f8f9fa; font-weight: 600; color: #495057; }
    tr:hover { background: #f8f9fa; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
    .badge-critical { background: #f8d7da; color: #721c24; }
    .badge-high { background: #fff3cd; color: #856404; }
    .badge-normal { background: #d4edda; color: #155724; }
    .badge-warning { background: #ffe5d0; color: #c2410c; }
    .badge-danger { background: #f8d7da; color: #721c24; }
    .alert { padding: 15px; border-radius: 8px; margin-bottom: 15px; }
    .alert-warning { background: #fff3cd; border-left: 4px solid #ffc107; }
    .alert-danger { background: #f8d7da; border-left: 4px solid #dc3545; }
    .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 768px) { .two-column { grid-template-columns: 1fr; } }
    .district-card { border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; margin-bottom: 10px; }
    .district-name { font-weight: 600; color: #1e3c72; margin-bottom: 10px; font-size: 14px; }
    .route-summary { display: flex; gap: 15px; flex-wrap: wrap; }
    .route-item { padding: 8px 12px; border-radius: 6px; font-size: 12px; }
    .tag-list { display: flex; flex-wrap: wrap; gap: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚻 城市公厕保洁路线分析报告</h1>
      <div class="subtitle">生成时间: ${timeStr} | 数据来源: 公厕点位 + 投诉系统 + 补给库存</div>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">公厕总数</div>
        <div class="value">${summary.totalToilets}</div>
      </div>
      <div class="summary-card">
        <div class="label">有效数据</div>
        <div class="value">${summary.validToilets}</div>
      </div>
      <div class="summary-card danger">
        <div class="label">无效数据</div>
        <div class="value">${summary.invalidToilets}</div>
      </div>
      <div class="summary-card">
        <div class="label">投诉总数</div>
        <div class="value">${summary.totalComplaints}</div>
      </div>
      <div class="summary-card warning">
        <div class="label">待处理投诉</div>
        <div class="value">${summary.activeComplaints}</div>
      </div>
      <div class="summary-card critical">
        <div class="label">⚠️ 紧急优先级</div>
        <div class="value">${summary.criticalPriority}</div>
      </div>
      <div class="summary-card high">
        <div class="label">高优先级</div>
        <div class="value">${summary.highPriority}</div>
      </div>
      <div class="summary-card">
        <div class="label">正常优先级</div>
        <div class="value">${summary.normalPriority}</div>
      </div>
    </div>

    ${(anomalies.invalid.length > 0 || anomalies.duplicates.length > 0 || anomalies.warnings.length > 0) ? `
    <div class="section">
      <h2>⚠️ 异常数据汇总</h2>
      ${anomalies.invalid.length > 0 ? `
      <div class="alert alert-danger">
        <strong>无效数据: ${anomalies.invalid.length} 条</strong><br>
        这些公厕存在字段缺失或格式错误，需要人工修正后才能纳入路线规划。
      </div>` : ''}
      ${anomalies.duplicates.length > 0 ? `
      <div class="alert alert-warning">
        <strong>重复数据: ${anomalies.duplicates.length} 条</strong><br>
        同一公厕被多次导入，请检查数据源是否存在重复导出问题。
      </div>` : ''}
      ${anomalies.warnings.length > 0 ? `
      <div class="alert alert-warning">
        <strong>业务预警: ${anomalies.warnings.length} 条</strong><br>
        包含超时未清洁、库存不足、投诉过多等业务风险点。
      </div>` : ''}
    </div>` : ''}

    <div class="section">
      <h2>🔥 重点关注公厕 (Top 10)</h2>
      <table>
        <thead>
          <tr>
            <th>优先级</th>
            <th>编号</th>
            <th>名称</th>
            <th>行政区</th>
            <th>人流权重</th>
            <th>待处理投诉</th>
            <th>补给库存</th>
            <th>优先级分数</th>
            <th>预警</th>
          </tr>
        </thead>
        <tbody>
          ${topIssues.topToilets.map(t => `
          <tr>
            <td>${getPriorityBadge(t.priorityLevel)}</td>
            <td><strong>${t.id}</strong></td>
            <td>${t.name}</td>
            <td>${t.district}</td>
            <td style="color: ${t.flowWeight >= 7 ? '#dc3545' : t.flowWeight >= 4 ? '#ffc107' : '#28a745'}">${t.flowWeight}</td>
            <td style="color: ${t.complaintCount >= 3 ? '#dc3545' : '#333'}">${t.complaintCount}</td>
            <td style="color: ${t.supplyStock < 10 ? '#fd7e14' : '#333'}">${t.supplyStock}</td>
            <td><strong>${t.priorityScore}</strong></td>
            <td>
              <div class="tag-list">
                ${t.warnings.map(w => `<span class="badge badge-warning">${w.type}</span>`).join('')}
                ${t.complaintCount >= 3 ? '<span class="badge badge-danger">高投诉</span>' : ''}
                ${t.flowWeight >= 7 ? '<span class="badge badge-critical">高人流</span>' : ''}
                ${t.supplyStock < 10 ? '<span class="badge badge-warning">低库存</span>' : ''}
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div class="two-column">
      <div class="section">
        <h2>📋 保洁路线规划</h2>
        <h3>第一优先级: 紧急处理 (建议 2 小时内)</h3>
        ${route.critical.length > 0 ? `
        <table>
          <thead>
            <tr><th>序号</th><th>编号</th><th>名称</th><th>行政区</th><th>分数</th></tr>
          </thead>
          <tbody>
            ${route.critical.map((t, i) => `
            <tr><td>${i + 1}</td><td><strong>${t.id}</strong></td><td>${t.name}</td><td>${t.district}</td><td style="color: #dc3545"><strong>${t.priorityScore}</strong></td></tr>`).join('')}
          </tbody>
        </table>` : '<p style="color: #666">暂无紧急处理公厕</p>'}

        <h3>第二优先级: 优先处理 (建议 4 小时内)</h3>
        ${route.high.length > 0 ? `
        <table>
          <thead>
            <tr><th>序号</th><th>编号</th><th>名称</th><th>行政区</th><th>分数</th></tr>
          </thead>
          <tbody>
            ${route.high.map((t, i) => `
            <tr><td>${i + 1}</td><td><strong>${t.id}</strong></td><td>${t.name}</td><td>${t.district}</td><td style="color: #ffc107"><strong>${t.priorityScore}</strong></td></tr>`).join('')}
          </tbody>
        </table>` : '<p style="color: #666">暂无优先处理公厕</p>'}

        <h3>第三优先级: 常规保洁</h3>
        ${route.normal.length > 0 ? `
        <table>
          <thead>
            <tr><th>序号</th><th>编号</th><th>名称</th><th>行政区</th><th>分数</th></tr>
          </thead>
          <tbody>
            ${route.normal.map((t, i) => `
            <tr><td>${i + 1}</td><td><strong>${t.id}</strong></td><td>${t.name}</td><td>${t.district}</td><td>${t.priorityScore}</td></tr>`).join('')}
          </tbody>
        </table>` : '<p style="color: #666">暂无常规保洁公厕</p>'}
      </div>

      <div class="section">
        <h2>📍 按行政区路线</h2>
        ${routeByDistrict.length > 0 ? routeByDistrict.map(([district, data]) => {
          const total = data.critical.length + data.high.length + data.normal.length;
          return `
          <div class="district-card">
            <div class="district-name">${district} (${total} 个公厕)</div>
            <div class="route-summary">
              ${data.critical.length > 0 ? `<div class="route-item" style="background: #f8d7da"><strong>紧急:</strong> ${data.critical.map(t => t.id).join(', ')}</div>` : ''}
              ${data.high.length > 0 ? `<div class="route-item" style="background: #fff3cd"><strong>优先:</strong> ${data.high.map(t => t.id).join(', ')}</div>` : ''}
              ${data.normal.length > 0 ? `<div class="route-item" style="background: #d4edda"><strong>常规:</strong> ${data.normal.map(t => t.id).join(', ')}</div>` : ''}
            </div>
          </div>`;
        }).join('') : '<p style="color: #666">暂无行政区数据</p>'}

        <h2 style="margin-top: 25px">📊 投诉类型统计</h2>
        <table>
          <thead>
            <tr><th>投诉类型</th><th>总数</th><th>待处理</th><th>占比</th></tr>
          </thead>
          <tbody>
            ${topIssues.complaintTypes.length > 0 ? topIssues.complaintTypes.map(ct => {
              const pendingRatio = summary.activeComplaints > 0 ? ((ct.pending / summary.activeComplaints) * 100).toFixed(1) : 0;
              return `<tr><td>${ct.type}</td><td>${ct.total}</td><td style="color: ${ct.pending > 0 ? '#dc3545' : '#28a745'}">${ct.pending}</td><td>${pendingRatio}%</td></tr>`;
            }).join('') : '<tr><td colspan="4" style="color: #666">暂无投诉数据</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    ${anomalies.invalid.length > 0 ? `
    <div class="section">
      <h2>❌ 无效数据详情</h2>
      <table>
        <thead>
          <tr><th>编号</th><th>名称</th><th>错误类型</th><th>错误详情</th></tr>
        </thead>
        <tbody>
          ${anomalies.invalid.map(t => `
          <tr>
            <td>${t.id || 'N/A'}</td>
            <td>${t.name || '未命名'}</td>
            <td>${t.errors.map(e => `<span class="badge badge-danger">${e.type}</span>`).join(' ')}</td>
            <td>${t.errors.map(e => e.message).join('<br>')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    ${anomalies.warnings.length > 0 ? `
    <div class="section">
      <h2>⚠️ 业务预警详情</h2>
      <table>
        <thead>
          <tr><th>编号</th><th>名称</th><th>预警类型</th><th>预警详情</th></tr>
        </thead>
        <tbody>
          ${anomalies.warnings.map(t => `
          <tr>
            <td><strong>${t.id}</strong></td>
            <td>${t.name}</td>
            <td>${t.warnings.map(w => `<span class="badge badge-warning">${w.type}</span>`).join(' ')}</td>
            <td>${t.warnings.map(w => w.message).join('<br>')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    ${anomalies.duplicates.length > 0 ? `
    <div class="section">
      <h2>🔄 重复数据详情</h2>
      <table>
        <thead>
          <tr><th>数据类型</th><th>ID</th><th>已有来源</th><th>新来源</th><th>发现时间</th></tr>
        </thead>
        <tbody>
          ${anomalies.duplicates.map(d => `
          <tr>
            <td>${d.type === 'toilet' ? '公厕点位' : '投诉数据'}</td>
            <td>${d.id}</td>
            <td>${d.existingSource}</td>
            <td>${d.newSource}</td>
            <td>${new Date(d.timestamp).toLocaleString('zh-CN')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    <div class="section" style="text-align: center; color: #666; font-size: 12px;">
      <p>本报告由城市公厕保洁路线 CLI 工具自动生成</p>
      <p>优先级计算规则: 人流权重×10 + 投诉数×8 + 库存预警分 + 超时清洁分</p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  generateReport
};
