const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');
const { RISK_LEVELS } = require('./auditor');

async function generateOutputs(auditResult, errors, outputDir) {
  await fs.mkdir(outputDir, { recursive: true });

  const summary = generateSummary(auditResult, errors);
  console.log('\n' + summary);
  await fs.writeFile(path.join(outputDir, 'summary.txt'), summary);

  const jsonOutput = {
    ...auditResult,
    errors,
    generatedAt: new Date().toISOString(),
  };
  await fs.writeFile(
    path.join(outputDir, 'results.json'),
    JSON.stringify(jsonOutput, null, 2)
  );

  if (errors.length > 0) {
    await fs.writeFile(
      path.join(outputDir, 'errors.json'),
      JSON.stringify(errors, null, 2)
    );
  }

  const htmlReport = generateHtmlReport(auditResult, errors);
  await fs.writeFile(path.join(outputDir, 'report.html'), htmlReport);

  console.log(chalk.green(`  ✓ summary.txt`));
  console.log(chalk.green(`  ✓ results.json`));
  console.log(chalk.green(`  ✓ report.html`));
  if (errors.length > 0) {
    console.log(chalk.yellow(`  ⚠ errors.json (${errors.length} 条错误)`));
  }
}

function generateSummary(auditResult, errors) {
  const lines = [];
  const { summary, statistics, highRiskSilences, noHitSilences } = auditResult;

  lines.push('══════════════════════════════════════════════════════════════');
  lines.push('                     告警静默审计摘要');
  lines.push('══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`审计时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  const statsTable = new Table({
    head: ['指标', '数值'],
    style: { head: ['cyan'] },
  });

  statsTable.push(['总规则数', summary.totalSilences]);
  statsTable.push(['活跃规则', statistics.active]);
  statsTable.push(['已过期', chalk.red(statistics.expired)]);
  statsTable.push(['待生效', statistics.pending]);
  statsTable.push(['高风险规则', chalk.red(summary.highRiskCount)]);
  statsTable.push(['未命中告警', chalk.yellow(summary.noHitCount)]);
  statsTable.push(['错误记录', errors.length > 0 ? chalk.red(errors.length) : 0]);

  lines.push(statsTable.toString());
  lines.push('');

  lines.push('风险等级分布:');
  const riskTable = new Table({
    head: ['等级', '数量', '说明'],
    style: { head: ['cyan'] },
  });

  Object.entries(RISK_LEVELS).forEach(([key, info]) => {
    const count = statistics.byRiskLevel[key] || 0;
    const colorFn = chalk[info.color] || chalk.white;
    riskTable.push([colorFn(info.name), count, info.description]);
  });

  lines.push(riskTable.toString());
  lines.push('');

  if (statistics.topCreators.length > 0) {
    lines.push('创建人 TOP 10:');
    const creatorTable = new Table({
      head: ['创建人', '规则数'],
      style: { head: ['cyan'] },
    });
    statistics.topCreators.forEach(c => creatorTable.push([c.name, c.count]));
    lines.push(creatorTable.toString());
    lines.push('');
  }

  if (highRiskSilences.length > 0) {
    lines.push(chalk.red.bold('⚠ 高风险规则列表:'));
    const riskListTable = new Table({
      head: ['ID', '风险', '创建人', '剩余天数', '问题'],
      style: { head: ['red'] },
      colWidths: [15, 8, 15, 10, 40],
    });

    highRiskSilences.slice(0, 10).forEach(s => {
      const colorFn = chalk[RISK_LEVELS[s.riskLevel].color] || chalk.white;
      const issues = s.issues.map(i => i.message).join(', ');
      riskListTable.push([
        s.id.substring(0, 12),
        colorFn(s.riskLevelInfo.name),
        s.createdBy,
        s.timeAnalysis.daysRemaining ?? '-',
        issues.substring(0, 38),
      ]);
    });

    lines.push(riskListTable.toString());
    if (highRiskSilences.length > 10) {
      lines.push(chalk.gray(`  ... 还有 ${highRiskSilences.length - 10} 条高风险规则`));
    }
    lines.push('');
  }

  if (errors.length > 0) {
    lines.push(chalk.red.bold('⚠ 错误记录摘要:'));
    const errorTable = new Table({
      head: ['类型', '数量'],
      style: { head: ['red'] },
    });

    const errorTypes = {};
    errors.forEach(e => {
      errorTypes[e.type] = (errorTypes[e.type] || 0) + 1;
    });

    Object.entries(errorTypes).forEach(([type, count]) => {
      errorTable.push([type, count]);
    });

    lines.push(errorTable.toString());
    lines.push('');
    lines.push(chalk.gray('详细错误信息请查看 errors.json 文件'));
  }

  lines.push('');
  lines.push('══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

function generateHtmlReport(auditResult, errors) {
  const { summary, statistics, silences, highRiskSilences, noHitSilences } = auditResult;

  const riskLevelColors = {
    CRITICAL: '#dc3545',
    HIGH: '#fd7e14',
    MEDIUM: '#ffc107',
    LOW: '#28a745',
  };

  const riskBgColors = {
    CRITICAL: '#f8d7da',
    HIGH: '#ffe5d0',
    MEDIUM: '#fff3cd',
    LOW: '#d4edda',
  };

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>告警静默审计报告</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f7fa; color: #333; line-height: 1.6; }
.container { max-width: 1200px; margin: 0 auto; padding: 20px; }
.header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
.header h1 { font-size: 28px; margin-bottom: 10px; }
.header .time { opacity: 0.9; }
.card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.card h2 { font-size: 20px; margin-bottom: 20px; color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
.stat-card { background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; }
.stat-card .value { font-size: 36px; font-weight: bold; color: #4a5568; }
.stat-card .label { color: #718096; font-size: 14px; }
.stat-card.critical .value { color: #dc3545; }
.stat-card.warning .value { color: #fd7e14; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
th { background: #f8fafc; font-weight: 600; color: #4a5568; }
tr:hover { background: #f8fafc; }
.badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
.risk-critical { background: ${riskBgColors.CRITICAL}; color: ${riskLevelColors.CRITICAL}; }
.risk-high { background: ${riskBgColors.HIGH}; color: ${riskLevelColors.HIGH}; }
.risk-medium { background: ${riskBgColors.MEDIUM}; color: ${riskLevelColors.MEDIUM}; }
.risk-low { background: ${riskBgColors.LOW}; color: ${riskLevelColors.LOW}; }
.issue-tag { display: inline-block; padding: 2px 8px; margin: 2px; background: #fee2e2; color: #dc2626; border-radius: 4px; font-size: 12px; }
.matchers { font-family: monospace; font-size: 12px; color: #666; }
.tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; }
.tab { padding: 10px 20px; cursor: pointer; border-bottom: 2px solid transparent; color: #718096; }
.tab.active { border-bottom-color: #667eea; color: #667eea; font-weight: 600; }
.tab-content { display: none; }
.tab-content.active { display: block; }
.error-alert { background: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 4px; margin-bottom: 20px; }
</style>
</head>
<body>
<div class="container">
<div class="header">
<h1>🔔 告警静默规则审计报告</h1>
<div class="time">生成时间: ${new Date().toLocaleString('zh-CN')}</div>
</div>

${errors.length > 0 ? `
<div class="error-alert">
<strong>⚠ 处理过程中发现 ${errors.length} 条错误记录</strong><br>
详细错误信息请查看导出的 errors.json 文件
</div>
` : ''}

<div class="card">
<h2>📊 审计概览</h2>
<div class="stats-grid">
<div class="stat-card"><div class="value">${summary.totalSilences}</div><div class="label">总规则数</div></div>
<div class="stat-card"><div class="value">${statistics.active}</div><div class="label">活跃规则</div></div>
<div class="stat-card critical"><div class="value">${summary.highRiskCount}</div><div class="label">高风险规则</div></div>
<div class="stat-card warning"><div class="value">${statistics.expired}</div><div class="label">已过期</div></div>
<div class="stat-card"><div class="value">${summary.noHitCount}</div><div class="label">未命中告警</div></div>
</div>
</div>

<div class="card">
<h2>🎯 风险等级分布</h2>
<table>
<thead><tr><th>风险等级</th><th>数量</th><th>说明</th></tr></thead>
<tbody>
${Object.entries(RISK_LEVELS).map(([key, info]) => `
<tr>
<td><span class="badge risk-${key.toLowerCase()}">${info.name}</span></td>
<td>${statistics.byRiskLevel[key] || 0}</td>
<td>${info.description}</td>
</tr>
`).join('')}
</tbody>
</table>
</div>

<div class="card">
<h2>⚠ 高风险规则详情</h2>
${highRiskSilences.length === 0 ? '<p>没有发现高风险规则 👍</p>' : `
<table>
<thead><tr><th>ID</th><th>风险</th><th>创建人</th><th>状态</th><th>剩余天数</th><th>匹配器</th><th>问题</th></tr></thead>
<tbody>
${highRiskSilences.map(s => `
<tr style="background: ${riskBgColors[s.riskLevel]}30">
<td><code>${s.id.substring(0, 12)}</code></td>
<td><span class="badge risk-${s.riskLevel.toLowerCase()}">${s.riskLevelInfo.name}</span></td>
<td>${s.createdBy}</td>
<td>${s.status.state}</td>
<td>${s.timeAnalysis.daysRemaining ?? '-'}</td>
<td class="matchers">${s.matchers.map(m => `${m.name}=${m.value}`).join(', ')}</td>
<td>${s.issues.map(i => `<span class="issue-tag">${i.message}</span>`).join('')}</td>
</tr>
`).join('')}
</tbody>
</table>
`}
</div>

<div class="card">
<h2>📋 所有规则</h2>
<div class="tabs">
<div class="tab active" onclick="showTab('all')">全部 (${silences.length})</div>
<div class="tab" onclick="showTab('active')">活跃 (${silences.filter(s => s.status.state === 'active').length})</div>
<div class="tab" onclick="showTab('expired')">已过期 (${silences.filter(s => s.status.state === 'expired').length})</div>
<div class="tab" onclick="showTab('nohit')">未命中 (${noHitSilences.length})</div>
</div>
<div id="tab-all" class="tab-content active">
<table>
<thead><tr><th>ID</th><th>风险</th><th>创建人</th><th>状态</th><th>剩余天数</th><th>备注</th></tr></thead>
<tbody>
${silences.map(s => `
<tr>
<td><code>${s.id.substring(0, 12)}</code></td>
<td><span class="badge risk-${s.riskLevel.toLowerCase()}">${s.riskLevelInfo.name}</span></td>
<td>${s.createdBy}</td>
<td>${s.status.state}</td>
<td>${s.timeAnalysis.daysRemaining ?? '-'}</td>
<td>${s.comment || '-'}</td>
</tr>
`).join('')}
</tbody>
</table>
</div>
<div id="tab-active" class="tab-content"></div>
<div id="tab-expired" class="tab-content"></div>
<div id="tab-nohit" class="tab-content"></div>
</div>
</div>
<script>
function showTab(tabName) {
document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
event.target.classList.add('active');
document.getElementById('tab-' + tabName).classList.add('active');
}
</script>
</body>
</html>`;
}

module.exports = {
  generateOutputs,
};
