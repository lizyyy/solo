const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');

function generateTextReport(aggregatedResult, options = {}) {
  const { title = '指标配置仓库口径变更影响分析报告' } = options;
  const lines = [];

  lines.push('='.repeat(60));
  lines.push(title);
  lines.push('='.repeat(60));
  lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  lines.push('【一、总体概览】');
  lines.push('-'.repeat(40));
  lines.push(`分析文件数: ${aggregatedResult.summary.totalFiles}`);
  lines.push(`指标总数: ${aggregatedResult.summary.totalMetrics}`);
  lines.push(`有效指标数: ${aggregatedResult.summary.validMetrics}`);
  lines.push(`受影响指标数: ${aggregatedResult.summary.affectedMetrics}`);
  lines.push(`高影响指标数: ${aggregatedResult.summary.highImpactMetrics}`);
  lines.push('');

  lines.push('【二、影响看板列表】');
  lines.push('-'.repeat(40));
  if (aggregatedResult.dashboardList.length > 0) {
    for (let i = 0; i < aggregatedResult.dashboardList.length; i++) {
      const dash = aggregatedResult.dashboardList[i];
      lines.push(`${i + 1}. ${dash.dashboardName}`);
      lines.push(`   高影响指标: ${dash.highImpactCount} 个`);
      lines.push(`   总影响指标: ${dash.totalImpactCount} 个`);
      lines.push(`   涉及部门: ${dash.departments.join(', ') || '无'}`);
      lines.push(`   业务域: ${dash.businessDomains.join(', ') || '无'}`);
      lines.push(`   受影响指标:`);
      for (const metric of dash.affectedMetrics.slice(0, 5)) {
        lines.push(`     - [${metric.impactLevel}] ${metric.metricName} (${metric.metricId})`);
        lines.push(`       ${metric.impactDescription}`);
      }
      if (dash.affectedMetrics.length > 5) {
        lines.push(`     ... 还有 ${dash.affectedMetrics.length - 5} 个指标`);
      }
      lines.push('');
    }
  } else {
    lines.push('暂无受影响的看板');
    lines.push('');
  }

  lines.push('【三、按影响级别分布】');
  lines.push('-'.repeat(40));
  lines.push(`高影响 (${aggregatedResult.byImpactLevel.summary.highCount}):`);
  for (const m of aggregatedResult.byImpactLevel.high.slice(0, 3)) {
    lines.push(`  - ${m.metricName} (${m.metricId}) - ${m.sourceFile}`);
  }
  lines.push(`中影响 (${aggregatedResult.byImpactLevel.summary.mediumCount})`);
  lines.push(`低影响 (${aggregatedResult.byImpactLevel.summary.lowCount})`);
  lines.push('');

  lines.push('【四、异常报告】');
  lines.push('-'.repeat(40));
  if (aggregatedResult.exceptions.length > 0) {
    const groupedExceptions = {};
    for (const ex of aggregatedResult.exceptions) {
      if (!groupedExceptions[ex.type]) {
        groupedExceptions[ex.type] = [];
      }
      groupedExceptions[ex.type].push(ex);
    }

    for (const [type, exs] of Object.entries(groupedExceptions)) {
      lines.push(`${type} (${exs.length} 项):`);
      for (const ex of exs.slice(0, 5)) {
        lines.push(`  - [${ex.source}] ${ex.message}`);
        if (ex.lineNumber) lines.push(`    行号: ${ex.lineNumber}`);
        lines.push(`    建议: ${ex.recommendation}`);
      }
      if (exs.length > 5) {
        lines.push(`  ... 还有 ${exs.length - 5} 项`);
      }
      lines.push('');
    }
  } else {
    lines.push('无异常');
    lines.push('');
  }

  lines.push('【五、按文件分析】');
  lines.push('-'.repeat(40));
  for (const file of aggregatedResult.bySourceFile) {
    lines.push(`${file.fileName}:`);
    lines.push(`  总指标: ${file.totalMetrics}, 有效: ${file.validMetrics}, 受影响: ${file.affectedMetrics}`);
    if (file.fileErrors.length > 0) {
      lines.push(`  文件错误: ${file.fileErrors.length} 个`);
    }
    if (file.fileWarnings.length > 0) {
      lines.push(`  文件警告: ${file.fileWarnings.length} 个`);
    }
    lines.push('');
  }

  lines.push('='.repeat(60));
  lines.push('报告结束');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

function generateJSONReport(aggregatedResult) {
  return JSON.stringify(aggregatedResult, null, 2);
}

function generateDashboardCSV(aggregatedResult, outputPath) {
  const dashboardData = aggregatedResult.dashboardList.map(dash => ({
    看板名称: dash.dashboardName,
    高影响指标数: dash.highImpactCount,
    总影响指标数: dash.totalImpactCount,
    涉及部门: dash.departments.join(', '),
    业务域: dash.businessDomains.join(', '),
    受影响指标列表: dash.affectedMetrics.map(m => `${m.metricName}(${m.metricId})`).join('; ')
  }));

  if (dashboardData.length > 0) {
    const parser = new Parser({ fields: Object.keys(dashboardData[0]) });
    const csv = parser.parse(dashboardData);
    fs.writeFileSync(outputPath, csv, 'utf-8');
  }
  return dashboardData.length;
}

function generateExceptionCSV(aggregatedResult, outputPath) {
  if (aggregatedResult.exceptions.length > 0) {
    const parser = new Parser({
      fields: ['type', 'source', 'metricId', 'metricName', 'lineNumber', 'message', 'recommendation']
    });
    const csv = parser.parse(aggregatedResult.exceptions);
    fs.writeFileSync(outputPath, csv, 'utf-8');
  }
  return aggregatedResult.exceptions.length;
}

function generateMetricsCSV(aggregatedResult, outputPath) {
  const metricsData = aggregatedResult.byImpactLevel.high.concat(
    aggregatedResult.byImpactLevel.medium,
    aggregatedResult.byImpactLevel.low
  ).map(m => ({
    指标ID: m.metricId,
    指标名称: m.metricName,
    影响级别: m.impacts.length > 0 ? (m.impacts[0].level || '低') : '低',
    来源文件: m.sourceFile,
    负责人: m.owner,
    部门: m.department,
    业务域: m.businessDomain,
    影响描述: m.impacts.map(i => i.description).join('; ')
  }));

  if (metricsData.length > 0) {
    const parser = new Parser({ fields: Object.keys(metricsData[0]) });
    const csv = parser.parse(metricsData);
    fs.writeFileSync(outputPath, csv, 'utf-8');
  }
  return metricsData.length;
}

function generateAllReports(aggregatedResult, outputDir, baseName = 'impact_report') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const reports = {};

  const textReportPath = path.join(outputDir, `${baseName}.txt`);
  fs.writeFileSync(textReportPath, generateTextReport(aggregatedResult), 'utf-8');
  reports.text = textReportPath;

  const jsonReportPath = path.join(outputDir, `${baseName}.json`);
  fs.writeFileSync(jsonReportPath, generateJSONReport(aggregatedResult), 'utf-8');
  reports.json = jsonReportPath;

  const dashboardPath = path.join(outputDir, `${baseName}_dashboards.csv`);
  reports.dashboardCount = generateDashboardCSV(aggregatedResult, dashboardPath);
  reports.dashboard = dashboardPath;

  const exceptionPath = path.join(outputDir, `${baseName}_exceptions.csv`);
  reports.exceptionCount = generateExceptionCSV(aggregatedResult, exceptionPath);
  reports.exceptions = exceptionPath;

  const metricsPath = path.join(outputDir, `${baseName}_metrics.csv`);
  reports.metricsCount = generateMetricsCSV(aggregatedResult, metricsPath);
  reports.metrics = metricsPath;

  return reports;
}

function printConsoleSummary(aggregatedResult) {
  console.log('\n' + '='.repeat(60));
  console.log('指标配置仓库口径变更影响分析 - 结果摘要');
  console.log('='.repeat(60));
  console.log(`分析文件数: ${aggregatedResult.summary.totalFiles}`);
  console.log(`指标总数: ${aggregatedResult.summary.totalMetrics}`);
  console.log(`受影响指标数: ${aggregatedResult.summary.affectedMetrics}`);
  console.log(`高影响指标数: ${aggregatedResult.summary.highImpactMetrics}`);
  console.log(`影响看板数: ${aggregatedResult.dashboardList.length}`);
  console.log(`异常项数: ${aggregatedResult.exceptions.length}`);
  
  if (aggregatedResult.exceptions.length > 0) {
    console.log('\n【异常提示】');
    const aliasCount = aggregatedResult.exceptions.filter(e => e.type === 'METRIC_ALIAS').length;
    const snapshotCount = aggregatedResult.exceptions.filter(e => e.type === 'HISTORY_SNAPSHOT').length;
    const nestingCount = aggregatedResult.exceptions.filter(e => e.type === 'FORMULA_NESTING').length;
    if (aliasCount > 0) console.log(`  - 发现 ${aliasCount} 个指标别名，已继续处理`);
    if (snapshotCount > 0) console.log(`  - 发现 ${snapshotCount} 个历史快照配置，已继续处理`);
    if (nestingCount > 0) console.log(`  - 发现 ${nestingCount} 个公式嵌套过深，已继续处理`);
  }
  
  console.log('='.repeat(60) + '\n');
}

module.exports = {
  generateTextReport,
  generateJSONReport,
  generateDashboardCSV,
  generateExceptionCSV,
  generateMetricsCSV,
  generateAllReports,
  printConsoleSummary
};
