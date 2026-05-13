const chalk = require('chalk');

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function truncate(str, maxLen = 60) {
  if (!str) return '';
  const singleLine = str.replace(/\n/g, ' ');
  return singleLine.length > maxLen 
    ? singleLine.substring(0, maxLen - 3) + '...'
    : singleLine;
}

function formatSimilarityReasons(reasons) {
  const typeLabels = {
    errorCode: chalk.red('错误码'),
    stackTrace: chalk.yellow('堆栈'),
    taskName: chalk.blue('任务'),
    context: chalk.green('上下文')
  };

  return reasons.map(r => {
    const matchIcon = r.match === 'exact' ? chalk.green('✓') : chalk.yellow('~');
    const simPercent = r.similarity ? ` (${(r.similarity * 100).toFixed(0)}%)` : '';
    return `  ${matchIcon} ${typeLabels[r.type] || r.type}: ${r.description}${simPercent}`;
  }).join('\n');
}

function formatEntrySummary(entry, index = null) {
  const prefix = index !== null ? `[${index}] ` : '';
  const statusColor = entry.status === 'resolved' ? chalk.green : chalk.yellow;
  const statusText = entry.status === 'resolved' ? '已解决' : '待处理';
  const expiredBadge = entry.isExpired() ? chalk.bgRed.white(' [已过期]') : '';
  const reviewBadge = entry.needsReview() ? chalk.bgYellow.black(' [需复核]') : '';

  return `${prefix}${chalk.bold(entry.taskName || '未知任务')} ${statusColor(statusText)}${expiredBadge}${reviewBadge}
  错误码: ${chalk.red(entry.fingerprint?.errorCode || 'UNKNOWN')}
  错误信息: ${truncate(entry.errorMessage)}
  创建时间: ${formatDate(entry.createdAt)}
  ID: ${chalk.gray(entry.id)}`;
}

function formatEntryDetail(entry) {
  const lines = [];
  
  lines.push(chalk.bold('\n══════════════════════════════════════════'));
  lines.push(chalk.bold(`任务: ${entry.taskName || '未知任务'}`));
  lines.push(chalk.bold('══════════════════════════════════════════\n'));

  const statusColor = entry.status === 'resolved' ? chalk.green : chalk.yellow;
  const statusText = entry.status === 'resolved' ? '已解决' : '待处理';
  lines.push(`状态: ${statusColor(statusText)}`);

  if (entry.isExpired()) {
    lines.push(chalk.bgRed.white(' 警告: 该知识条目已过期，需要复核确认有效性'));
  }

  lines.push(`\n${chalk.bold('错误信息:')}`);
  lines.push(`  ${entry.errorMessage || 'N/A'}`);

  if (entry.fingerprint) {
    lines.push(`\n${chalk.bold('错误指纹:')}`);
    lines.push(`  错误码: ${chalk.red(entry.fingerprint.errorCode)}`);
    lines.push(`  任务名: ${chalk.blue(entry.fingerprint.taskName)}`);
    lines.push(`  指纹哈希: ${chalk.gray(entry.fingerprintHash?.substring(0, 16) + '...')}`);
  }

  if (entry.stackTrace) {
    lines.push(`\n${chalk.bold('堆栈跟踪:')}`);
    const stackLines = entry.stackTrace.split('\n').slice(0, 10);
    stackLines.forEach(line => lines.push(`  ${chalk.gray(line)}`));
    if (entry.stackTrace.split('\n').length > 10) {
      lines.push(`  ${chalk.gray('... (更多堆栈已省略)')}`);
    }
  }

  if (Object.keys(entry.context || {}).length > 0) {
    lines.push(`\n${chalk.bold('任务上下文:')}`);
    Object.entries(entry.context).forEach(([k, v]) => {
      lines.push(`  ${k}: ${v}`);
    });
  }

  if (entry.resolution) {
    lines.push(`\n${chalk.bold.green('✓ 解决方案:')}`);
    entry.resolution.split('\n').forEach(line => {
      lines.push(`  ${line}`);
    });
  }

  if (entry.notes) {
    lines.push(`\n${chalk.bold('📝 处理备注:')}`);
    entry.notes.split('\n').forEach(line => {
      lines.push(`  ${line}`);
    });
  }

  lines.push(`\n${chalk.bold('反馈统计:')}`);
  lines.push(`  有用: ${chalk.green(entry.usefulCount)} | 无用: ${chalk.red(entry.notUsefulCount)} | 评分: ${entry.feedbackScore}`);

  lines.push(`\n${chalk.bold('时间信息:')}`);
  lines.push(`  创建: ${formatDate(entry.createdAt)}`);
  lines.push(`  更新: ${formatDate(entry.updatedAt)}`);
  if (entry.resolvedAt) {
    lines.push(`  解决: ${formatDate(entry.resolvedAt)}`);
    lines.push(`  过期: ${formatDate(entry.expiryDate)}`);
  }
  if (entry.resolvedBy) {
    lines.push(`  解决人: ${entry.resolvedBy}`);
  }

  lines.push(`\nID: ${chalk.gray(entry.id)}`);
  lines.push('');

  return lines.join('\n');
}

function formatSuggestionResult(result, index) {
  const entry = result.entry;
  const scoreColor = result.score >= 70 ? chalk.green : result.score >= 40 ? chalk.yellow : chalk.red;
  const statusColor = entry.status === 'resolved' ? chalk.green : chalk.yellow;
  const statusText = entry.status === 'resolved' ? '已解决' : '待处理';
  const expiredBadge = result.isExpired ? chalk.bgRed.white(' [已过期]') : '';
  const reviewBadge = result.needsReview ? chalk.bgYellow.black(' [需复核]') : '';

  const lines = [];
  lines.push(`\n${chalk.bold(`[${index}] ${entry.taskName || '未知任务'}`)} ${statusColor(statusText)}${expiredBadge}${reviewBadge}`);
  lines.push(`    综合评分: ${scoreColor(result.score.toFixed(1))} (相似度: ${(result.similarity * 100).toFixed(0)}%)`);
  
  if (result.reasons.length > 0) {
    lines.push(`    匹配原因:`);
    lines.push(formatSimilarityReasons(result.reasons));
  }

  lines.push(`    错误码: ${chalk.red(entry.fingerprint?.errorCode || 'UNKNOWN')}`);
  lines.push(`    错误信息: ${truncate(entry.errorMessage)}`);

  if (entry.resolution) {
    lines.push(`\n    ${chalk.bold.green('推荐方案:')}`);
    const resolutionLines = entry.resolution.split('\n').slice(0, 5);
    resolutionLines.forEach(line => lines.push(`    ${line}`));
    if (entry.resolution.split('\n').length > 5) {
      lines.push(`    ... (更多内容请使用 resolve 命令查看详情)`);
    }
  }

  lines.push(`    ID: ${chalk.gray(entry.id)}`);

  return lines.join('\n');
}

function formatReport(stats, entries) {
  const lines = [];
  
  lines.push(chalk.bold('\n══════════════════════════════════════════════════════════════'));
  lines.push(chalk.bold('                    任务失败知识库报告'));
  lines.push(chalk.bold('══════════════════════════════════════════════════════════════\n'));

  lines.push(chalk.bold('一、总体统计'));
  lines.push(`  知识条目总数: ${stats.total}`);
  lines.push(`  已解决: ${chalk.green(stats.resolved)}`);
  lines.push(`  待处理: ${chalk.yellow(stats.pending)}`);
  lines.push(`  已过期: ${chalk.red(stats.expired)}`);
  lines.push(`  需复核: ${chalk.bgYellow.black(' ' + stats.needsReview + ' ')}\n`);

  lines.push(chalk.bold('二、反馈统计'));
  const totalFeedback = stats.feedback.useful + stats.feedback.notUseful;
  const usefulRate = totalFeedback > 0 
    ? ((stats.feedback.useful / totalFeedback) * 100).toFixed(1) 
    : 'N/A';
  lines.push(`  有用反馈: ${chalk.green(stats.feedback.useful)}`);
  lines.push(`  无用反馈: ${chalk.red(stats.feedback.notUseful)}`);
  lines.push(`  有用率: ${usefulRate}%\n`);

  if (stats.taskNames.length > 0) {
    lines.push(chalk.bold('三、涉及任务'));
    stats.taskNames.forEach(name => lines.push(`  - ${name}`));
    lines.push('');
  }

  if (stats.errorCodes.length > 0) {
    lines.push(chalk.bold('四、常见错误码'));
    stats.errorCodes.forEach(code => lines.push(`  - ${code}`));
    lines.push('');
  }

  const pendingEntries = entries.filter(e => e.status === 'pending');
  const expiredEntries = entries.filter(e => e.needsReview());

  if (pendingEntries.length > 0) {
    lines.push(chalk.bold('五、待处理条目'));
    pendingEntries.slice(0, 10).forEach((e, i) => {
      lines.push(`  [${i + 1}] ${e.taskName || '未知任务'} - ${truncate(e.errorMessage)}`);
      lines.push(`      ID: ${e.id}`);
    });
    if (pendingEntries.length > 10) {
      lines.push(`  ... 还有 ${pendingEntries.length - 10} 条待处理`);
    }
    lines.push('');
  }

  if (expiredEntries.length > 0) {
    lines.push(chalk.bold('六、需复核条目 (已过期)'));
    expiredEntries.slice(0, 10).forEach((e, i) => {
      lines.push(`  [${i + 1}] ${e.taskName || '未知任务'} (过期: ${formatDate(e.expiryDate)})`);
      lines.push(`      ID: ${e.id}`);
    });
    if (expiredEntries.length > 10) {
      lines.push(`  ... 还有 ${expiredEntries.length - 10} 条需复核`);
    }
    lines.push('');
  }

  if (entries.length > 0) {
    const topRated = [...entries]
      .filter(e => e.feedbackScore > 0)
      .sort((a, b) => b.feedbackScore - a.feedbackScore)
      .slice(0, 5);

    if (topRated.length > 0) {
      lines.push(chalk.bold('七、最有帮助的解决方案'));
      topRated.forEach((e, i) => {
        lines.push(`  [${i + 1}] ${e.taskName || '未知任务'} (评分: ${e.feedbackScore}, 有用: ${e.usefulCount})`);
        lines.push(`      ${truncate(e.resolution || e.errorMessage)}`);
      });
      lines.push('');
    }
  }

  lines.push(chalk.bold('══════════════════════════════════════════════════════════════'));
  lines.push(`报告生成时间: ${formatDate(new Date().toISOString())}`);
  lines.push('');

  return lines.join('\n');
}

module.exports = {
  formatDate,
  truncate,
  formatSimilarityReasons,
  formatEntrySummary,
  formatEntryDetail,
  formatSuggestionResult,
  formatReport
};
