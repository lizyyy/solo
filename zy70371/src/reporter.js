const chalk = require('chalk');
const { RULES, getRuleDescription } = require('./rules');

function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString('zh-CN');
}

function formatRiskLevel(level) {
  switch (level) {
    case 'high':
      return chalk.red('[高风险]');
    case 'medium':
      return chalk.yellow('[中风险]');
    case 'low':
      return chalk.green('[低风险]');
    default:
      return chalk.gray('[未知]');
  }
}

function generateSummary(scanResults) {
  const summary = {
    totalFiles: 0,
    filesWithMatches: 0,
    totalMatches: 0,
    realPiiMatches: 0,
    redactedMatches: 0,
    byCategory: {},
    byRiskLevel: { high: 0, medium: 0, low: 0 }
  };
  
  for (const result of scanResults) {
    summary.totalFiles++;
    
    if (result.matches.length > 0) {
      summary.filesWithMatches++;
    }
    
    for (const match of result.matches) {
      summary.totalMatches++;
      
      if (match.isRedacted) {
        summary.redactedMatches++;
      } else {
        summary.realPiiMatches++;
      }
      
      if (!summary.byCategory[match.category]) {
        summary.byCategory[match.category] = 0;
      }
      summary.byCategory[match.category]++;
      
      if (summary.byRiskLevel[match.riskLevel] !== undefined) {
        summary.byRiskLevel[match.riskLevel]++;
      }
    }
  }
  
  return summary;
}

function canPublish(summary) {
  return summary.realPiiMatches === 0;
}

function printTerminalReport(scanResults, stateManager = null) {
  const summary = generateSummary(scanResults);
  const publishable = canPublish(summary);
  
  console.log('\n' + '='.repeat(80));
  console.log(chalk.bold.magenta('                      PII 扫描报告'));
  console.log('='.repeat(80) + '\n');
  
  console.log(chalk.bold('📊 扫描摘要'));
  console.log('  ├─ 扫描文件数: ' + summary.totalFiles);
  console.log('  ├─ 含问题文件: ' + summary.filesWithMatches);
  console.log('  ├─ 总命中数: ' + summary.totalMatches);
  console.log('  ├─ 真实 PII (需清理): ' + chalk.red(summary.realPiiMatches));
  console.log('  └─ 脱敏数据 (可接受): ' + chalk.green(summary.redactedMatches));
  
  if (Object.keys(summary.byCategory).length > 0) {
    console.log('\n' + chalk.bold('📋 按类型统计'));
    for (const [category, count] of Object.entries(summary.byCategory)) {
      const rule = Object.values(RULES).find(r => r.category === category);
      console.log(`  ├─ ${rule?.name || category}: ${count}`);
    }
  }
  
  console.log('\n' + chalk.bold('⚠️  风险等级'));
  console.log('  ├─ 高风险: ' + chalk.red(summary.byRiskLevel.high));
  console.log('  ├─ 中风险: ' + chalk.yellow(summary.byRiskLevel.medium));
  console.log('  └─ 低风险: ' + chalk.green(summary.byRiskLevel.low));
  
  console.log('\n' + chalk.bold('🎯 发布状态'));
  if (publishable) {
    console.log('  ' + chalk.green.bold('✅ 可以发布 - 未发现需要清理的真实 PII'));
  } else {
    console.log('  ' + chalk.red.bold('❌ 不能发布 - 发现 ' + summary.realPiiMatches + ' 条需要清理的真实 PII'));
  }
  
  const filesWithRealPii = scanResults.filter(r => r.matches.some(m => !m.isRedacted));
  
  if (filesWithRealPii.length > 0) {
    console.log('\n' + '─'.repeat(80));
    console.log(chalk.bold.red('🔴 需要清理的真实 PII 详细信息'));
    console.log('─'.repeat(80));
    
    for (const result of filesWithRealPii) {
      const realMatches = result.matches.filter(m => !m.isRedacted);
      if (realMatches.length === 0) continue;
      
      console.log('\n' + chalk.bold.cyan('📄 文件: ') + result.filePath);
      if (result.isLarge) {
        console.log('  ' + chalk.yellow('⚠️  大文件，仅采样扫描（头部和尾部各1000行）'));
      }
      
      for (const match of realMatches) {
        console.log('\n  ' + formatRiskLevel(match.riskLevel) + ' ' + chalk.bold(match.type));
        console.log('    ├─ 位置: 第 ' + match.lineNumber + ' 行, 第 ' + match.column + ' 列');
        console.log('    ├─ 命中 ID: ' + chalk.gray(match.id));
        console.log('    ├─ 匹配内容: ' + chalk.red(match.match));
        console.log('    ├─ 上下文: ...' + match.context + '...');
        console.log('    └─ 建议替换: ' + chalk.green(match.replacement));
      }
    }
  }
  
  const filesWithRedacted = scanResults.filter(r => r.matches.some(m => m.isRedacted));
  
  if (filesWithRedacted.length > 0) {
    console.log('\n' + '─'.repeat(80));
    console.log(chalk.bold.green('🟢 脱敏数据（可接受，无需处理）'));
    console.log('─'.repeat(80));
    
    for (const result of filesWithRedacted) {
      const redactedMatches = result.matches.filter(m => m.isRedacted);
      if (redactedMatches.length === 0) continue;
      
      console.log('\n' + chalk.bold.cyan('📄 文件: ') + result.filePath);
      
      for (const match of redactedMatches) {
        console.log('  ' + formatRiskLevel(match.riskLevel) + ' ' + match.type + ': ' + match.match);
      }
    }
  }
  
  if (stateManager) {
    const ignores = stateManager.getAllIgnores();
    const expired = stateManager.getExpiredIgnores();
    
    if (ignores.length > 0) {
      console.log('\n' + '─'.repeat(80));
      console.log(chalk.bold.blue('📌 忽略规则'));
      console.log('─'.repeat(80));
      
      for (const ignore of ignores) {
        const isExpired = ignore.expiresAt && ignore.expiresAt <= Date.now();
        const status = isExpired ? chalk.red('[已过期]') : chalk.green('[有效]');
        console.log('  ' + status + ' ' + ignore.matchId);
        console.log('    ├─ 原因: ' + ignore.reason);
        console.log('    ├─ 创建时间: ' + formatDate(ignore.createdAt));
        if (ignore.expiresAt) {
          console.log('    └─ 到期时间: ' + formatDate(ignore.expiresAt));
        }
      }
    }
    
    if (expired.length > 0) {
      console.log('\n' + chalk.yellow('⚠️  发现 ' + expired.length + ' 条过期的忽略规则，建议重新审查'));
    }
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  return {
    summary,
    publishable,
    exitCode: publishable ? 0 : 1
  };
}

function printExplainReport(ruleName, sampleText = null) {
  const rule = Object.entries(RULES).find(([key]) => key === ruleName);
  
  if (!rule) {
    console.log(chalk.red('❌ 未找到规则: ' + ruleName));
    console.log('\n可用规则:');
    for (const [key, r] of Object.entries(RULES)) {
      console.log('  - ' + key + ': ' + r.name);
    }
    return;
  }
  
  const [key, ruleObj] = rule;
  
  console.log('\n' + '─'.repeat(80));
  console.log(chalk.bold.magenta('📖 规则详情: ' + key));
  console.log('─'.repeat(80));
  
  console.log('\n  名称: ' + ruleObj.name);
  console.log('  风险等级: ' + formatRiskLevel(ruleObj.riskLevel));
  console.log('  描述: ' + ruleObj.describe);
  console.log('  建议替换格式: ' + ruleObj.replacement);
  
  if (sampleText) {
    console.log('\n' + chalk.bold('🔍 测试匹配:'));
    console.log('  测试文本: ' + sampleText);
    
    ruleObj.pattern.lastIndex = 0;
    let match;
    let found = false;
    
    while ((match = ruleObj.pattern.exec(sampleText)) !== null) {
      found = true;
      const isValid = ruleObj.validator(match[0]);
      
      console.log('  匹配结果: ' + (isValid ? chalk.green('✓ 有效') : chalk.red('✗ 无效')));
      console.log('  匹配内容: ' + match[0]);
      
      if (isValid) {
        const replacement = require('./rules').applyReplacement(match[0], ruleObj.replacement);
        console.log('  建议替换: ' + chalk.green(replacement));
      }
    }
    
    if (!found) {
      console.log('  ' + chalk.yellow('未找到匹配'));
    }
  }
  
  console.log('\n' + '─'.repeat(80) + '\n');
}

function printAllRules() {
  console.log('\n' + '─'.repeat(80));
  console.log(chalk.bold.magenta('📋 所有 PII 识别规则'));
  console.log('─'.repeat(80) + '\n');
  
  for (const [key, rule] of Object.entries(RULES)) {
    console.log(chalk.bold(key) + ':');
    console.log('  名称: ' + rule.name);
    console.log('  风险等级: ' + formatRiskLevel(rule.riskLevel));
    console.log('  描述: ' + rule.describe);
    console.log('');
  }
}

module.exports = {
  generateSummary,
  canPublish,
  printTerminalReport,
  printExplainReport,
  printAllRules
};