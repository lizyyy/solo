class OutputFormatter {
  static toJSON(records) {
    return {
      generatedAt: new Date().toISOString(),
      version: '1.0',
      count: Array.isArray(records) ? records.length : 1,
      data: records
    };
  }

  static toMarkdown(records) {
    const recordArray = Array.isArray(records) ? records : [records];
    
    let markdown = '# 器熔断手册\n\n';
    markdown += `> 生成时间: ${new Date().toISOString()}\n\n`;
    markdown += `> 记录总数: ${recordArray.length}\n\n`;
    markdown += '---\n\n';

    recordArray.forEach((record, index) => {
      markdown += this._recordToMarkdown(record, index + 1);
    });

    return markdown;
  }

  static _recordToMarkdown(record, num) {
    let md = `## ${num}. ${record.title} \`${record.id}\`\n\n`;
    
    md += `| 字段 | 值 | 来源/处理依据 |\n`;
    md += `|------|-----|--------------|\n`;
    md += `| **类型** | ${record.type} | 系统自动识别 |\n`;
    md += `| **状态** | ${record.status} | ${record.fieldMetadata.status?.source || '系统状态'} |\n`;
    md += `| **严重程度** | ${record.severity} | 风险评估模型 |\n`;
    md += `| **来源** | ${record.source} | - |\n`;
    md += `| **发现时间** | ${record.detectedAt} | - |\n\n`;

    md += `### 问题描述\n\n${record.description}\n\n`;

    if (record.affectedResources && record.affectedResources.length > 0) {
      md += `### 受影响资源\n\n`;
      md += `| 资源ID | 资源名称 | 类型 | 环境 | 关键业务 |\n`;
      md += `|--------|----------|------|------|----------|\n`;
      record.affectedResources.forEach(res => {
        md += `| ${res.id} | ${res.name} | ${res.type} | ${res.environment} | ${res.businessCritical ? '是' : '否'} |\n`;
      });
      md += '\n';
    }

    if (record.candidateActions && record.candidateActions.length > 0) {
      md += `### 候选处理清单\n\n`;
      md += `> ⚠️ 以下为系统建议的处理动作，请人工审核后再执行！\n\n`;
      record.candidateActions.forEach((action, idx) => {
        md += `#### 候选动作 ${idx + 1}: \`${action.id}\`\n\n`;
        md += `- **类型**: ${action.type}\n`;
        md += `- **描述**: ${action.description}\n`;
        md += `- **目标资源**: ${action.targetResources.join(', ')}\n`;
        md += `- **建议人**: ${action.suggestedBy}\n`;
        md += `- **风险等级**: ${action.riskLevel}\n`;
        md += `- **处理依据**: ${action.justification}\n\n`;
      });
    }

    if (record.manualCorrections && record.manualCorrections.length > 0) {
      md += `### 人工修正记录\n\n`;
      md += `> ✏️ 以下为人工修正内容，保留完整审计痕迹\n\n`;
      record.manualCorrections.forEach(corr => {
        md += `#### 修正项 \`${corr.id}\`\n\n`;
        md += `- **字段路径**: \`${corr.fieldPath}\`\n`;
        md += `- **原值**: ${corr.oldValue}\n`;
        md += `- **新值**: ${corr.newValue}\n`;
        md += `- **修正人**: ${corr.correctedBy}\n`;
        md += `- **修正时间**: ${corr.correctedAt}\n`;
        md += `- **修正原因**: ${corr.reason}\n`;
        md += `- **来源证据**: ${corr.sourceEvidence}\n\n`;
      });
    }

    if (record.tags && record.tags.length > 0) {
      md += `### 标签\n\n`;
      md += record.tags.map(t => `\`${t}\``).join(' ') + '\n\n';
    }

    if (record.comments && record.comments.length > 0) {
      md += `### 评论\n\n`;
      record.comments.forEach(c => {
        md += `> **${c.author}** (${c.createdAt}): ${c.content}\n\n`;
      });
    }

    md += '---\n\n';
    return md;
  }

  static generateDownloadFilename(records, format) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const recordArray = Array.isArray(records) ? records : [records];
    const prefix = recordArray.length === 1 ? `record-${recordArray[0].id}` : `bulk-${recordArray.length}`;
    return `${prefix}-${timestamp}.${format}`;
  }
}

module.exports = OutputFormatter;