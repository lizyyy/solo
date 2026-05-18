import fs from 'fs/promises';
import path from 'path';

export class Reporter {
  constructor(outputDir) {
    this.outputDir = outputDir;
  }

  async generate(result) {
    await fs.mkdir(this.outputDir, { recursive: true });

    await Promise.all([
      this.generateSummaryReport(result),
      this.generateDifferenceReport(result),
      this.generateExceptionReport(result),
      this.generateConsoleOutput(result)
    ]);

    return {
      outputDir: this.outputDir,
      files: [
        'summary.md',
        'differences.json',
        'exceptions.md'
      ]
    };
  }

  async generateSummaryReport(result) {
    const { summary, metadata } = result;
    const lines = [];

    lines.push('# 机器人消息样本模板灰度差异报告');
    lines.push('');
    lines.push(`> 生成工具: ${metadata.toolName}`);
    lines.push(`> 生成时间: ${new Date(metadata.generatedAt).toLocaleString('zh-CN')}`);
    lines.push(`> 版本: ${metadata.version}`);
    lines.push('');

    lines.push('## 一、总体概览');
    lines.push('');
    lines.push('| 指标 | 旧版本 | 新版本 | 差异 |');
    lines.push('|------|--------|--------|------|');
    lines.push(`| 总记录数 | ${summary.totalRecords.old} | ${summary.totalRecords.new} | ${this.formatDiff(summary.totalRecords.diff)} |`);
    lines.push(`| 差异总数 | - | - | ${summary.totalDifferences} |`);
    lines.push('');

    lines.push('## 二、差异类型分布');
    lines.push('');
    lines.push('| 差异类型 | 数量 | 说明 |');
    lines.push('|----------|------|------|');
    for (const [type, count] of Object.entries(summary.differenceBreakdown)) {
      lines.push(`| ${type} | ${count} | ${this.getDiffTypeDescription(type)} |`);
    }
    lines.push('');

    lines.push('## 三、触达状态统计');
    lines.push('');
    lines.push('| 触达状态 | 旧版本 | 新版本 | 差异 |');
    lines.push('|----------|--------|--------|------|');
    for (const [status, stats] of Object.entries(summary.statusStats)) {
      lines.push(`| ${status} | ${stats.old} | ${stats.new} | ${this.formatDiff(stats.diff)} |`);
    }
    lines.push('');

    lines.push('## 四、模板维度差异');
    lines.push('');
    for (const [templateId, template] of Object.entries(summary.templates)) {
      lines.push(`### ${template.templateName} (${templateId})`);
      lines.push(`- 差异总数: ${template.totalDifferences}`);
      lines.push('- 差异分布:');
      for (const [type, count] of Object.entries(template.byType)) {
        lines.push(`  - ${type}: ${count}`);
      }
      lines.push('');
    }

    lines.push('## 五、群维度差异');
    lines.push('');
    for (const [chatId, chat] of Object.entries(summary.chats)) {
      lines.push(`### ${chat.chatName} (${chatId})`);
      lines.push(`- 差异总数: ${chat.totalDifferences}`);
      if (chat.totalDifferences > 0) {
        lines.push('- 差异分布:');
        for (const [type, count] of Object.entries(chat.byType)) {
          lines.push(`  - ${type}: ${count}`);
        }
      }
      lines.push('');
    }

    const filePath = path.join(this.outputDir, 'summary.md');
    await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
  }

  async generateDifferenceReport(result) {
    const filePath = path.join(this.outputDir, 'differences.json');
    await fs.writeFile(filePath, JSON.stringify(result.differences, null, 2), 'utf-8');
  }

  async generateExceptionReport(result) {
    const { parseErrors, parseWarnings, differences, metadata } = result;
    const lines = [];

    lines.push('# 机器人消息样本模板灰度差异 - 异常报告');
    lines.push('');
    lines.push(`> 生成工具: ${metadata.toolName}`);
    lines.push(`> 生成时间: ${new Date(metadata.generatedAt).toLocaleString('zh-CN')}`);
    lines.push('');

    const allOldErrors = parseErrors.old;
    const allNewErrors = parseErrors.new;
    const allOldWarnings = parseWarnings.old;
    const allNewWarnings = parseWarnings.new;

    lines.push('## 一、解析错误');
    lines.push('');

    if (allOldErrors.length === 0 && allNewErrors.length === 0) {
      lines.push('✅ 无解析错误');
      lines.push('');
    } else {
      if (allOldErrors.length > 0) {
        lines.push('### 旧版本解析错误');
        lines.push('');
        for (const error of allOldErrors) {
          lines.push(`#### ${error.type}`);
          lines.push(`- 文件: ${error.path || error.file || '未知'}`);
          lines.push(`- 描述: ${error.message}`);
          if (error.missingFields) {
            lines.push(`- 缺失字段: ${error.missingFields.join(', ')}`);
          }
          lines.push('');
        }
      }

      if (allNewErrors.length > 0) {
        lines.push('### 新版本解析错误');
        lines.push('');
        for (const error of allNewErrors) {
          lines.push(`#### ${error.type}`);
          lines.push(`- 文件: ${error.path || error.file || '未知'}`);
          lines.push(`- 描述: ${error.message}`);
          if (error.missingFields) {
            lines.push(`- 缺失字段: ${error.missingFields.join(', ')}`);
          }
          lines.push('');
        }
      }
    }

    lines.push('## 二、解析警告');
    lines.push('');

    if (allOldWarnings.length === 0 && allNewWarnings.length === 0) {
      lines.push('✅ 无解析警告');
      lines.push('');
    } else {
      if (allOldWarnings.length > 0) {
        lines.push('### 旧版本解析警告');
        lines.push('');
        for (const warning of allOldWarnings) {
          lines.push(`#### ${warning.type}`);
          lines.push(`- 文件: ${warning.path || warning.file || '未知'}`);
          if (warning.line) {
            lines.push(`- 行号: ${warning.line}`);
          }
          lines.push(`- 描述: ${warning.message}`);
          if (warning.templateId) {
            lines.push(`- 模板ID: ${warning.templateId}`);
          }
          if (warning.chatId) {
            lines.push(`- 群ID: ${warning.chatId}`);
          }
          lines.push('');
        }
      }

      if (allNewWarnings.length > 0) {
        lines.push('### 新版本解析警告');
        lines.push('');
        for (const warning of allNewWarnings) {
          lines.push(`#### ${warning.type}`);
          lines.push(`- 文件: ${warning.path || warning.file || '未知'}`);
          if (warning.line) {
            lines.push(`- 行号: ${warning.line}`);
          }
          lines.push(`- 描述: ${warning.message}`);
          if (warning.templateId) {
            lines.push(`- 模板ID: ${warning.templateId}`);
          }
          if (warning.chatId) {
            lines.push(`- 群ID: ${warning.chatId}`);
          }
          lines.push('');
        }
      }
    }

    lines.push('## 三、需关注的业务差异');
    lines.push('');

    const criticalDiffs = differences.filter(d =>
      d.type === 'RECORD_MISSING_IN_NEW' ||
      d.type === 'VARIABLE_REMOVED' ||
      d.type === 'TOUCH_STATUS_CHANGED'
    );

    if (criticalDiffs.length === 0) {
      lines.push('✅ 无关键业务差异');
    } else {
      lines.push(`共 ${criticalDiffs.length} 个关键差异需要关注:`);
      lines.push('');
      for (const diff of criticalDiffs) {
        lines.push(`### ${diff.type}`);
        lines.push(`- 模板: ${diff.templateName} (${diff.templateId})`);
        lines.push(`- 群: ${diff.chatName} (${diff.chatId})`);
        lines.push(`- 描述: ${diff.message}`);
        if (diff.oldStatus !== undefined) {
          lines.push(`- 旧状态: ${diff.oldStatus}`);
        }
        if (diff.newStatus !== undefined) {
          lines.push(`- 新状态: ${diff.newStatus}`);
        }
        if (diff.variableName) {
          lines.push(`- 变量名: ${diff.variableName}`);
        }
        lines.push('');
      }
    }

    const filePath = path.join(this.outputDir, 'exceptions.md');
    await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
  }

  generateConsoleOutput(result) {
    const { summary, parseErrors, parseWarnings, metadata } = result;

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           机器人消息样本模板灰度差异CLI 执行结果              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    console.log('📊 总体统计:');
    console.log(`   旧版本记录数: ${summary.totalRecords.old}`);
    console.log(`   新版本记录数: ${summary.totalRecords.new}`);
    console.log(`   差异总数: ${summary.totalDifferences}`);
    console.log('');

    if (Object.keys(summary.differenceBreakdown).length > 0) {
      console.log('📋 差异类型分布:');
      for (const [type, count] of Object.entries(summary.differenceBreakdown)) {
        console.log(`   ${type}: ${count}`);
      }
      console.log('');
    }

    const totalErrors = parseErrors.old.length + parseErrors.new.length;
    const totalWarnings = parseWarnings.old.length + parseWarnings.new.length;

    console.log('⚠️ 异常统计:');
    console.log(`   解析错误: ${totalErrors}`);
    console.log(`   解析警告: ${totalWarnings}`);
    console.log('');

    if (totalErrors > 0 || totalWarnings > 0) {
      console.log('🔍 请查看 exceptions.md 了解详细异常信息');
    }

    console.log('📁 输出文件:');
    console.log(`   - ${path.join(this.outputDir, 'summary.md')}`);
    console.log(`   - ${path.join(this.outputDir, 'differences.json')}`);
    console.log(`   - ${path.join(this.outputDir, 'exceptions.md')}`);
    console.log('');

    return {
      totalRecords: summary.totalRecords,
      totalDifferences: summary.totalDifferences,
      totalErrors,
      totalWarnings
    };
  }

  formatDiff(diff) {
    if (diff > 0) return `+${diff}`;
    if (diff < 0) return `${diff}`;
    return '0';
  }

  getDiffTypeDescription(type) {
    const descriptions = {
      'RECORD_MISSING_IN_NEW': '记录在新版本中缺失',
      'NEW_RECORD_ADDED': '新版本新增记录',
      'TOUCH_STATUS_CHANGED': '触达状态发生变化',
      'VARIABLE_ADDED': '新增模板变量',
      'VARIABLE_REMOVED': '模板变量缺失',
      'VARIABLE_VALUE_CHANGED': '模板变量值发生变化',
      'GROUP_MIGRATED': '群已迁移'
    };
    return descriptions[type] || type;
  }
}

export default Reporter;
