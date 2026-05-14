import { AuditResult, ReportFormat } from '../types';

export class ReportGenerator {
  public generate(auditResult: AuditResult, format: 'json' | 'markdown' | 'download'): ReportFormat {
    switch (format) {
      case 'json':
        return this.generateJSON(auditResult);
      case 'markdown':
        return this.generateMarkdown(auditResult);
      case 'download':
        return this.generateDownload(auditResult);
      default:
        throw new Error(`不支持的报告格式: ${format}`);
    }
  }

  private generateJSON(auditResult: AuditResult): ReportFormat {
    return {
      format: 'json',
      content: JSON.stringify(auditResult, null, 2)
    };
  }

  private generateMarkdown(auditResult: AuditResult): ReportFormat {
    const { summary, normalRecords, exceptionRecords, indexSuggestions, execution, nextSteps } = auditResult;

    const lines: string[] = [];

    lines.push('# 数据库索引建议审计报告');
    lines.push('');
    lines.push(`**生成时间**: ${new Date().toLocaleString('zh-CN')}`);
    lines.push(`**执行人员**: ${execution.executor}`);
    lines.push(`**执行时长**: ${execution.durationMs}ms`);
    lines.push('');

    lines.push('## 一、审计概览');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 工单总数 | ${summary.totalRecords} |`);
    lines.push(`| 正常记录 | ${summary.normalCount} |`);
    lines.push(`| 异常记录 | ${summary.exceptionCount} |`);
    lines.push(`| 严重异常 | ${summary.criticalCount} |`);
    lines.push(`| 主要异常 | ${summary.majorCount} |`);
    lines.push(`| 次要异常 | ${summary.minorCount} |`);
    lines.push('');

    lines.push('## 二、执行信息');
    lines.push('');
    lines.push(`- **开始时间**: ${execution.startTime.toLocaleString('zh-CN')}`);
    lines.push(`- **结束时间**: ${execution.endTime.toLocaleString('zh-CN')}`);
    lines.push(`- **执行时长**: ${execution.durationMs}ms`);
    lines.push(`- **执行人员**: ${execution.executor}`);
    lines.push('');

    lines.push('## 三、处理前后对比');
    lines.push('');
    lines.push('### 3.1 审计前状态');
    lines.push('- 未进行异常检测');
    lines.push('- 未生成索引建议');
    lines.push('- 未识别风险项');
    lines.push('');
    lines.push('### 3.2 审计后状态');
    lines.push(`- 发现 ${summary.exceptionCount} 个异常记录`);
    lines.push(`- 生成 ${indexSuggestions.length} 条索引优化建议`);
    lines.push(`- 识别 ${nextSteps.length} 个后续行动项`);
    lines.push('');

    lines.push('## 四、正常记录');
    lines.push('');
    if (normalRecords.length === 0) {
      lines.push('无正常记录');
    } else {
      normalRecords.forEach(wo => {
        lines.push(`### ${wo.orderNo}: ${wo.title}`);
        lines.push(`- **来源系统**: ${wo.sourceSystem}`);
        lines.push(`- **状态**: ${wo.status}`);
        lines.push(`- **创建人**: ${wo.createdBy}`);
        lines.push(`- **创建时间**: ${wo.createdAt.toLocaleString('zh-CN')}`);
        lines.push(`- **附件数量**: ${wo.attachments.length} 个（均有效）`);
        lines.push('');
      });
    }

    lines.push('## 五、异常记录');
    lines.push('');
    if (exceptionRecords.length === 0) {
      lines.push('无异常记录');
    } else {
      lines.push('| 工单ID | 异常类型 | 严重程度 | 消息 | 发现时间 |');
      lines.push('|--------|----------|----------|------|----------|');
      exceptionRecords.forEach(ex => {
        lines.push(`| ${ex.workOrderId} | ${ex.type} | ${ex.severity} | ${ex.message} | ${ex.discoveredAt.toLocaleString('zh-CN')} |`);
      });
      lines.push('');

      lines.push('### 5.1 异常详情');
      lines.push('');
      exceptionRecords.forEach((ex, idx) => {
        lines.push(`#### ${idx + 1}. ${ex.message}`);
        lines.push(`- **严重程度**: ${ex.severity === 'critical' ? '严重' : ex.severity === 'major' ? '主要' : '次要'}`);
        lines.push(`- **异常类型**: ${ex.type === 'attachment_expired' ? '附件过期' : ex.type}`);
        lines.push('- **详细信息**:');
        Object.entries(ex.details).forEach(([key, value]) => {
          lines.push(`  - ${key}: ${value}`);
        });
        lines.push('');
      });
    }

    lines.push('## 六、索引优化建议');
    lines.push('');
    if (indexSuggestions.length === 0) {
      lines.push('无索引优化建议');
    } else {
      lines.push('| 表名 | 列名 | 索引类型 | 建议类型 | 原因 | 预期收益 | 置信度 |');
      lines.push('|------|------|----------|----------|------|----------|--------|');
      indexSuggestions.forEach(sug => {
        lines.push(`| ${sug.tableName} | ${sug.columnName} | ${sug.indexType} | ${sug.suggestionType} | ${sug.reason} | ${sug.estimatedBenefit}% | ${sug.confidence} |`);
      });
    }
    lines.push('');

    lines.push('## 七、下一步建议');
    lines.push('');
    lines.push('| 优先级 | 行动 | 描述 | 预计时间 | 负责人 |');
    lines.push('|--------|------|------|----------|--------|');
    nextSteps.forEach(step => {
      const priorityText = step.priority === 'high' ? '高' : step.priority === 'medium' ? '中' : '低';
      lines.push(`| ${priorityText} | ${step.action} | ${step.description} | ${step.estimatedTime} | ${step.responsible} |`);
    });
    lines.push('');

    lines.push('---');
    lines.push('*报告由数据库索引建议审计系统自动生成*');

    return {
      format: 'markdown',
      content: lines.join('\n')
    };
  }

  private generateDownload(auditResult: AuditResult): ReportFormat {
    const jsonReport = this.generateJSON(auditResult);
    const markdownReport = this.generateMarkdown(auditResult);

    const downloadContent = {
      fileName: `audit-report-${Date.now()}.zip`,
      formats: {
        json: JSON.parse(jsonReport.content),
        markdown: markdownReport.content
      },
      generatedAt: new Date().toISOString(),
      version: '1.0.0'
    };

    return {
      format: 'download',
      content: JSON.stringify(downloadContent, null, 2)
    };
  }

  public failRecordsToJSON(exceptionRecords: AuditResult['exceptionRecords']): string {
    return JSON.stringify(exceptionRecords, null, 2);
  }

  public failRecordsToMarkdown(exceptionRecords: AuditResult['exceptionRecords']): string {
    const lines: string[] = [];
    lines.push('# 失败项清单');
    lines.push('');
    lines.push(`**生成时间**: ${new Date().toLocaleString('zh-CN')}`);
    lines.push(`**总失败数**: ${exceptionRecords.length}`);
    lines.push('');

    lines.push('## 失败项详情');
    lines.push('');

    exceptionRecords.forEach((ex, idx) => {
      lines.push(`### ${idx + 1}. ${ex.message}`);
      lines.push(`- **ID**: ${ex.id}`);
      lines.push(`- **工单ID**: ${ex.workOrderId}`);
      lines.push(`- **异常类型**: ${ex.type}`);
      lines.push(`- **严重程度**: ${ex.severity}`);
      lines.push(`- **发现时间**: ${ex.discoveredAt.toLocaleString('zh-CN')}`);
      lines.push('- **详细信息**:');
      Object.entries(ex.details).forEach(([key, value]) => {
        lines.push(`  - ${key}: ${value instanceof Date ? value.toLocaleString('zh-CN') : value}`);
      });
      lines.push('');
    });

    return lines.join('\n');
  }
}
