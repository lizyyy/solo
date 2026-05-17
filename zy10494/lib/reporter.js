const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { table } = require('table');

function generateReport(validationResults, options) {
  const summary = calculateSummary(validationResults);
  const timestamp = new Date().toISOString();

  const report = {
    metadata: {
      generatedAt: timestamp,
      fromEnv: options.fromEnv,
      toEnv: options.toEnv,
      scanGate: options.scanGate,
      strictMode: options.strict || false
    },
    summary,
    results: validationResults
  };

  if (options.format === 'all' || options.format === 'json') {
    writeJSONReport(report, options.outputDir);
  }

  if (options.format === 'all' || options.format === 'markdown') {
    writeMarkdownReport(report, options.outputDir);
  }

  return report;
}

function calculateSummary(results) {
  const total = results.length;
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;

  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  const totalMissing = results.reduce((sum, r) => sum + r.missingItems.length, 0);
  const criticalIssues = results.reduce((sum, r) => 
    sum + r.issues.filter(i => i.severity === 'critical').length, 0);
  const highIssues = results.reduce((sum, r) => 
    sum + r.issues.filter(i => i.severity === 'high').length, 0);

  return {
    total,
    passed,
    failures: failed,
    passRate: total > 0 ? ((passed / total) * 100).toFixed(2) : '0.00',
    totalIssues,
    totalMissing,
    criticalIssues,
    highIssues
  };
}

function writeJSONReport(report, outputDir) {
  const outputPath = path.join(outputDir, 'promotion-report.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
}

function writeMarkdownReport(report, outputDir) {
  const outputPath = path.join(outputDir, 'promotion-report.md');
  let md = '';

  md += '# 镜像晋级清单报告\n\n';
  md += `**生成时间**: ${report.metadata.generatedAt}\n\n`;
  md += `**环境晋级**: ${report.metadata.fromEnv} → ${report.metadata.toEnv}\n\n`;
  md += `**扫描门禁**: ${report.metadata.scanGate}\n\n`;
  md += `**严格模式**: ${report.metadata.strictMode ? '开启' : '关闭'}\n\n`;

  md += '## 执行摘要\n\n';
  md += '| 指标 | 数值 |\n';
  md += '|------|------|\n';
  md += `| 总镜像数 | ${report.summary.total} |\n`;
  md += `| 通过 | ${report.summary.passed} |\n`;
  md += `| 失败 | ${report.summary.failures} |\n`;
  md += `| 通过率 | ${report.summary.passRate}% |\n`;
  md += `| 问题总数 | ${report.summary.totalIssues} |\n`;
  md += `| 缺项总数 | ${report.summary.totalMissing} |\n`;
  md += `| Critical 问题 | ${report.summary.criticalIssues} |\n`;
  md += `| High 问题 | ${report.summary.highIssues} |\n\n`;

  md += '## 详细结果\n\n';

  report.results.forEach(item => {
    const statusBadge = item.status === 'pass' ? '✅ 通过' : '❌ 失败';
    md += `### ${item.imageTag} - ${statusBadge}\n\n`;

    if (item.issues.length > 0) {
      md += '#### 问题列表\n\n';
      item.issues.forEach(issue => {
        const severity = issue.severity ? `**[${issue.severity.toUpperCase()}]**` : '';
        md += `- ${severity} ${issue.message}\n`;
        if (issue.source) {
          if (issue.source.file) {
            md += `  - 来源: ${issue.source.file}:${issue.source.line}\n`;
          }
        }
      });
      md += '\n';
    }

    if (item.missingItems.length > 0) {
      md += '#### 缺项列表\n\n';
      item.missingItems.forEach(missing => {
        md += `- ${missing.message}\n`;
      });
      md += '\n';
    }

    md += '#### 检查详情\n\n';
    md += '| 检查项 | 状态 | 详情 |\n';
    md += '|--------|------|------|\n';
    
    const sigStatus = item.signatureCheck.passed ? '✅' : '❌';
    md += `| 签名校验 | ${sigStatus} | ${formatSignatureDetails(item.signatureCheck)} |\n`;

    const scanStatus = item.scanCheck.passed ? '✅' : '❌';
    md += `| 扫描门禁 | ${scanStatus} | ${formatScanDetails(item.scanCheck)} |\n`;

    const depStatus = item.deploymentCheck.passed ? '✅' : '❌';
    md += `| 部署记录 | ${depStatus} | ${formatDeploymentDetails(item.deploymentCheck)} |\n`;

    md += '\n';

    const hasSourceInfo = item.sourceRecords.all.some(s => s && s.file);
    if (hasSourceInfo) {
      md += '#### 数据来源追溯\n\n';
      item.sourceRecords.all.forEach((source, idx) => {
        if (source && source.file) {
          md += `- 记录 ${idx + 1}: \`${source.file}\` 第 ${source.line} 行\n`;
          if (source.rawContent) {
            const contentPreview = source.rawContent.length > 100 
              ? source.rawContent.substring(0, 100) + '...' 
              : source.rawContent;
            md += `  - 原始内容: \`${contentPreview}\`\n`;
          }
        }
      });
      md += '\n';
    }

    md += '---\n\n';
  });

  md += '## 附录\n\n';
  md += '### 扫描门禁说明\n\n';
  md += '- `critical`: 仅阻断 Critical 级漏洞 (默认)\n';
  md += '- `high`: 阻断 High 及以上漏洞\n';
  md += '- `medium`: 阻断 Medium 及以上漏洞\n';
  md += '- `all`: 阻断所有等级漏洞\n\n';

  md += '### 问题类型说明\n\n';
  md += '- `signature_missing`: 缺少签名\n';
  md += '- `signature_mismatch`: 签名不匹配\n';
  md += '- `scan_missing`: 缺少扫描记录\n';
  md += '- `scan_violation`: 扫描漏洞超过门禁\n';
  md += '- `deployment_missing`: 缺少部署记录\n';
  md += '- `deployment_mismatch`: 部署记录不匹配\n';

  fs.writeFileSync(outputPath, md, 'utf-8');
}

function formatSignatureDetails(check) {
  const details = check.details;
  const parts = [];
  if (details.fromSigned !== undefined) parts.push(`源环境:${details.fromSigned ? '已签名' : '未签名'}`);
  if (details.toSigned !== undefined) parts.push(`目标环境:${details.toSigned ? '已签名' : '未签名'}`);
  return parts.join(', ') || '无数据';
}

function formatScanDetails(check) {
  const details = check.details;
  if (!details.scanned) return '未扫描';
  return `C:${details.criticalCount} H:${details.highCount} M:${details.mediumCount} L:${details.lowCount} (门禁:${details.scanGate})`;
}

function formatDeploymentDetails(check) {
  const details = check.details;
  const parts = [];
  if (details.fromDeployed !== undefined) parts.push(`源环境:${details.fromDeployed ? '已部署' : '未部署'}`);
  if (details.toDeployed !== undefined) parts.push(`目标环境:${details.toDeployed ? '已部署' : '未部署'}`);
  return parts.join(', ') || '无数据';
}

function printTerminalSummary(report) {
  console.log('\n');
  
  const summaryData = [
    ['指标', '数值'],
    ['总镜像数', report.summary.total.toString()],
    ['通过', chalk.green(report.summary.passed.toString())],
    ['失败', chalk.red(report.summary.failures.toString())],
    ['通过率', chalk.cyan(report.summary.passRate + '%')],
    ['问题总数', chalk.yellow(report.summary.totalIssues.toString())],
    ['缺项总数', chalk.gray(report.summary.totalMissing.toString())],
    ['Critical 问题', chalk.red(report.summary.criticalIssues.toString())],
    ['High 问题', chalk.magenta(report.summary.highIssues.toString())]
  ];

  console.log(table(summaryData));

  if (report.summary.failures > 0) {
    console.log(chalk.red('\n❌ 失败的镜像列表:\n'));
    
    const failedImages = report.results.filter(r => r.status === 'fail');
    failedImages.forEach((item, idx) => {
      console.log(`${idx + 1}. ${chalk.bold(item.imageTag)}`);
      
      item.issues.forEach(issue => {
        const severity = issue.severity === 'critical' ? chalk.red('[CRITICAL]') :
                        issue.severity === 'high' ? chalk.magenta('[HIGH]') :
                        issue.severity === 'warning' ? chalk.yellow('[WARNING]') : '';
        console.log(`   ${severity} ${issue.message}`);
        
        if (issue.source) {
          const src = Array.isArray(issue.source) ? issue.source[0] : issue.source;
          if (src && src.file) {
            console.log(chalk.gray(`      → 来源: ${src.file}:${src.line}`));
          }
        }
      });
      
      item.missingItems.forEach(missing => {
        console.log(chalk.gray(`   ⚠️  ${missing.message}`));
      });
      
      console.log('');
    });
  }

  if (report.summary.passed === report.summary.total && report.summary.total > 0) {
    console.log(chalk.green('\n✅ 所有镜像均通过晋级检查!'));
  }

  console.log(chalk.gray(`\n报告文件已生成至: ${path.resolve(report.outputDir || './outputs')}`));
}

module.exports = {
  generateReport,
  printTerminalSummary,
  calculateSummary
};
