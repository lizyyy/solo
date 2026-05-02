import chalk from 'chalk';
import { ISSUE_TYPES } from '../utils/constants.js';

const SEVERITY_COLORS = {
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.blue,
};

const SEVERITY_ICONS = {
  high: '✗',
  medium: '⚠',
  low: 'ℹ',
};

export function printConsoleReport(scanResult, issues, config) {
  console.log('\n' + chalk.bold('═'.repeat(60)));
  console.log(chalk.bold('              环境变量检查报告'));
  console.log(chalk.bold('═'.repeat(60)) + '\n');

  printSummary(scanResult, issues);

  if (issues.length > 0) {
    console.log('\n' + chalk.bold('📋 发现的问题：'));
    console.log(chalk.bold('─'.repeat(60)));

    const groupedBySeverity = {
      high: issues.filter(i => i.severity === 'high'),
      medium: issues.filter(i => i.severity === 'medium'),
      low: issues.filter(i => i.severity === 'low'),
    };

    for (const severity of ['high', 'medium', 'low']) {
      const severityIssues = groupedBySeverity[severity];
      if (severityIssues.length > 0) {
        printIssuesByType(severityIssues, severity);
      }
    }
  } else {
    console.log('\n' + chalk.green('✓ 没有发现问题！'));
  }

  printVariableSummary(scanResult);

  console.log('\n' + chalk.bold('═'.repeat(60)) + '\n');
}

function printSummary(scanResult, issues) {
  const highCount = issues.filter(i => i.severity === 'high').length;
  const mediumCount = issues.filter(i => i.severity === 'medium').length;
  const lowCount = issues.filter(i => i.severity === 'low').length;

  console.log('📁 项目目录:', scanResult.projectDir);
  console.log('📅 扫描时间:', new Date(scanResult.scannedAt).toLocaleString());
  console.log('📄 扫描文件:', scanResult.files.length, '个');
  console.log('🔧 发现变量:', Object.keys(scanResult.variables.all).length, '个');
  
  console.log('\n' + chalk.bold('⚠ 问题汇总:'));
  if (highCount > 0) console.log('   严重:', chalk.red(highCount), '个');
  if (mediumCount > 0) console.log('   中等:', chalk.yellow(mediumCount), '个');
  if (lowCount > 0) console.log('   轻微:', chalk.blue(lowCount), '个');
}

function printIssuesByType(issues, severity) {
  const color = SEVERITY_COLORS[severity];
  const icon = SEVERITY_ICONS[severity];

  const typeNames = {
    [ISSUE_TYPES.MISSING_IN_EXAMPLE]: '❌ Example 中缺失',
    [ISSUE_TYPES.EXTRA_IN_LOCAL]: '⚠️ Local 中多余',
    [ISSUE_TYPES.VALUE_CONFLICT]: '🔄 值冲突',
    [ISSUE_TYPES.POTENTIAL_SECRET]: '🔐 潜在密钥',
  };

  const groupedByType = {};
  for (const issue of issues) {
    if (!groupedByType[issue.type]) {
      groupedByType[issue.type] = [];
    }
    groupedByType[issue.type].push(issue);
  }

  for (const [type, typeIssues] of Object.entries(groupedByType)) {
    console.log('\n' + color.bold(`  ${typeNames[type] || type} (${typeIssues.length}个)`));
    
    for (const issue of typeIssues) {
      console.log(`    ${color(`${icon} ${issue.variable}`)}`);
      console.log(`       ${issue.message}`);
      
      if (issue.details?.sources) {
        console.log(`       来源: ${issue.details.sources.join(', ')}`);
      }
      if (issue.details?.foundIn) {
        console.log(`       位置: ${issue.details.foundIn.join(', ')}`);
      }
      if (issue.details?.values) {
        console.log('       值冲突详情:');
        for (const val of issue.details.values) {
          console.log(`         - ${val.source}: ${val.value || '(无默认值)'}`);
        }
      }
      console.log();
    }
  }
}

function printVariableSummary(scanResult) {
  const vars = scanResult.variables;
  
  console.log('\n' + chalk.bold('📊 变量分布：'));
  console.log(chalk.bold('─'.repeat(60)));
  
  if (Object.keys(vars.fromExample).length > 0) {
    console.log(`\n📝 Example 变量 (${Object.keys(vars.fromExample).length}个):`);
    for (const [name, info] of Object.entries(vars.fromExample)) {
      const value = info.value ? ` = ${info.value}` : '';
      console.log(`  ${name}${value}`);
    }
  }

  if (Object.keys(vars.fromLocal).length > 0) {
    console.log(`\n🏠 Local 变量 (${Object.keys(vars.fromLocal).length}个):`);
    for (const [name, info] of Object.entries(vars.fromLocal)) {
      const value = info.value ? ` = ${info.value}` : '';
      console.log(`  ${name}${value}`);
    }
  }

  if (Object.keys(vars.fromDocker).length > 0) {
    console.log(`\n🐳 Docker Compose 变量 (${Object.keys(vars.fromDocker).length}个):`);
    for (const [name, info] of Object.entries(vars.fromDocker)) {
      const services = info.services?.length > 0 ? ` (服务: ${info.services.join(', ')})` : '';
      console.log(`  ${name}${services}`);
    }
  }

  if (Object.keys(vars.fromPackageJson).length > 0) {
    console.log(`\n📦 package.json 脚本变量 (${Object.keys(vars.fromPackageJson).length}个):`);
    for (const [name, info] of Object.entries(vars.fromPackageJson)) {
      const scripts = info.scripts?.length > 0 ? ` (脚本: ${info.scripts.join(', ')})` : '';
      console.log(`  ${name}${scripts}`);
    }
  }

  if (Object.keys(vars.fromMarkdown).length > 0) {
    console.log(`\n📖 Markdown 变量 (${Object.keys(vars.fromMarkdown).length}个):`);
    for (const [name, info] of Object.entries(vars.fromMarkdown)) {
      console.log(`  ${name}`);
    }
  }
}
