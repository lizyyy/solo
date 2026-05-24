import chalk from 'chalk';
import { table } from 'table';
import { DiffReport, ServiceDiff, DataSourceType } from '../types';
import { formatRetention } from '../utils/unitConverter';

const SEVERITY_COLORS = {
  critical: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
};

const SEVERITY_ICONS = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
};

export function printConsoleSummary(report: DiffReport): void {
  const { summary } = report;

  console.log('\n' + chalk.bold.cyan('='.repeat(70)));
  console.log(chalk.bold.cyan('                    日志留存策略差异分析报告'));
  console.log(chalk.bold.cyan('='.repeat(70)));
  console.log(chalk.gray(`生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`));
  console.log('');

  console.log(chalk.bold('📊 摘要统计'));
  console.log('─'.repeat(40));

  const stats = [
    ['服务总数', summary.totalServices.toString()],
    ['一致服务', chalk.green(summary.consistentServices.toString())],
    ['不一致服务', chalk.red(summary.inconsistentServices.toString())],
    ['严重问题', chalk.red(summary.criticalIssues.toString())],
    ['警告问题', chalk.yellow(summary.warningIssues.toString())],
    ['信息差异', chalk.blue(summary.infoIssues.toString())],
    ['整体一致性', formatConsistencyScore(summary.overallConsistencyScore) + '%'],
  ];

  console.log(table(stats, {
    columns: { 0: { width: 15 }, 1: { width: 20 } },
    border: {
      topBody: '─', topJoin: '┬', topLeft: '┌', topRight: '┐',
      bottomBody: '─', bottomJoin: '┴', bottomLeft: '└', bottomRight: '┘',
      bodyLeft: '│', bodyRight: '│', bodyJoin: '│',
      joinBody: '─', joinLeft: '├', joinRight: '┤', joinJoin: '┼',
    },
  }));

  console.log('');
  console.log(chalk.bold('📁 数据源统计'));
  console.log('─'.repeat(40));
  for (const source of report.sources) {
    console.log(`  ${getSourceLabel(source.type)}: ${source.serviceCount} 个服务`);
  }
}

export function printServiceDetails(services: ServiceDiff[], verbose: boolean = false): void {
  const sortedServices = [...services].sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  console.log('');
  console.log(chalk.bold('🔍 服务详情'));
  console.log('─'.repeat(70));

  for (const service of sortedServices) {
    const severityColor = SEVERITY_COLORS[service.severity];
    const icon = SEVERITY_ICONS[service.severity];

    console.log(`\n${icon} ${chalk.bold(service.canonicalName)}`);
    if (service.aliases.length > 0) {
      console.log(chalk.gray(`   别名: ${service.aliases.join(', ')}`));
    }

    console.log(`   一致性评分: ${formatConsistencyScore(service.consistencyScore)}%`);

    console.log(`   各源值:`);
    for (const [source, days] of Object.entries(service.sources)) {
      if (days !== undefined) {
        console.log(`     ${getSourceLabel(source as DataSourceType)}: ${formatRetention(days)} (${days} 天)`);
      }
    }

    if (service.differences.length > 0) {
      console.log(`   差异:`);
      for (const diff of service.differences) {
        const diffColor = SEVERITY_COLORS[diff.severity];
        console.log(diffColor(
          `     ${getSourceLabel(diff.sourceA)} vs ${getSourceLabel(diff.sourceB)}: ` +
          `相差 ${diff.diffDays} 天 (${diff.diffPercentage}%)`
        ));
      }
    }
  }
}

export function printExitCodeInfo(exitCode: number): void {
  console.log('\n' + '─'.repeat(70));
  if (exitCode === 0) {
    console.log(chalk.green('✅ 所有服务配置一致，退出码: 0'));
  } else if (exitCode === 1) {
    console.log(chalk.yellow('⚠️  存在警告级别差异，退出码: 1'));
  } else {
    console.log(chalk.red('❌ 存在严重级别差异，退出码: 2'));
  }
}

function getSourceLabel(type: DataSourceType): string {
  const labels: { [key in DataSourceType]: string } = {
    config: '⚙️  配置中心',
    terraform: '🏗️  Terraform',
    platform: '☁️  实际平台',
  };
  return labels[type];
}

function formatConsistencyScore(score: number): string {
  if (score === 100) return chalk.green('100');
  if (score >= 80) return chalk.yellow(score.toString());
  return chalk.red(score.toString());
}
