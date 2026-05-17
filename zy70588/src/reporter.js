const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');

function printTerminalSummary(aggregatedResults, options = {}) {
  const { summary, groups, anomalies, badLines } = aggregatedResults;
  const { confidenceLevel = 0.95 } = options;
  
  console.log('\n' + chalk.bold.cyan('='.repeat(70)));
  console.log(chalk.bold.cyan('                     日志采样还原分析报告'));
  console.log(chalk.bold.cyan('='.repeat(70)) + '\n');
  
  console.log(chalk.bold.yellow('📊 总体统计'));
  console.log(chalk.gray('-'.repeat(40)));
  
  const summaryTable = new Table({
    head: ['指标', '采样值', '估算值', '置信区间'],
    colWidths: [20, 15, 15, 25]
  });
  
  summaryTable.push(
    ['总行数', summary.totalLines, '-', '-'],
    ['有效行数', summary.validLines, summary.totalEstimatedCount, 
     `[${summary.overallConfidenceInterval.lowerBound}, ${summary.overallConfidenceInterval.upperBound}]`],
    ['错误行数', summary.totalSampleErrors, summary.totalEstimatedErrors,
     `[${summary.overallConfidenceInterval.lowerBound}, ${summary.overallConfidenceInterval.upperBound}]`],
    ['错误率', `${(summary.overallErrorRate * 100).toFixed(2)}%`, '-', '-'],
    ['采样率', `${(summary.sampleRate * 100).toFixed(1)}%`, '-', '-']
  );
  
  console.log(summaryTable.toString());
  console.log();
  
  if (badLines && badLines.length > 0) {
    console.log(chalk.bold.yellow('⚠️  异常行记录'));
    console.log(chalk.gray('-'.repeat(40)));
    console.log(`共 ${badLines.length} 条异常/坏行:\n`);
    
    const badTable = new Table({
      head: ['行号', '原因', '内容预览'],
      colWidths: [8, 12, 50]
    });
    
    for (const bad of badLines.slice(0, 10)) {
      badTable.push([
        bad.lineNumber,
        bad.reason,
        bad.content.substring(0, 45) + (bad.content.length > 45 ? '...' : '')
      ]);
    }
    
    console.log(badTable.toString());
    if (badLines.length > 10) {
      console.log(chalk.gray(`  ... 还有 ${badLines.length - 10} 条异常行已省略\n`));
    }
    console.log();
  }
  
  console.log(chalk.bold.yellow('📈 分组统计 (按错误量排序)'));
  console.log(chalk.gray('-'.repeat(60)));
  
  const groupHeaders = ['分组', '采样数', '采样错误', '估算错误', '置信区间', '错误率'];
  const groupTable = new Table({
    head: groupHeaders,
    colWidths: [20, 10, 12, 12, 22, 10]
  });
  
  for (const group of groups) {
    const groupName = Object.values(group.groups).join(' / ');
    const ci = group.errorConfidenceInterval;
    groupTable.push([
      groupName.substring(0, 18),
      group.sampleCount,
      group.sampleErrorCount,
      group.estimatedErrorCount,
      `[${ci.lowerBound}, ${ci.upperBound}]`,
      `${(group.estimatedErrorRate * 100).toFixed(1)}%`
    ]);
  }
  
  console.log(groupTable.toString());
  console.log();
  
  if (anomalies.length > 0) {
    console.log(chalk.bold.red('⚠️  异常样本警告'));
    console.log(chalk.gray('-'.repeat(40)));
    console.log('以下分组样本量可能影响估算准确性:\n');
    
    const anomalyTable = new Table({
      head: ['分组', '样本量', '置信度', '原因'],
      colWidths: [20, 10, 20, 25]
    });
    
    for (const anomaly of anomalies) {
      const groupName = Object.values(anomaly.groups).join(' / ');
      anomalyTable.push([
        groupName.substring(0, 18),
        anomaly.sampleCount,
        anomaly.zScore ? `z=${anomaly.zScore}` : '低样本',
        anomaly.reason.substring(0, 22)
      ]);
    }
    
    console.log(anomalyTable.toString());
    console.log();
  }
  
  console.log(chalk.bold.cyan('='.repeat(70)));
  console.log(chalk.gray(`置信水平: ${(confidenceLevel * 100).toFixed(0)}% | 生成时间: ${new Date().toLocaleString()}`));
  console.log(chalk.bold.cyan('='.repeat(70)) + '\n');
}

function saveJsonOutput(aggregatedResults, outputPath) {
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const jsonData = {
    generatedAt: new Date().toISOString(),
    summary: aggregatedResults.summary,
    groups: aggregatedResults.groups,
    anomalies: aggregatedResults.anomalies,
    badLines: aggregatedResults.badLines,
    metadata: {
      version: '1.0.0',
      confidenceLevel: 0.95
    }
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
  return outputPath;
}

function generateHtmlReport(aggregatedResults, outputPath) {
  const { summary, groups, anomalies, badLines } = aggregatedResults;
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const groupRows = groups.map((g, i) => {
    const groupName = Object.entries(g.groups).map(([k, v]) => `${k}=${v}`).join(', ');
    const ci = g.errorConfidenceInterval;
    return `
      <tr class="${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}">
        <td class="px-4 py-2 text-sm">${groupName}</td>
        <td class="px-4 py-2 text-sm text-center">${g.sampleCount}</td>
        <td class="px-4 py-2 text-sm text-center">${g.sampleErrorCount}</td>
        <td class="px-4 py-2 text-sm text-center font-semibold text-blue-600">${g.estimatedErrorCount}</td>
        <td class="px-4 py-2 text-sm text-center">[${ci.lowerBound}, ${ci.upperBound}]</td>
        <td class="px-4 py-2 text-sm text-center">${(g.estimatedErrorRate * 100).toFixed(1)}%</td>
      </tr>
    `;
  }).join('');
  
  const anomalyRows = anomalies.map((a, i) => {
    const groupName = Object.entries(a.groups).map(([k, v]) => `${k}=${v}`).join(', ');
    return `
      <tr class="${i % 2 === 0 ? 'bg-yellow-50' : 'bg-yellow-100'}">
        <td class="px-4 py-2 text-sm">${groupName}</td>
        <td class="px-4 py-2 text-sm text-center">${a.sampleCount}</td>
        <td class="px-4 py-2 text-sm text-center">${a.zScore || '-'}</td>
        <td class="px-4 py-2 text-sm text-red-600">${a.reason}</td>
      </tr>
    `;
  }).join('');
  
  const badLineRows = badLines.map((b, i) => `
    <tr class="${i % 2 === 0 ? 'bg-red-50' : 'bg-white'}">
      <td class="px-4 py-2 text-sm text-center font-mono">${b.lineNumber}</td>
      <td class="px-4 py-2 text-sm text-center">${b.reason}</td>
      <td class="px-4 py-2 text-sm font-mono text-gray-600">${b.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
    </tr>
  `).join('');
  
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>日志采样还原分析报告</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="max-w-6xl mx-auto py-8 px-4">
        <header class="text-center mb-8">
            <h1 class="text-3xl font-bold text-gray-800">📊 日志采样还原分析报告</h1>
            <p class="text-gray-500 mt-2">生成时间: ${new Date().toLocaleString()}</p>
        </header>
        
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 class="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">📋 总体统计</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-blue-50 rounded-lg p-4">
                    <div class="text-sm text-gray-500">采样总行数</div>
                    <div class="text-2xl font-bold text-blue-600">${summary.validLines}</div>
                </div>
                <div class="bg-red-50 rounded-lg p-4">
                    <div class="text-sm text-gray-500">采样错误数</div>
                    <div class="text-2xl font-bold text-red-600">${summary.totalSampleErrors}</div>
                </div>
                <div class="bg-green-50 rounded-lg p-4">
                    <div class="text-sm text-gray-500">估算错误数</div>
                    <div class="text-2xl font-bold text-green-600">${summary.totalEstimatedErrors}</div>
                </div>
                <div class="bg-purple-50 rounded-lg p-4">
                    <div class="text-sm text-gray-500">采样率</div>
                    <div class="text-2xl font-bold text-purple-600">${(summary.sampleRate * 100).toFixed(1)}%</div>
                </div>
            </div>
            <div class="mt-4 text-gray-600">
                <p><strong>置信区间 (95%):</strong> [${summary.overallConfidenceInterval.lowerBound}, ${summary.overallConfidenceInterval.upperBound}]</p>
                <p><strong>总体错误率:</strong> ${(summary.overallErrorRate * 100).toFixed(2)}%</p>
            </div>
        </div>
        
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 class="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">📈 分组统计</h2>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead>
                        <tr class="bg-gray-800 text-white">
                            <th class="px-4 py-2 text-left text-sm">分组</th>
                            <th class="px-4 py-2 text-center text-sm">样本数</th>
                            <th class="px-4 py-2 text-center text-sm">采样错误</th>
                            <th class="px-4 py-2 text-center text-sm">估算错误</th>
                            <th class="px-4 py-2 text-center text-sm">置信区间</th>
                            <th class="px-4 py-2 text-center text-sm">错误率</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${groupRows}
                    </tbody>
                </table>
            </div>
        </div>
        
        ${anomalies.length > 0 ? `
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg shadow-md p-6 mb-6">
            <h2 class="text-xl font-semibold text-yellow-800 mb-4 border-b border-yellow-300 pb-2">⚠️ 异常样本警告</h2>
            <p class="text-yellow-700 mb-4">以下分组样本量过小或偏离正常值，估算结果可能不可靠:</p>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead>
                        <tr class="bg-yellow-600 text-white">
                            <th class="px-4 py-2 text-left text-sm">分组</th>
                            <th class="px-4 py-2 text-center text-sm">样本数</th>
                            <th class="px-4 py-2 text-center text-sm">Z分数</th>
                            <th class="px-4 py-2 text-center text-sm">原因</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${anomalyRows}
                    </tbody>
                </table>
            </div>
        </div>
        ` : ''}
        
        ${badLines.length > 0 ? `
        <div class="bg-red-50 border border-red-200 rounded-lg shadow-md p-6 mb-6">
            <h2 class="text-xl font-semibold text-red-800 mb-4 border-b border-red-300 pb-2">❌ 异常/坏行记录</h2>
            <p class="text-red-700 mb-4">共 ${badLines.length} 条行被标记为异常:</p>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead>
                        <tr class="bg-red-600 text-white">
                            <th class="px-4 py-2 text-center text-sm">行号</th>
                            <th class="px-4 py-2 text-center text-sm">原因</th>
                            <th class="px-4 py-2 text-left text-sm">原始内容</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${badLineRows}
                    </tbody>
                </table>
            </div>
        </div>
        ` : ''}
        
        <footer class="text-center text-gray-500 text-sm mt-8">
            <p>本报告由 log-sampling-reducer v1.0.0 生成</p>
            <p>置信水平: 95% | 统计方法: 正态近似区间</p>
        </footer>
    </div>
</body>
</html>
  `;
  
  fs.writeFileSync(outputPath, html, 'utf-8');
  return outputPath;
}

function generateReports(aggregatedResults, baseOutputPath) {
  const reports = [];
  
  reports.push({
    type: 'json',
    path: saveJsonOutput(aggregatedResults, `${baseOutputPath}.json`)
  });
  
  reports.push({
    type: 'html',
    path: generateHtmlReport(aggregatedResults, `${baseOutputPath}.html`)
  });
  
  return reports;
}

module.exports = {
  printTerminalSummary,
  saveJsonOutput,
  generateHtmlReport,
  generateReports
};
