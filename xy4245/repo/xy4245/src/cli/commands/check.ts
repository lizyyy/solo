import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import * as fs from 'fs';
import * as path from 'path';
import { RulesEngine } from '../../rules/rules-engine';
import { ScanResult, CheckResult, Issue, IssueType, Severity } from '../../types';

export const checkCommand = new Command('check')
  .description('执行无障碍检查，输出焦点顺序、ARIA名称、对话框陷阱和快捷键风险')
  .option('-i, --input <path>', '扫描结果路径', '.foi-output/scan-result.json')
  .option('-o, --output <path>', '输出目录', '.foi-output')
  .option('-r, --rules <rules>', '指定检查规则，逗号分隔', '')
  .option('--severity <level>', '显示指定严重级别 (critical,high,medium,low)', '')
  .option('--no-summary', '不显示摘要统计')
  .option('--no-details', '不显示问题详情')
  .action(async (options: {
    input: string;
    output: string;
    rules: string;
    severity: string;
    summary: boolean;
    details: boolean;
  }) => {
    console.log(chalk.blue('焦点顺序体检员 - 规则检查'));
    console.log('='.repeat(50));

    try {
      const inputPath = path.resolve(options.input);
      const outputDir = path.resolve(options.output);

      if (!fs.existsSync(inputPath)) {
        throw new Error(`找不到扫描结果: ${inputPath}。请先运行 "foi scan" 命令。`);
      }

      const scanResultContent = fs.readFileSync(inputPath, 'utf-8');
      const scanResult: ScanResult = JSON.parse(scanResultContent);

      console.log(chalk.green(`[✓] 加载扫描结果: ${scanResult.snapshotId}`));

      const engine = new RulesEngine();

      if (options.rules) {
        const ruleList = options.rules.split(',').map(r => r.trim() as IssueType);
        engine.setEnabledRules(ruleList);
        console.log(chalk.cyan(`[i] 启用规则: ${ruleList.join(', ')}`));
      }

      const checkResult = engine.check(scanResult);

      let displayIssues = checkResult.issues;
      
      if (options.severity) {
        const severityLevel = options.severity.toLowerCase() as Severity;
        displayIssues = displayIssues.filter(issue => issue.severity === severityLevel);
      }

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const checkResultPath = path.join(outputDir, 'check-result.json');
      fs.writeFileSync(checkResultPath, JSON.stringify(checkResult, null, 2));

      console.log(chalk.green(`[✓] 检查结果已保存: ${checkResultPath}`));

      console.log('\n' + '='.repeat(50));

      if (options.summary) {
        printSummary(checkResult);
      }

      if (options.details && displayIssues.length > 0) {
        printIssueDetails(displayIssues);
      }

      console.log('\n检查完成！');
      if (checkResult.issues.length > 0) {
        console.log(chalk.yellow(`发现 ${checkResult.issues.length} 个问题`));
        console.log(chalk.cyan('下一步: 运行 "foi review" 进行人工复核'));
      } else {
        console.log(chalk.green('未发现问题！'));
      }

    } catch (error) {
      console.error(chalk.red(`错误: ${(error as Error).message}`));
      process.exit(1);
    }
  });

function printSummary(result: CheckResult): void {
  console.log('\n检查摘要:');
  
  const table = new Table({
    head: ['严重级别', '数量'],
    colWidths: [20, 10],
    style: { head: ['cyan'] }
  });

  const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low'];
  const severityLabels: Record<Severity, string> = {
    critical: chalk.red('严重 (Critical)'),
    high: chalk.magenta('高 (High)'),
    medium: chalk.yellow('中 (Medium)'),
    low: chalk.gray('低 (Low)')
  };

  severityOrder.forEach(severity => {
    const count = result.summary.bySeverity[severity] || 0;
    table.push([severityLabels[severity], count.toString()]);
  });

  table.push(['总计', chalk.bold(result.summary.total.toString())]);
  
  console.log(table.toString());

  console.log('\n按类型统计:');
  const typeTable = new Table({
    head: ['问题类型', '数量'],
    colWidths: [30, 10],
    style: { head: ['cyan'] }
  });

  const typeLabels: Record<IssueType, string> = {
    focus_to_hidden: '焦点跳到隐藏元素',
    modal_not_trapped: '对话框未困住焦点',
    no_readable_name: '无可读名称',
    shortcut_conflict: '快捷键冲突',
    focus_order_violation: '焦点顺序违规',
    tabindex_issue: 'tabindex 问题',
    aria_role_mismatch: 'ARIA 角色不匹配'
  };

  Object.entries(result.summary.byType).forEach(([type, count]) => {
    if (count > 0) {
      typeTable.push([typeLabels[type as IssueType] || type, count.toString()]);
    }
  });

  if (typeTable.length > 0) {
    console.log(typeTable.toString());
  }
}

function printIssueDetails(issues: Issue[]): void {
  console.log('\n问题详情:');
  console.log('-'.repeat(50));

  const severityColors: Record<Severity, (text: string) => string> = {
    critical: chalk.red,
    high: chalk.magenta,
    medium: chalk.yellow,
    low: chalk.gray
  };

  issues.forEach((issue, index) => {
    const colorFn = severityColors[issue.severity];
    
    console.log(`\n${index + 1}. ${colorFn(`[${issue.severity.toUpperCase()}]`)} ${issue.title}`);
    console.log(`   类型: ${issue.type}`);
    console.log(`   描述: ${issue.description}`);
    console.log(`   元素:`);
    console.log(`     选择器: ${issue.element.selector}`);
    console.log(`     XPath: ${issue.element.xpath}`);
    console.log(`     标签: ${issue.element.tagName}`);
    if (issue.element.textContent) {
      console.log(`     文本: ${issue.element.textContent.substring(0, 50)}${issue.element.textContent.length > 50 ? '...' : ''}`);
    }
    console.log(`   建议: ${issue.suggestion}`);
    
    if (issue.references.length > 0) {
      console.log(`   参考标准:`);
      issue.references.forEach(ref => {
        console.log(`     - ${ref.standard}: ${ref.section}`);
        console.log(`       ${ref.url}`);
      });
    }

    if (issue.trajectoryIndex !== undefined) {
      console.log(`   轨迹位置: 第 ${issue.trajectoryIndex + 1} 个轨迹点`);
    }
  });
}
