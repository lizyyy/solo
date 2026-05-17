import chalk from 'chalk';
import { ReportData, ProcessedLeak } from './types.js';

export function printTerminalSummary(reportData: ReportData, verbose: boolean = false): void {
  const { summary, leaks, anomalies, parseErrors } = reportData;

  console.log('\n');
  console.log(chalk.bold.blue('══════════════════════════════════════════════════════════════'));
  console.log(chalk.bold.blue('                    Gitleaks 基线整理报告                      '));
  console.log(chalk.bold.blue('══════════════════════════════════════════════════════════════\n'));

  console.log(chalk.gray(`生成时间: ${new Date(reportData.generatedAt).toLocaleString('zh-CN')}`));
  console.log(chalk.gray(`扫描报告: ${reportData.scanReportPath}`));
  if (reportData.baselinePath) {
    console.log(chalk.gray(`基线文件: ${reportData.baselinePath}`));
  }
  console.log('');

  console.log(chalk.bold('【统计摘要】'));
  console.log(chalk.gray('──────────────────────────────────────────────────────────────'));

  const stats = [
    { label: '扫描发现总数', value: summary.totalFindings, color: 'white' },
    { label: '基线条目总数', value: summary.totalBaseline, color: 'white' },
    { label: '新增泄漏', value: summary.newLeaks, color: summary.newLeaks > 0 ? 'red' : 'green' },
    { label: '基线匹配', value: summary.baselineLeaks, color: 'yellow' },
    { label: '位置变更', value: summary.modifiedLeaks, color: summary.modifiedLeaks > 0 ? 'magenta' : 'white' },
    { label: '异常样本', value: summary.anomalies, color: summary.anomalies > 0 ? 'red' : 'green' },
    { label: '影响文件数', value: summary.filesAffected, color: 'cyan' }
  ];

  stats.forEach(stat => {
    const colorFn = (chalk as any)[stat.color];
    console.log(`  ${stat.label.padEnd(12)}: ${colorFn.bold(stat.value.toString().padStart(5))}`);
  });

  console.log('');

  if (summary.newLeaks > 0) {
    console.log(chalk.bold.red('【新增泄漏 - 需立即关注】'));
    console.log(chalk.gray('──────────────────────────────────────────────────────────────'));
    const newLeaks = leaks.filter(l => l.status === 'new');
    newLeaks.slice(0, 5).forEach(leak => {
      printLeakSummary(leak, 'red');
    });
    if (newLeaks.length > 5) {
      console.log(chalk.red(`  ... 还有 ${newLeaks.length - 5} 条新增泄漏`));
    }
    console.log('');
  }

  if (summary.anomalies > 0) {
    console.log(chalk.bold.magenta('【异常样本 - 需检查数据】'));
    console.log(chalk.gray('──────────────────────────────────────────────────────────────'));
    anomalies.slice(0, 3).forEach(leak => {
      printAnomalySummary(leak);
    });
    if (anomalies.length > 3) {
      console.log(chalk.magenta(`  ... 还有 ${anomalies.length - 3} 条异常`));
    }
    console.log('');
  }

  if (parseErrors.length > 0) {
    console.log(chalk.bold.yellow('【解析错误】'));
    console.log(chalk.gray('──────────────────────────────────────────────────────────────'));
    parseErrors.slice(0, 3).forEach((error: any) => {
      console.log(chalk.yellow(`  行 ${error.row}: ${error.reason}`));
    });
    if (parseErrors.length > 3) {
      console.log(chalk.yellow(`  ... 还有 ${parseErrors.length - 3} 条解析错误`));
    }
    console.log('');
  }

  if (verbose) {
    printVerboseDetails(leaks);
  }

  printConclusion(summary);
}

function printLeakSummary(leak: ProcessedLeak, color: string): void {
  const colorFn = (chalk as any)[color];
  console.log(colorFn(`  📄 ${leak.file}:${leak.line}`));
  console.log(colorFn(`     规则: ${leak.ruleId}`));
  console.log(colorFn(`     描述: ${leak.description}`));
  if (leak.author) {
    console.log(colorFn(`     提交: ${leak.author} @ ${leak.date?.substring(0, 10) || 'N/A'}`));
  }
  console.log('');
}

function printAnomalySummary(leak: ProcessedLeak): void {
  console.log(chalk.magenta(`  📄 ${leak.file || '未知文件'}:${leak.line || 'N/A'}`));
  console.log(chalk.magenta(`     原因: ${leak.anomalyReason}`));
  if (leak.originalFinding) {
    console.log(chalk.magenta(`     原始数据指纹: ${leak.fingerprint || 'N/A'}`));
  }
  console.log('');
}

function printVerboseDetails(leaks: ProcessedLeak[]): void {
  const baselineLeaks = leaks.filter(l => l.status === 'baseline');
  if (baselineLeaks.length > 0) {
    console.log(chalk.bold.yellow('【基线匹配条目】'));
    console.log(chalk.gray('──────────────────────────────────────────────────────────────'));
    baselineLeaks.slice(0, 10).forEach(leak => {
      console.log(chalk.yellow(`  ✅ ${leak.file}:${leak.line} - ${leak.ruleId}`));
    });
    if (baselineLeaks.length > 10) {
      console.log(chalk.yellow(`  ... 还有 ${baselineLeaks.length - 10} 条基线条目`));
    }
    console.log('');
  }

  const modifiedLeaks = leaks.filter(l => l.status === 'modified');
  if (modifiedLeaks.length > 0) {
    console.log(chalk.bold.magenta('【位置变更条目】'));
    console.log(chalk.gray('──────────────────────────────────────────────────────────────'));
    modifiedLeaks.forEach(leak => {
      console.log(chalk.magenta(`  🔄 ${leak.file}:${leak.line}`));
      if (leak.baselineMatch) {
        console.log(chalk.magenta(`     原基线: ${leak.baselineMatch.file}:${leak.baselineMatch.line}`));
      }
    });
    console.log('');
  }
}

function printConclusion(summary: any): void {
  console.log(chalk.bold('【结论】'));
  console.log(chalk.gray('──────────────────────────────────────────────────────────────'));

  if (summary.newLeaks === 0 && summary.anomalies === 0) {
    console.log(chalk.green.bold('  ✅ 检查通过！没有新增泄漏和异常。'));
  } else {
    if (summary.newLeaks > 0) {
      console.log(chalk.red.bold(`  ⚠️  发现 ${summary.newLeaks} 条新增泄漏，请及时处理！`));
    }
    if (summary.anomalies > 0) {
      console.log(chalk.magenta.bold(`  ⚠️  发现 ${summary.anomalies} 条异常样本，请检查数据源。`));
    }
  }

  console.log('');
  console.log(chalk.gray('💡 详细信息请查看生成的 JSON 和 HTML 报告文件。'));
  console.log('');
}
