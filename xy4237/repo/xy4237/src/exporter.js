const fs = require('fs-extra');
const path = require('path');
const dayjs = require('dayjs');
const chalk = require('chalk');

class Exporter {
  constructor(options = {}) {
    this.options = {
      dateFormat: 'YYYY-MM-DD HH:mm:ss',
      ...options
    };
  }

  async exportAll(result, options = {}) {
    const outputDir = options.outputDir || './output';
    const formats = options.formats || ['md', 'csv', 'json'];
    const paths = {};

    await fs.ensureDir(outputDir);

    const timestamp = dayjs().format('YYYYMMDD_HHmmss');
    const baseName = `scene_check_${timestamp}`;

    for (const format of formats) {
      const fileName = `${baseName}.${format}`;
      const outputPath = path.join(outputDir, fileName);

      try {
        switch (format.toLowerCase()) {
          case 'md':
          case 'markdown':
            await this.exportMarkdown(result, outputPath);
            paths.markdown = outputPath;
            break;

          case 'csv':
            await this.exportCSV(result, outputPath);
            paths.csv = outputPath;
            break;

          case 'json':
            await this.exportJSON(result, outputPath);
            paths.json = outputPath;
            break;

          default:
            console.warn(chalk.yellow(`不支持的导出格式: ${format}`));
        }
      } catch (error) {
        console.error(chalk.red(`导出 ${format} 失败: ${error.message}`));
      }
    }

    return { paths, baseName, timestamp };
  }

  async exportMarkdown(result, outputPath) {
    const md = this._generateMarkdown(result);
    await fs.writeFile(outputPath, md, 'utf-8');
    console.log(chalk.green(`✓ Markdown巡检单已导出: ${outputPath}`));
    return outputPath;
  }

  async exportCSV(result, outputPath) {
    const csv = this._generateCSV(result);
    await fs.writeFile(outputPath, csv, 'utf-8');
    console.log(chalk.green(`✓ CSV风险表已导出: ${outputPath}`));
    return outputPath;
  }

  async exportJSON(result, outputPath) {
    const jsonData = this._generateJSON(result);
    await fs.writeJson(outputPath, jsonData, { spaces: 2 });
    console.log(chalk.green(`✓ JSON审计包已导出: ${outputPath}`));
    return outputPath;
  }

  _generateMarkdown(result) {
    const lines = [];
    const now = dayjs().format(this.options.dateFormat);

    lines.push('# 换景巡检报告');
    lines.push('');
    lines.push(`> 生成时间: ${now}`);
    lines.push(`> 演出目录: ${result.showDirectory || '未知'}`);
    lines.push(`> 巡检状态: ${result.success ? '✅ 完成' : '⚠️ 有问题'}`);
    lines.push('');

    lines.push('## 📊 执行摘要');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 总任务数 | ${result.tasks?.length || 0} |`);
    lines.push(`| 已确认 | ${result.tasks?.filter(t => t.confirmed)?.length || 0} |`);
    lines.push(`| 待确认 | ${result.tasks?.filter(t => !t.confirmed)?.length || 0} |`);
    lines.push(`| 问题数 | ${result.issues?.length || 0} |`);
    lines.push(`| 警告数 | ${result.warnings?.length || 0} |`);
    lines.push(`| 高优先级 | ${result.tasks?.filter(t => t.priority === 'high')?.length || 0} |`);
    lines.push(`| 危险道具 | ${result.tasks?.filter(t => t.isDangerous)?.length || 0} |`);
    lines.push('');

    if (result.issues && result.issues.length > 0) {
      lines.push('## ❌ 检测到的问题');
      lines.push('');
      
      result.issues.forEach((issue, index) => {
        lines.push(`### ${index + 1}. ${this._getSeverityEmoji(issue.severity)} ${issue.message}`);
        lines.push('');
        lines.push(`- **类型**: ${issue.rule || issue.type}`);
        lines.push(`- **分类**: ${issue.category || '未分类'}`);
        if (issue.task) {
          lines.push(`- **任务**: ${issue.task.name}`);
        }
        if (issue.suggestion) {
          lines.push(`- **建议**: ${issue.suggestion}`);
        }
        lines.push('');
      });
    }

    if (result.warnings && result.warnings.length > 0) {
      lines.push('## ⚠️ 警告信息');
      lines.push('');
      
      result.warnings.forEach((warning, index) => {
        lines.push(`### ${index + 1}. ${warning.message}`);
        lines.push('');
        lines.push(`- **类型**: ${warning.rule || warning.type}`);
        lines.push(`- **分类**: ${warning.category || '未分类'}`);
        if (warning.suggestion) {
          lines.push(`- **建议**: ${warning.suggestion}`);
        }
        lines.push('');
      });
    }

    lines.push('## 📋 换景任务清单');
    lines.push('');

    const byScene = this._groupByScene(result.tasks || []);
    
    for (const [scene, tasks] of Object.entries(byScene)) {
      lines.push(`### 场景: ${scene}`);
      lines.push('');
      lines.push('| 状态 | 类型 | 任务名称 | 优先级 | 负责人 | 时间 | 确认 |');
      lines.push('|------|------|----------|--------|--------|------|------|');
      
      tasks.forEach(task => {
        const status = task.confirmed ? '✅' : '⏳';
        const type = this._getTypeEmoji(task.type);
        const priority = this._getPriorityLabel(task.priority);
        const time = task.time ? `${task.time}秒` : '-';
        const confirmed = task.confirmed ? '✅ 已确认' : '❌ 待确认';
        const dangerous = task.isDangerous ? ' ⚠️危险' : '';
        
        lines.push(`| ${status} | ${type} | ${task.name}${dangerous} | ${priority} | ${task.responsible || '-'} | ${time} | ${confirmed} |`);
      });
      lines.push('');
    }

    const dangerousTasks = (result.tasks || []).filter(t => t.isDangerous);
    if (dangerousTasks.length > 0) {
      lines.push('## ⚠️ 危险道具清单');
      lines.push('');
      lines.push('| 任务名称 | 场景 | 负责人 | 确认状态 |');
      lines.push('|----------|------|--------|----------|');
      
      dangerousTasks.forEach(task => {
        const confirmed = task.confirmed ? '✅ 已确认' : '❌ 待确认';
        lines.push(`| ${task.name} | ${task.scene || '-'} | ${task.responsible || '-'} | ${confirmed} |`);
      });
      lines.push('');
    }

    const unconfirmedTasks = (result.tasks || []).filter(t => !t.confirmed);
    if (unconfirmedTasks.length > 0) {
      lines.push('## ⏳ 待确认任务');
      lines.push('');
      lines.push('| 类型 | 任务名称 | 场景 | 优先级 | 负责人 |');
      lines.push('|------|----------|------|--------|--------|');
      
      unconfirmedTasks.forEach(task => {
        const type = this._getTypeEmoji(task.type);
        const priority = this._getPriorityLabel(task.priority);
        lines.push(`| ${type} | ${task.name} | ${task.scene || '-'} | ${priority} | ${task.responsible || '-'} |`);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('*此报告由"换景清单巡检员"自动生成*');

    return lines.join('\n');
  }

  _generateCSV(result) {
    const lines = [];
    
    lines.push('类型,级别,场景,任务名称,优先级,负责人,时间,确认状态,危险道具,消息,建议');
    
    if (result.issues) {
      result.issues.forEach(issue => {
        const task = issue.task || {};
        lines.push([
          '问题',
          issue.severity || 'high',
          task.scene || '',
          task.name || '',
          task.priority || '',
          task.responsible || '',
          task.time || '',
          task.confirmed ? '已确认' : '待确认',
          task.isDangerous ? '是' : '否',
          `"${(issue.message || '').replace(/"/g, '""')}"`,
          `"${(issue.suggestion || '').replace(/"/g, '""')}"`
        ].join(','));
      });
    }

    if (result.warnings) {
      result.warnings.forEach(warning => {
        const task = warning.task || {};
        lines.push([
          '警告',
          warning.severity || 'medium',
          task.scene || '',
          task.name || '',
          task.priority || '',
          task.responsible || '',
          task.time || '',
          task.confirmed ? '已确认' : '待确认',
          task.isDangerous ? '是' : '否',
          `"${(warning.message || '').replace(/"/g, '""')}"`,
          `"${(warning.suggestion || '').replace(/"/g, '""')}"`
        ].join(','));
      });
    }

    return lines.join('\n');
  }

  _generateJSON(result) {
    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      inspection: {
        timestamp: result.timestamp,
        showDirectory: result.showDirectory,
        success: result.success
      },
      summary: {
        totalTasks: result.tasks?.length || 0,
        confirmed: result.tasks?.filter(t => t.confirmed)?.length || 0,
        unconfirmed: result.tasks?.filter(t => !t.confirmed)?.length || 0,
        issues: result.issues?.length || 0,
        warnings: result.warnings?.length || 0,
        highPriority: result.tasks?.filter(t => t.priority === 'high')?.length || 0,
        dangerous: result.tasks?.filter(t => t.isDangerous)?.length || 0
      },
      files: result.files?.map(f => ({
        name: f.name,
        path: f.path,
        category: f.category,
        size: f.size,
        modified: f.modified
      })) || [],
      tasks: (result.tasks || []).map(t => ({
        id: t.id,
        type: t.type,
        name: t.name,
        scene: t.scene,
        cue: t.cue,
        time: t.time,
        location: t.location,
        priority: t.priority,
        responsible: t.responsible,
        confirmed: t.confirmed,
        isDangerous: t.isDangerous,
        confirmation: t.confirmation
      })),
      issues: (result.issues || []).map(i => ({
        type: i.type,
        rule: i.rule,
        severity: i.severity,
        message: i.message,
        category: i.category,
        taskId: i.taskId,
        suggestion: i.suggestion
      })),
      warnings: (result.warnings || []).map(w => ({
        type: w.type,
        rule: w.rule,
        severity: w.severity,
        message: w.message,
        category: w.category,
        suggestion: w.suggestion
      })),
      confirmations: result.confirmations || []
    };
  }

  _groupByScene(tasks) {
    const groups = {};
    
    tasks.forEach(task => {
      const scene = task.scene || '未分类';
      if (!groups[scene]) {
        groups[scene] = [];
      }
      groups[scene].push(task);
    });

    return groups;
  }

  _getTypeEmoji(type) {
    const emojis = {
      prop: '📦',
      lighting: '💡',
      actor: '🎭',
      note: '📝'
    };
    return emojis[type] || '❓';
  }

  _getPriorityLabel(priority) {
    const labels = {
      high: '🔴 高',
      medium: '🟡 中',
      low: '🟢 低'
    };
    return labels[priority] || '🟡 中';
  }

  _getSeverityEmoji(severity) {
    const emojis = {
      critical: '💥',
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };
    return emojis[severity] || '⚪';
  }
}

module.exports = Exporter;
