const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { CONFLICT_TYPES, OUTPUT_FORMATS, TIME_UNITS } = require('./constants');
const { 
  normalizeTimezone, 
  formatDateTime,
  DateTime 
} = require('./time-utils');

function ensureOutputDir(outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

function serializeForJSON(obj) {
  if (DateTime.isDateTime(obj)) {
    return obj.toISO();
  }
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  if (obj instanceof Map) {
    return Object.fromEntries(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => serializeForJSON(item));
  }
  if (obj !== null && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeForJSON(value);
    }
    return result;
  }
  return obj;
}

function generateJSONReport(results, outputPath) {
  const serialized = serializeForJSON(results);
  const json = JSON.stringify(serialized, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
  return outputPath;
}

function generateMarkdownReport(results, outputPath, options = {}) {
  const { timezone = 'UTC', title = '会议室冲突检测报告' } = options;
  const normalizedTz = normalizeTimezone(timezone);
  
  const lines = [];
  
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`**生成时间**: ${formatDateTime(DateTime.utc(), normalizedTz, 'full')}`);
  lines.push(`**时区**: ${normalizedTz}`);
  lines.push('');
  
  lines.push('## 执行摘要');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 解析事件总数 | ${results.summary?.totalEvents || 0} |`);
  lines.push(`| 有效事件数 | ${results.summary?.activeEvents || 0} |`);
  lines.push(`| 取消事件数 | ${results.summary?.cancelledEvents || 0} |`);
  lines.push(`| 发现冲突数 | ${results.summary?.totalConflicts || 0} |`);
  lines.push(`| 取消未生效 | ${results.summary?.cancelNotEffective || 0} |`);
  lines.push('');
  
  lines.push('## 冲突类型统计');
  lines.push('');
  if (results.summary?.byType) {
    for (const [type, count] of Object.entries(results.summary.byType)) {
      const typeName = getConflictTypeName(type);
      lines.push(`- **${typeName}**: ${count} 个`);
    }
  }
  lines.push('');
  
  lines.push('## 冲突严重程度');
  lines.push('');
  if (results.summary?.bySeverity) {
    lines.push(`- 🔴 **高**: ${results.summary.bySeverity.high || 0} 个`);
    lines.push(`- 🟡 **中**: ${results.summary.bySeverity.medium || 0} 个`);
    lines.push(`- 🟢 **低**: ${results.summary.bySeverity.low || 0} 个`);
  }
  lines.push('');
  
  if (results.byRoom && results.byRoom.size > 0) {
    lines.push('## 按会议室分类');
    lines.push('');
    
    for (const [room, roomData] of results.byRoom.entries()) {
      const status = roomData.hasConflicts ? '🔴' : '✅';
      lines.push(`### ${status} ${room}`);
      lines.push('');
      lines.push(`- 事件数: ${roomData.eventCount}`);
      lines.push(`- 冲突数: ${roomData.conflictCount}`);
      lines.push('');
      
      if (roomData.conflicts && roomData.conflicts.length > 0) {
        lines.push('#### 冲突详情');
        lines.push('');
        for (let i = 0; i < roomData.conflicts.length; i++) {
          const conflict = roomData.conflicts[i];
          lines.push(`##### ${i + 1}. ${getConflictTypeName(conflict.type)} - ${getSeverityEmoji(conflict.severity)} ${getSeverityText(conflict.severity)}`);
          lines.push('');
          lines.push(`**描述**: ${conflict.description}`);
          lines.push('');
          lines.push('```');
          lines.push(conflict.explanation);
          lines.push('```');
          lines.push('');
        }
      }
    }
  }
  
  if (results.cancellations && results.cancellations.cancelNotEffective && results.cancellations.cancelNotEffective.length > 0) {
    lines.push('## 取消未生效报告');
    lines.push('');
    
    for (let i = 0; i < results.cancellations.cancelNotEffective.length; i++) {
      const cancel = results.cancellations.cancelNotEffective[i];
      lines.push(`### ${i + 1}. ${cancel.event.summary}`);
      lines.push('');
      lines.push(`**位置**: ${cancel.event.location || 'N/A'}`);
      lines.push(`**组织者**: ${cancel.event.organizer}`);
      lines.push(`**时间**: ${formatDateTime(cancel.event.startTime, normalizedTz, 'short')} - ${formatDateTime(cancel.event.endTime, normalizedTz, 'time')}`);
      lines.push(`**严重程度**: ${getSeverityEmoji(cancel.severity)} ${getSeverityText(cancel.severity)}`);
      lines.push('');
      lines.push('```');
      lines.push(cancel.explanation);
      lines.push('```');
      lines.push('');
    }
  }
  
  if (results.inputValidation && results.inputValidation.errors && results.inputValidation.errors.length > 0) {
    lines.push('## 输入验证警告');
    lines.push('');
    for (const error of results.inputValidation.errors) {
      lines.push(`- ⚠️ ${error}`);
    }
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  lines.push('*报告由 iCal Meeting Conflict CLI 生成*');
  
  const content = lines.join('\n');
  fs.writeFileSync(outputPath, content, 'utf-8');
  return outputPath;
}

function getConflictTypeName(type) {
  const names = {
    [CONFLICT_TYPES.OVERLAP]: '时间重叠',
    [CONFLICT_TYPES.BACK_TO_BACK]: '紧接会议',
    [CONFLICT_TYPES.CROSS_DAY]: '跨天会议',
    [CONFLICT_TYPES.CANCEL_NOT_EFFECTIVE]: '取消未生效',
    [CONFLICT_TYPES.HIDDEN_CONFLICT]: '隐藏冲突'
  };
  return names[type] || type;
}

function getSeverityEmoji(severity) {
  const emojis = {
    high: '🔴',
    medium: '🟡',
    low: '🟢'
  };
  return emojis[severity] || '⚪';
}

function getSeverityText(severity) {
  const texts = {
    high: '高',
    medium: '中',
    low: '低'
  };
  return texts[severity] || severity;
}

function printTerminalSummary(results, options = {}) {
  const { timezone = 'UTC' } = options;
  const normalizedTz = normalizeTimezone(timezone);
  
  console.log('\n' + chalk.cyan('=' .repeat(60)));
  console.log(chalk.cyan.bold('           iCal 会议室冲突检测报告'));
  console.log(chalk.cyan('=' .repeat(60)) + '\n');
  
  console.log(chalk.gray(`生成时间: ${formatDateTime(DateTime.utc(), normalizedTz, 'full')}`));
  console.log(chalk.gray(`时区: ${normalizedTz}\n`));
  
  console.log(chalk.white.bold('📊 执行摘要'));
  console.log(chalk.gray('-'.repeat(40)));
  
  const summary = results.summary || {};
  console.log(`  解析事件总数: ${chalk.white(summary.totalEvents || 0)}`);
  console.log(`  有效事件数: ${chalk.green(summary.activeEvents || 0)}`);
  console.log(`  取消事件数: ${chalk.yellow(summary.cancelledEvents || 0)}`);
  console.log(`  发现冲突数: ${chalk.red(summary.totalConflicts || 0)}`);
  console.log(`  取消未生效: ${chalk.magenta(summary.cancelNotEffective || 0)}`);
  console.log('');
  
  if (summary.byType && Object.keys(summary.byType).length > 0) {
    console.log(chalk.white.bold('📋 冲突类型统计'));
    console.log(chalk.gray('-'.repeat(40)));
    for (const [type, count] of Object.entries(summary.byType)) {
      const typeName = getConflictTypeName(type);
      console.log(`  ${typeName}: ${chalk.yellow(count)} 个`);
    }
    console.log('');
  }
  
  if (summary.bySeverity) {
    console.log(chalk.white.bold('🚨 严重程度'));
    console.log(chalk.gray('-'.repeat(40)));
    console.log(`  ${chalk.red('高')}: ${summary.bySeverity.high || 0} 个`);
    console.log(`  ${chalk.yellow('中')}: ${summary.bySeverity.medium || 0} 个`);
    console.log(`  ${chalk.green('低')}: ${summary.bySeverity.low || 0} 个`);
    console.log('');
  }
  
  if (results.byRoom && results.byRoom.size > 0) {
    console.log(chalk.white.bold('🏢 会议室状态'));
    console.log(chalk.gray('-'.repeat(40)));
    
    for (const [room, roomData] of results.byRoom.entries()) {
      const status = roomData.hasConflicts ? chalk.red('有冲突') : chalk.green('正常');
      console.log(`  ${room}: ${status} (${roomData.eventCount}个事件, ${chalk.yellow(roomData.conflictCount)}个冲突)`);
    }
    console.log('');
  }
  
  const allConflicts = getAllConflicts(results);
  if (allConflicts.length > 0) {
    console.log(chalk.white.bold('🔍 冲突详情'));
    console.log(chalk.gray('-'.repeat(40)));
    
    for (let i = 0; i < Math.min(allConflicts.length, 5); i++) {
      const conflict = allConflicts[i];
      const severityColor = conflict.severity === 'high' ? chalk.red : 
                            conflict.severity === 'medium' ? chalk.yellow : chalk.green;
      
      console.log(`\n  ${i + 1}. ${getConflictTypeName(conflict.type)} - ${severityColor(getSeverityText(conflict.severity))}`);
      console.log(`     ${chalk.gray(conflict.description)}`);
      
      if (conflict.events) {
        for (const event of conflict.events) {
          console.log(`       • ${event.summary} (${formatDateTime(event.startTime, normalizedTz, 'short')})`);
        }
      } else if (conflict.event) {
        console.log(`       • ${conflict.event.summary} (${formatDateTime(conflict.event.startTime, normalizedTz, 'short')})`);
      }
    }
    
    if (allConflicts.length > 5) {
      console.log(chalk.gray(`\n  ... 还有 ${allConflicts.length - 5} 个冲突，请查看完整报告`));
    }
    console.log('');
  }
  
  if (results.files && results.files.length > 0) {
    console.log(chalk.white.bold('📄 输出文件'));
    console.log(chalk.gray('-'.repeat(40)));
    for (const file of results.files) {
      console.log(`  ${chalk.cyan(file)}`);
    }
    console.log('');
  }
  
  const exitCode = results.exitCode || 0;
  if (exitCode === 0) {
    console.log(chalk.green.bold('✅ 检查完成 - 未发现需要关注的问题'));
  } else {
    console.log(chalk.red.bold(`⚠️  检查完成 - 发现 ${summary.totalConflicts || 0} 个问题，退出码: ${exitCode}`));
  }
  console.log('');
}

function getAllConflicts(results) {
  const conflicts = [];
  
  if (results.byRoom) {
    for (const roomData of results.byRoom.values()) {
      if (roomData.conflicts) {
        conflicts.push(...roomData.conflicts);
      }
    }
  }
  
  if (results.cancellations && results.cancellations.cancelNotEffective) {
    conflicts.push(...results.cancellations.cancelNotEffective);
  }
  
  return conflicts;
}

function generateReports(results, outputDir, options = {}) {
  const { 
    format = OUTPUT_FORMATS.ALL, 
    timezone = 'UTC',
    basename = 'conflict-report'
  } = options;
  
  ensureOutputDir(outputDir);
  const generatedFiles = [];
  
  if (format === OUTPUT_FORMATS.ALL || format === OUTPUT_FORMATS.JSON) {
    const jsonPath = path.join(outputDir, `${basename}.json`);
    generateJSONReport(results, jsonPath);
    generatedFiles.push(jsonPath);
  }
  
  if (format === OUTPUT_FORMATS.ALL || format === OUTPUT_FORMATS.MARKDOWN) {
    const mdPath = path.join(outputDir, `${basename}.md`);
    generateMarkdownReport(results, mdPath, { timezone });
    generatedFiles.push(mdPath);
  }
  
  return generatedFiles;
}

module.exports = {
  generateJSONReport,
  generateMarkdownReport,
  printTerminalSummary,
  generateReports,
  ensureOutputDir,
  serializeForJSON
};
