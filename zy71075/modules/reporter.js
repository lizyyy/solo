const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');

const EXIT_CODES = {
  SUCCESS: 0,
  NO_INPUT: 1,
  INVALID_INPUT: 2,
  NO_FFPROBE: 3,
  CRITICAL_RISKS: 4,
  PARTIAL_FAILURE: 5,
  IO_ERROR: 6
};

function getExitCode(plan) {
  if (plan.summary.failedFiles === plan.summary.totalFiles) {
    return EXIT_CODES.PARTIAL_FAILURE;
  }
  if (plan.summary.riskStats.critical > 0) {
    return EXIT_CODES.CRITICAL_RISKS;
  }
  if (plan.summary.failedFiles > 0) {
    return EXIT_CODES.PARTIAL_FAILURE;
  }
  return EXIT_CODES.SUCCESS;
}

function formatBitrate(bps) {
  if (bps >= 1000000) {
    return `${(bps / 1000000).toFixed(1)} Mbps`;
  }
  if (bps >= 1000) {
    return `${(bps / 1000).toFixed(1)} kbps`;
  }
  return `${bps} bps`;
}

function formatSize(mb) {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(2)} MB`;
}

function getRiskColor(level) {
  switch (level) {
    case 'CRITICAL': return chalk.red.bold;
    case 'HIGH': return chalk.red;
    case 'MEDIUM': return chalk.yellow;
    case 'LOW': return chalk.blue;
    default: return chalk.green;
  }
}

function getRiskSymbol(level) {
  switch (level) {
    case 'CRITICAL': return '⛔';
    case 'HIGH': return '⚠️';
    case 'MEDIUM': return '⚡';
    case 'LOW': return 'ℹ️';
    default: return '✅';
  }
}

function printSummary(plan) {
  const summary = plan.summary;

  console.log('\n' + chalk.cyan.bold('='.repeat(60)));
  console.log(chalk.cyan.bold('           FFmpeg 转码计划汇总'));
  console.log(chalk.cyan.bold('='.repeat(60)) + '\n');

  console.log(chalk.white.bold('📊 基本统计'));
  console.log(`  总文件数: ${summary.totalFiles}`);
  console.log(`  成功分析: ${chalk.green(summary.successFiles)} | ${chalk.red(`失败: ${summary.failedFiles}`)}`);
  console.log(`  总时长: ${summary.totalDurationFormatted}`);
  console.log('');

  console.log(chalk.white.bold('💾 体积估算'));
  console.log(`  原始大小: ${formatSize(summary.sizes.original.megabytes)}`);
  console.log(`  预估大小: ${formatSize(summary.sizes.estimated.megabytes)}`);
  console.log(`  节省空间: ${chalk.green(formatSize(summary.sizes.saved.megabytes))}`);
  console.log(`  压缩比: ${summary.sizes.compressionRatio.toFixed(2)}x (减少 ${summary.sizes.reductionPercent}%)`);
  console.log('');

  console.log(chalk.white.bold('⚠️ 风险统计'));
  const riskParts = [];
  if (summary.riskStats.critical > 0) riskParts.push(chalk.red(`CRITICAL: ${summary.riskStats.critical}`));
  if (summary.riskStats.high > 0) riskParts.push(chalk.redBright(`HIGH: ${summary.riskStats.high}`));
  if (summary.riskStats.medium > 0) riskParts.push(chalk.yellow(`MEDIUM: ${summary.riskStats.medium}`));
  if (summary.riskStats.low > 0) riskParts.push(chalk.blue(`LOW: ${summary.riskStats.low}`));
  riskParts.push(chalk.green(`SAFE: ${summary.riskStats.safe}`));
  console.log(`  ${riskParts.join(' | ')}`);
  console.log(`  预估失败率: ${summary.estimatedFailureRate > 0 ? chalk.yellow(`${summary.estimatedFailureRate}%`) : chalk.green('0%')}`);
  console.log('');
}

function printFileTable(plan, options = {}) {
  const { showAll = false, minRiskLevel = 'LOW' } = options;
  const levelOrder = ['SAFE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const minIndex = levelOrder.indexOf(minRiskLevel);

  const table = new Table({
    head: [
      chalk.white.bold('文件'),
      chalk.white.bold('分辨率'),
      chalk.white.bold('预估体积'),
      chalk.white.bold('目标码率'),
      chalk.white.bold('风险等级')
    ],
    colWidths: [30, 14, 14, 14, 14],
    wordWrap: true
  });

  for (const file of plan.files) {
    if (!showAll) {
      const fileLevelIndex = levelOrder.indexOf(file.riskScore?.overallLevel || 'SAFE');
      if (fileLevelIndex < minIndex && file.success) continue;
    }

    const riskColor = getRiskColor(file.riskScore?.overallLevel || 'SAFE');
    const riskSymbol = getRiskSymbol(file.riskScore?.overallLevel || 'SAFE');
    
    table.push([
      file.file,
      file.success ? file.mediaInfo?.resolution || 'N/A' : chalk.red('FAILED'),
      file.success ? formatSize(file.estimatedSize?.megabytes || 0) : '-',
      file.success ? formatBitrate(file.bitrate?.total || 0) : '-',
      file.success 
        ? riskColor(`${riskSymbol} ${file.riskScore?.overallLevel || 'SAFE'}`)
        : chalk.red('⛔ FAILED')
    ]);
  }

  console.log(chalk.white.bold('📋 文件详情'));
  console.log(table.toString());
  console.log('');
}

function printRiskDetails(plan) {
  let hasRisks = false;

  for (const file of plan.files) {
    if (!file.risks || file.risks.length === 0) continue;
    
    const fileRisks = file.risks.filter(r => r.level.name !== 'INFO');
    if (fileRisks.length === 0) continue;

    hasRisks = true;
    console.log(chalk.white.bold(`\n🔍 ${file.file}`));
    
    for (const risk of fileRisks) {
      const color = getRiskColor(risk.level.name);
      console.log(`  ${getRiskSymbol(risk.level.name)} ${color(`[${risk.level.name}]`)} ${chalk.bold(risk.title)}`);
      console.log(`     ${risk.message}`);
      
      for (const detail of risk.details) {
        console.log(`       • ${detail}`);
      }
      
      console.log(`     💡 建议: ${chalk.green(risk.recommendation)}`);
      
      if (risk.relatedSamples && risk.relatedSamples.length > 0) {
        console.log(`     📚 历史案例:`);
        for (const sample of risk.relatedSamples.slice(0, 2)) {
          console.log(`       - ${sample.description} (失败率 ${(sample.failureRate * 100).toFixed(0)}%)`);
        }
      }
    }
  }

  if (!hasRisks) {
    console.log(chalk.green('\n✅ 未检测到明显风险'));
  }
  console.log('');
}

function printCommands(plan) {
  console.log(chalk.white.bold('\n📝 生成的转码命令'));
  console.log(chalk.gray('-' .repeat(60)));
  
  for (const file of plan.files) {
    if (!file.success || !file.command) continue;
    
    console.log(`\n# ${file.file}`);
    console.log(`# 预估体积: ${formatSize(file.estimatedSize?.megabytes || 0)}`);
    console.log(`# 风险等级: ${file.riskScore?.overallLevel || 'SAFE'}`);
    console.log(chalk.cyan(file.command.command));
  }
  console.log('');
}

function exportJSON(plan, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(plan, null, 2));
  return outputPath;
}

function exportMarkdown(plan, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const summary = plan.summary;
  const lines = [];

  lines.push('# FFmpeg 批量转码计划报告');
  lines.push('');
  lines.push(`**生成时间:** ${new Date(plan.generatedAt).toLocaleString('zh-CN')}`);
  lines.push(`**工具版本:** ${plan.version}`);
  lines.push('');

  lines.push('## 📊 汇总统计');
  lines.push('');
  lines.push('| 项目 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 总文件数 | ${summary.totalFiles} |`);
  lines.push(`| 成功分析 | ${summary.successFiles} |`);
  lines.push(`| 分析失败 | ${summary.failedFiles} |`);
  lines.push(`| 总时长 | ${summary.totalDurationFormatted} |`);
  lines.push(`| 原始大小 | ${formatSize(summary.sizes.original.megabytes)} |`);
  lines.push(`| 预估大小 | ${formatSize(summary.sizes.estimated.megabytes)} |`);
  lines.push(`| 节省空间 | ${formatSize(summary.sizes.saved.megabytes)} |`);
  lines.push(`| 压缩比 | ${summary.sizes.compressionRatio.toFixed(2)}x |`);
  lines.push(`| 预估失败率 | ${summary.estimatedFailureRate}% |`);
  lines.push('');

  lines.push('## ⚠️ 风险统计');
  lines.push('');
  lines.push('| 风险等级 | 文件数 |');
  lines.push('|----------|--------|');
  lines.push(`| 🔴 CRITICAL | ${summary.riskStats.critical} |`);
  lines.push(`| 🟠 HIGH | ${summary.riskStats.high} |`);
  lines.push(`| 🟡 MEDIUM | ${summary.riskStats.medium} |`);
  lines.push(`| 🔵 LOW | ${summary.riskStats.low} |`);
  lines.push(`| ✅ SAFE | ${summary.riskStats.safe} |`);
  lines.push('');

  lines.push('## 📋 文件详情');
  lines.push('');
  lines.push('| 文件名 | 分辨率 | 原始大小 | 预估大小 | 目标码率 | 风险等级 |');
  lines.push('|--------|--------|----------|----------|----------|----------|');
  
  for (const file of plan.files) {
    const riskEmoji = getRiskSymbol(file.riskScore?.overallLevel || 'SAFE');
    lines.push(`| ${file.file} | ${file.success ? file.mediaInfo?.resolution || 'N/A' : 'FAILED'} | ${file.success ? formatSize(file.originalSize?.megabytes || 0) : '-'} | ${file.success ? formatSize(file.estimatedSize?.megabytes || 0) : '-'} | ${file.success ? formatBitrate(file.bitrate?.total || 0) : '-'} | ${riskEmoji} ${file.riskScore?.overallLevel || 'SAFE'} |`);
  }
  lines.push('');

  const riskyFiles = plan.files.filter(f => f.risks && f.risks.length > 0 && f.risks.some(r => r.level.name !== 'INFO'));
  if (riskyFiles.length > 0) {
    lines.push('## 🔍 风险详情');
    lines.push('');
    
    for (const file of riskyFiles) {
      lines.push(`### ${file.file}`);
      lines.push('');
      
      for (const risk of file.risks) {
        if (risk.level.name === 'INFO') continue;
        lines.push(`#### ${getRiskSymbol(risk.level.name)} [${risk.level.name}] ${risk.title}`);
        lines.push('');
        lines.push(risk.message);
        lines.push('');
        lines.push('**详情:**');
        for (const detail of risk.details) {
          lines.push(`- ${detail}`);
        }
        lines.push('');
        lines.push(`**建议:** ${risk.recommendation}`);
        lines.push('');
        
        if (risk.relatedSamples && risk.relatedSamples.length > 0) {
          lines.push('**历史案例:**');
          for (const sample of risk.relatedSamples) {
            lines.push(`- ${sample.description} (失败率 ${(sample.failureRate * 100).toFixed(0)}%)`);
            lines.push(`  - 典型问题: ${sample.typicalIssues.join(', ')}`);
          }
          lines.push('');
        }
      }
    }
  }

  lines.push('## 📝 转码命令');
  lines.push('');
  lines.push('```bash');
  
  for (const file of plan.files) {
    if (!file.success || !file.command) continue;
    lines.push(`# ${file.file}`);
    lines.push(`# 预估体积: ${formatSize(file.estimatedSize?.megabytes || 0)}`);
    lines.push(`# 风险等级: ${file.riskScore?.overallLevel || 'SAFE'}`);
    lines.push(file.command.command);
    lines.push('');
  }
  lines.push('```');

  fs.writeFileSync(outputPath, lines.join('\n'));
  return outputPath;
}

function printTerminalReport(plan, options = {}) {
  const { showDetails = true, showRisks = true, showCommands = false } = options;

  printSummary(plan);
  
  if (showDetails) {
    printFileTable(plan, options);
  }
  
  if (showRisks) {
    printRiskDetails(plan);
  }
  
  if (showCommands) {
    printCommands(plan);
  }
}

module.exports = {
  EXIT_CODES,
  getExitCode,
  formatBitrate,
  formatSize,
  printSummary,
  printFileTable,
  printRiskDetails,
  printCommands,
  printTerminalReport,
  exportJSON,
  exportMarkdown
};
