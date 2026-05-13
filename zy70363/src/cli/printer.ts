const chalk = require('chalk');
import { AuditReport, KeyIssue, KeyExplanation, BusinessRiskSummary } from '../types';
import { formatTTL, formatDate } from '../utils/ttl';

const riskColors: Record<string, (s: string) => string> = {
  critical: chalk.red.bold,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.blue,
  info: chalk.gray,
};

function riskLabel(level: string): string {
  const color = riskColors[level] || chalk.gray;
  return color(`[${level.toUpperCase()}]`);
}

export function printDivider(): void {
  console.log(chalk.dim('='.repeat(80)));
}

export function printHeader(title: string): void {
  printDivider();
  console.log(chalk.bold.white(title));
  printDivider();
}

export function printIssue(issue: KeyIssue, index?: number): void {
  const prefix = index !== undefined ? `  ${index + 1}. ` : '  ';
  console.log(`${prefix}${riskLabel(issue.riskLevel)} ${issue.description}`);
  console.log(`     Key: ${chalk.cyan(issue.key)}`);
  console.log(`     当前 TTL: ${formatTTL(issue.currentTTL)}`);
  if (issue.suggestedTTL !== undefined) {
    console.log(`     建议 TTL: ${chalk.green(formatTTL(issue.suggestedTTL))}`);
  }
  if (issue.needsBusinessConfirmation) {
    console.log(`     ${chalk.bgYellow.black(' 需要业务确认 ')}`);
  }
  if (issue.isTemporary) {
    console.log(`     ${chalk.gray('(临时 key，豁免检查)')}`);
  }
  console.log();
}

export function printScanResult(report: AuditReport): void {
  printHeader('Redis Key TTL 审计报告');

  console.log(chalk.bold('\n扫描概览:'));
  console.log(`  生成时间: ${formatDate(report.generatedAt)}`);
  console.log(`  扫描 key 数: ${report.totalKeysScanned}`);
  console.log(`  去重后: ${report.uniqueKeys} (重复 ${report.duplicateKeys} 个)`);
  if (!report.isCompleteSnapshot) {
    console.log(`  ${chalk.yellow('⚠ 快照非完整采样，结果可能存在偏差')}`);
  }

  const { summary } = report;
  console.log(chalk.bold('\n问题汇总:'));
  console.log(`  严重 (Critical): ${summary.critical}`);
  console.log(`  高风险 (High): ${summary.high}`);
  console.log(`  中等 (Medium): ${summary.medium}`);
  console.log(`  低风险 (Low): ${summary.low}`);
  console.log(`  信息 (Info): ${summary.info}`);
  console.log(`  已接受豁免: ${summary.accepted}`);

  if (report.expiredAcceptances.length > 0) {
    console.log(chalk.red(`\n⚠ 有 ${report.expiredAcceptances.length} 个豁免已过期，需要重新确认`));
  }

  if (report.issues.length === 0) {
    console.log(chalk.green('\n✅ 未发现任何问题！'));
    return;
  }

  const criticalIssues = report.issues.filter((i) => i.riskLevel === 'critical');
  const highIssues = report.issues.filter((i) => i.riskLevel === 'high');
  const otherIssues = report.issues.filter(
    (i) => i.riskLevel !== 'critical' && i.riskLevel !== 'high'
  );

  if (criticalIssues.length > 0) {
    printHeader(`严重问题 (${criticalIssues.length})`);
    criticalIssues.slice(0, 20).forEach((issue, idx) => printIssue(issue, idx));
    if (criticalIssues.length > 20) {
      console.log(chalk.dim(`  ... 还有 ${criticalIssues.length - 20} 个严重问题，使用 report 命令查看完整列表`));
    }
  }

  if (highIssues.length > 0) {
    printHeader(`高风险问题 (${highIssues.length})`);
    highIssues.slice(0, 20).forEach((issue, idx) => printIssue(issue, idx));
    if (highIssues.length > 20) {
      console.log(chalk.dim(`  ... 还有 ${highIssues.length - 20} 个高风险问题，使用 report 命令查看完整列表`));
    }
  }

  if (otherIssues.length > 0) {
    console.log(chalk.dim(`\n还有 ${otherIssues.length} 个中低风险问题，使用 report 命令查看`));
  }

  printBusinessSummaries(report.businessSummaries, true);
}

export function printBusinessSummaries(
  summaries: BusinessRiskSummary[],
  compact: boolean = false
): void {
  printHeader('按业务前缀聚合的风险分析');

  for (const summary of summaries) {
    const totalIssues =
      summary.issues.critical +
      summary.issues.high +
      summary.issues.medium +
      summary.issues.low;

    console.log(`\n${chalk.bold(summary.businessPrefix)} - ${summary.description}`);
    if (summary.owner) {
      console.log(`  负责人: ${summary.owner}`);
    }
    console.log(`  Key 总数: ${summary.totalKeys}`);
    
    if (totalIssues > 0) {
      const parts: string[] = [];
      if (summary.issues.critical > 0) parts.push(chalk.red.bold(`严重:${summary.issues.critical}`));
      if (summary.issues.high > 0) parts.push(chalk.red(`高:${summary.issues.high}`));
      if (summary.issues.medium > 0) parts.push(chalk.yellow(`中:${summary.issues.medium}`));
      if (summary.issues.low > 0) parts.push(chalk.blue(`低:${summary.issues.low}`));
      console.log(`  问题: ${parts.join(' / ')}`);
    } else {
      console.log(`  ${chalk.green('无问题')}`);
    }

    console.log(`  建议: ${summary.suggestedAction}`);

    if (!compact && summary.exampleKeys.length > 0) {
      console.log(`  示例 Keys:`);
      summary.exampleKeys.forEach((k) => console.log(`    - ${k}`));
    }
  }
}

export function printKeyExplanation(explanation: KeyExplanation | null): void {
  if (!explanation) {
    console.log(chalk.red('Key 未在快照中找到'));
    return;
  }

  printHeader(`Key 详情: ${explanation.key}`);
  console.log(`  匹配前缀: ${explanation.matchedPrefix}`);
  console.log(`  当前 TTL: ${formatTTL(explanation.currentTTL)}`);
  console.log(`  是否临时: ${explanation.isTemporary ? '是' : '否'}`);

  if (explanation.assignedPolicy) {
    console.log(`\n  分配策略: ${explanation.assignedPolicy.name}`);
    console.log(`    描述: ${explanation.assignedPolicy.description}`);
    console.log(`    推荐 TTL: ${explanation.assignedPolicy.suggestedTTL} ${explanation.assignedPolicy.unit}`);
  }

  if (explanation.acceptanceStatus) {
    console.log(`\n  ${chalk.green('✓ 已豁免')}`);
    console.log(`    原因: ${explanation.acceptanceStatus.reason}`);
    console.log(`    到期: ${formatDate(explanation.acceptanceStatus.expiresAt)}`);
  }

  if (explanation.issues.length > 0) {
    console.log(chalk.bold('\n  发现问题:'));
    explanation.issues.forEach((issue, idx) => {
      printIssue(issue, idx);
    });
  } else {
    console.log(chalk.green('\n  ✓ 无问题'));
  }
}

export function printSuggestion(issue: KeyIssue): void {
  printHeader(`建议: ${issue.key}`);
  console.log(`  问题类型: ${issue.issueType}`);
  console.log(`  风险等级: ${riskLabel(issue.riskLevel)}`);
  console.log(`  描述: ${issue.description}`);
  console.log();

  console.log(chalk.bold('  建议动作:'));
  switch (issue.issueType) {
    case 'no_ttl':
      console.log('    1. 确认该 key 是否真的需要永久存储');
      console.log('    2. 如果是配置数据，考虑迁移到数据库');
      console.log('    3. 如需长期缓存，设置合理的 TTL 并定期刷新');
      if (issue.suggestedTTL) {
        console.log(`    4. 建议 TTL: ${formatTTL(issue.suggestedTTL)}`);
      }
      break;
    case 'ttl_too_long':
      console.log('    1. 缩短 TTL，减少内存占用');
      if (issue.suggestedTTL) {
        console.log(`    2. 建议 TTL: ${formatTTL(issue.suggestedTTL)}`);
      }
      console.log('    3. 考虑使用 LRU 淘汰策略作为兜底');
      break;
    case 'ttl_too_short':
      console.log('    1. 检查是否是热点 key');
      console.log('    2. 考虑延长 TTL 或使用本地缓存');
      if (issue.suggestedTTL) {
        console.log(`    3. 建议 TTL: ${formatTTL(issue.suggestedTTL)}`);
      }
      console.log('    4. 可以考虑缓存预热');
      break;
    case 'invalid_name':
      console.log('    1. 查看业务命名规则');
      console.log('    2. 更新代码中的 key 命名');
      console.log('    3. 确认是否是历史遗留 key');
      break;
    case 'policy_mismatch':
      console.log('    1. 检查业务代码中的 TTL 设置');
      if (issue.suggestedTTL) {
        console.log(`    2. 调整为策略推荐值: ${formatTTL(issue.suggestedTTL)}`);
      }
      console.log('    3. 如果需要特殊处理，使用 mark-accepted 豁免');
      break;
    case 'inconsistent_policy':
      console.log('    1. 统一同业务前缀下的 TTL 策略');
      console.log('    2. 检查不同模块的代码实现');
      console.log('    3. 考虑在工具类中统一管理 TTL 常量');
      break;
  }

  if (issue.needsBusinessConfirmation) {
    console.log(`\n  ${chalk.bgYellow.black(' 需要业务方确认 ')}`);
  }
}

export function printReport(report: AuditReport, outputJson: boolean = false): void {
  if (outputJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printHeader('完整审计报告');

  console.log(chalk.bold('\n【立即处理 - 严重问题】'));
  const critical = report.issues.filter((i) => i.riskLevel === 'critical');
  if (critical.length === 0) {
    console.log('  无');
  } else {
    critical.forEach((issue, idx) => printIssue(issue, idx));
  }

  console.log(chalk.bold('\n【本周处理 - 高风险问题】'));
  const high = report.issues.filter((i) => i.riskLevel === 'high');
  if (high.length === 0) {
    console.log('  无');
  } else {
    high.forEach((issue, idx) => printIssue(issue, idx));
  }

  console.log(chalk.bold('\n【建议优化 - 中低风险】'));
  const others = report.issues.filter(
    (i) => i.riskLevel === 'medium' || i.riskLevel === 'low'
  );
  if (others.length === 0) {
    console.log('  无');
  } else {
    others.forEach((issue, idx) => printIssue(issue, idx));
  }

  if (report.expiredAcceptances.length > 0) {
    console.log(chalk.bold('\n【已过期的豁免】'));
    console.log('  以下豁免已过期，需要重新确认：');
    report.expiredAcceptances.forEach((a) => {
      console.log(`    - ${a.key} (${a.issueType})`);
      console.log(`      原因: ${a.reason}`);
      console.log(`      过期时间: ${formatDate(a.expiresAt)}`);
    });
  }

  printBusinessSummaries(report.businessSummaries);
}
