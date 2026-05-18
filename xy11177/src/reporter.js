import fs from 'fs/promises';
import path from 'path';

export class ReportGenerator {
  constructor(logger) {
    this.logger = logger;
  }

  async generateReport(dispatches, validationResult, outputPath) {
    this.logger.verbose('开始生成派单报告...');
    
    const report = this.buildReport(dispatches, validationResult);
    const markdown = this.formatMarkdown(report);
    
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(outputPath, markdown, 'utf-8');
    
    this.logger.log(`报告已生成: ${outputPath}`);
    return report;
  }

  buildReport(dispatches, validationResult) {
    const { duplicates, errors, warnings } = validationResult;
    
    const urgentRepairs = dispatches.filter(d => d.priority === 'urgent');
    const normalRepairs = dispatches.filter(d => d.priority === 'normal');
    
    const byType = this.groupBy(dispatches, 'repairType');
    const byTech = this.groupBy(dispatches, 'assignedTo');
    const byArea = this.groupBy(dispatches, 'area');
    
    return {
      generatedAt: new Date().toLocaleString('zh-CN'),
      summary: {
        totalProcessed: dispatches.length + duplicates.length,
        totalDispatched: dispatches.length,
        urgentCount: urgentRepairs.length,
        normalCount: normalRepairs.length,
        duplicateCount: duplicates.length,
        errorCount: errors.length,
        warningCount: warnings.length
      },
      urgentRepairs: this.formatRepairList(urgentRepairs),
      normalRepairs: this.formatRepairList(normalRepairs),
      duplicates: duplicates,
      errors: errors,
      warnings: warnings,
      byType: byType,
      byTech: byTech,
      byArea: byArea
    };
  }

  groupBy(items, key) {
    return items.reduce((acc, item) => {
      const value = item[key] || '未指定';
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  formatRepairList(repairs) {
    return repairs.map(r => ({
      id: r.id,
      dormNumber: r.dormNumber,
      repairType: r.repairType,
      description: r.description,
      reporter: r.reporter,
      assignedTo: r.assignedTo,
      reportTime: new Date(r.reportTime).toLocaleString('zh-CN')
    }));
  }

  formatMarkdown(report) {
    return `# 校园宿舍维修派单报告

生成时间: ${report.generatedAt}

## 一、处理概览

| 指标 | 数量 |
|------|------|
| 报修单总数 | ${report.summary.totalProcessed} |
| 成功派单 | ${report.summary.totalDispatched} |
| 急修单 | ${report.summary.urgentCount} |
| 普通报修 | ${report.summary.normalCount} |
| 重复报修 | ${report.summary.duplicateCount} |
| 数据错误 | ${report.summary.errorCount} |
| 数据警告 | ${report.summary.warningCount} |

## 二、重点问题清单

### 2.1 重复报修记录

${report.duplicates.length > 0 ? 
  report.duplicates.map(d => `- **报修单 ${d.id}** 重复于 ${d.duplicateOf} (${d.reason}) - 宿舍: ${d.dormNumber}, 类型: ${d.repairType}`).join('\n') :
  '- 无重复报修'}

### 2.2 急修单优先处理

${report.urgentRepairs.length > 0 ?
  report.urgentRepairs.map(r => `- **${r.id}** | 宿舍 ${r.dormNumber} | ${r.repairType} | ${r.assignedTo} | ${r.description}`).join('\n') :
  '- 无急修单'}

## 三、派单详情

### 3.1 按维修类型统计

${Object.entries(report.byType).map(([type, count]) => `- ${type}: ${count} 单`).join('\n')}

### 3.2 按维修师傅统计

${Object.entries(report.byTech).map(([tech, count]) => `- ${tech}: ${count} 单`).join('\n')}

### 3.3 按区域统计

${Object.entries(report.byArea).map(([area, count]) => `- ${area}: ${count} 单`).join('\n')}

## 四、完整派单列表

### 4.1 急修单

${report.urgentRepairs.length > 0 ? `
| 单号 | 宿舍 | 类型 | 报修人 | 派给 | 报修时间 | 描述 |
|------|------|------|--------|------|----------|------|
${report.urgentRepairs.map(r => `| ${r.id} | ${r.dormNumber} | ${r.repairType} | ${r.reporter} | ${r.assignedTo} | ${r.reportTime} | ${r.description} |`).join('\n')}
` : '无急修单'}

### 4.2 普通报修单

${report.normalRepairs.length > 0 ? `
| 单号 | 宿舍 | 类型 | 报修人 | 派给 | 报修时间 | 描述 |
|------|------|------|--------|------|----------|------|
${report.normalRepairs.map(r => `| ${r.id} | ${r.dormNumber} | ${r.repairType} | ${r.reporter} | ${r.assignedTo} | ${r.reportTime} | ${r.description} |`).join('\n')}
` : '无普通报修单'}

## 五、数据问题记录

### 5.1 错误

${report.errors.length > 0 ?
  report.errors.map(e => `- **${e.id}** ${e.field}: ${e.message}`).join('\n') :
  '- 无错误'}

### 5.2 警告

${report.warnings.length > 0 ?
  report.warnings.map(w => `- **${w.id}** ${w.field}: ${w.message}`).join('\n') :
  '- 无警告'}
`;
  }
}
