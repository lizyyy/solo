const chalk = require('chalk');
const { IssueSeverity, IssueCategory } = require('../comparators/schema-comparator');

class ConsoleReporter {
  constructor() {
    this.severityColors = {
      [IssueSeverity.CRITICAL]: chalk.red.bold,
      [IssueSeverity.HIGH]: chalk.red,
      [IssueSeverity.MEDIUM]: chalk.yellow,
      [IssueSeverity.LOW]: chalk.blue,
      [IssueSeverity.INFO]: chalk.gray
    };

    this.severityLabels = {
      [IssueSeverity.CRITICAL]: 'CRITICAL',
      [IssueSeverity.HIGH]: 'HIGH',
      [IssueSeverity.MEDIUM]: 'MEDIUM',
      [IssueSeverity.LOW]: 'LOW',
      [IssueSeverity.INFO]: 'INFO'
    };

    this.categoryLabels = {
      [IssueCategory.DESTRUCTIVE_CHANGE]: '破坏性变更',
      [IssueCategory.MOCK_OUT_OF_SYNC]: 'Mock 未同步',
      [IssueCategory.NEW_FIELD_IN_CAPTURE]: '抓包新字段',
      [IssueCategory.DOCUMENTATION_MISSING]: '文档缺失',
      [IssueCategory.TYPE_MISMATCH]: '类型不匹配',
      [IssueCategory.ENUM_MISMATCH]: '枚举不匹配',
      [IssueCategory.NULLABLE_MISMATCH]: 'Nullable 不匹配',
      [IssueCategory.REQUIRED_MISMATCH]: '必填字段不匹配',
      [IssueCategory.PAGINATION_MISMATCH]: '分页不匹配',
      [IssueCategory.FORMAT_MISMATCH]: '格式不匹配',
      [IssueCategory.ENDPOINT_MISSING]: '端点缺失',
      [IssueCategory.ENDPOINT_EXTRA]: '额外端点'
    };
  }

  report(comparisonResult, options = {}) {
    const { summary, issues, stats } = comparisonResult;
    
    this.printHeader(summary);
    
    if (summary.hasIssues) {
      this.printIssuesSummary(summary, stats);
      this.printIssuesBySeverity(issues);
      this.printSuggestions(issues);
    } else {
      this.printNoIssues();
    }
    
    this.printFooter(summary);
  }

  printHeader(summary) {
    console.log('');
    console.log(chalk.cyan('╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║                    Schema Drift Checker                      ║'));
    console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝'));
    console.log('');
    console.log(chalk.gray(`检查时间: ${new Date().toLocaleString()}`));
    console.log('');
  }

  printNoIssues() {
    console.log(chalk.green('✓ 太棒了！没有发现任何 Schema 漂移问题。'));
    console.log('');
    console.log(chalk.gray('所有数据源的 Schema 保持一致。'));
  }

  printIssuesSummary(summary, stats) {
    console.log(chalk.red.bold('⚠️  发现 Schema 漂移问题！'));
    console.log('');
    
    console.log(chalk.white('📊 问题汇总:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    const items = [
      { label: '总计问题', count: summary.totalIssues, color: chalk.white },
      { label: '严重 (Critical)', count: summary.criticalCount, color: chalk.red.bold },
      { label: '高危 (High)', count: summary.highCount, color: chalk.red },
      { label: '中等 (Medium)', count: summary.mediumCount, color: chalk.yellow },
      { label: '低危 (Low)', count: summary.lowCount, color: chalk.blue },
      { label: '信息 (Info)', count: summary.infoCount, color: chalk.gray }
    ];

    for (const item of items) {
      if (item.count > 0 || item.label === '总计问题') {
        console.log(`  ${item.color(`${item.label}: ${item.count}`)}`);
      }
    }

    console.log('');
    console.log(`  受影响端点: ${chalk.yellow(summary.affectedEndpoints)} / ${summary.totalEndpoints}`);
    console.log('');
  }

  printIssuesBySeverity(issues) {
    const issuesBySeverity = this.groupBySeverity(issues);
    
    for (const severity of [IssueSeverity.CRITICAL, IssueSeverity.HIGH, IssueSeverity.MEDIUM, IssueSeverity.LOW, IssueSeverity.INFO]) {
      const severityIssues = issuesBySeverity[severity] || [];
      if (severityIssues.length === 0) continue;

      const color = this.severityColors[severity];
      const label = this.severityLabels[severity];
      
      console.log(color(`\n🔴 ${label} 级别问题 (${severityIssues.length} 个):`));
      console.log(color('─'.repeat(60)));

      const issuesByEndpoint = this.groupByEndpoint(severityIssues);
      
      for (const [endpointKey, endpointIssues] of Object.entries(issuesByEndpoint)) {
        const [method, path] = endpointKey.split(' ');
        console.log(`\n  📍 ${chalk.bold(method)} ${chalk.cyan(path)}`);
        
        for (const issue of endpointIssues) {
          this.printIssue(issue);
        }
      }
    }
  }

  printIssue(issue) {
    const categoryLabel = this.categoryLabels[issue.category] || issue.category;
    const color = this.severityColors[issue.severity];
    
    console.log(`\n    [${categoryLabel}] ${issue.message}`);
    
    if (issue.field) {
      console.log(`      字段: ${chalk.magenta(issue.field)}`);
    }
    
    if (issue.expected !== undefined && issue.actual !== undefined) {
      console.log(`      期望: ${chalk.green(issue.expected)}`);
      console.log(`      实际: ${chalk.red(issue.actual)}`);
    }
    
    if (issue.source1 && issue.source2) {
      console.log(`      比较: ${issue.source1} ↔ ${issue.source2}`);
    }
    
    if (issue.source?.filePath) {
      console.log(`      位置: ${issue.source.filePath}`);
      if (issue.source.lineNumber !== undefined) {
        console.log(`      行号: ${issue.source.lineNumber}`);
      }
    }
    
    if (issue.suggestion) {
      console.log(chalk.gray(`      💡 建议: ${issue.suggestion}`));
    }
  }

  printSuggestions(issues) {
    console.log('');
    console.log(chalk.cyan('💡 修复建议汇总:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    const uniqueSuggestions = new Set();
    for (const issue of issues) {
      if (issue.suggestion) {
        uniqueSuggestions.add(issue.suggestion);
      }
    }
    
    let index = 1;
    for (const suggestion of uniqueSuggestions) {
      console.log(`\n  ${index}. ${suggestion}`);
      index++;
    }
  }

  printFooter(summary) {
    console.log('');
    console.log(chalk.gray('─'.repeat(60)));
    
    if (summary.hasIssues) {
      console.log(chalk.yellow(`\n⚠️  共发现 ${summary.totalIssues} 个问题，需要关注。`));
      console.log(chalk.gray(`   受影响端点: ${summary.affectedEndpoints} 个`));
    } else {
      console.log(chalk.green('\n✓ 所有检查通过！Schema 保持一致。'));
    }
    
    console.log('');
  }

  groupBySeverity(issues) {
    return issues.reduce((acc, issue) => {
      if (!acc[issue.severity]) {
        acc[issue.severity] = [];
      }
      acc[issue.severity].push(issue);
      return acc;
    }, {});
  }

  groupByEndpoint(issues) {
    return issues.reduce((acc, issue) => {
      const key = issue.endpoint 
        ? `${issue.endpoint.method} ${issue.endpoint.path}` 
        : 'Unknown';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(issue);
      return acc;
    }, {});
  }
}

module.exports = ConsoleReporter;
