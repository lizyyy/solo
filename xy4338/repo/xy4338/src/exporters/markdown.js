const fs = require('fs');
const path = require('path');
const config = require('../config');

class MarkdownExporter {
  constructor() {
    this.severityEmoji = {
      critical: '🔴',
      warning: '🟡',
      info: '🔵',
      error: '⚫'
    };
    
    this.severityText = {
      critical: '严重',
      warning: '警告',
      info: '提示',
      error: '错误'
    };
  }
  
  formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  
  generateInspectionHeader(inspection) {
    const statusText = {
      passed: '✅ 通过',
      warning: '⚠️ 有警告',
      failed: '❌ 未通过',
      pending: '⏳ 进行中'
    };
    
    return `# 演出资料包巡检交接单

---

## 📋 基本信息

| 项目 | 内容 |
|------|------|
| 资料包名称 | \`${inspection.package_name}\` |
| 资料包路径 | \`${inspection.package_path}\` |
| 巡检时间 | ${this.formatDate(inspection.inspected_at)} |
| 巡检状态 | **${statusText[inspection.status] || inspection.status}** |
| 总风险数 | ${inspection.total_risks} |
| 严重风险 | ${inspection.critical_risks} |
| 警告风险 | ${inspection.warning_risks} |

---
`;
  }
  
  generateRisksSection(risks) {
    if (!risks || risks.length === 0) {
      return `## ✅ 巡检结果

未发现任何风险项。

---
`;
    }
    
    const criticalRisks = risks.filter(r => r.severity === 'critical');
    const warningRisks = risks.filter(r => r.severity === 'warning');
    const infoRisks = risks.filter(r => r.severity === 'info');
    const otherRisks = risks.filter(r => 
      !['critical', 'warning', 'info'].includes(r.severity)
    );
    
    let output = `## 🚨 巡检风险明细

`;
    
    if (criticalRisks.length > 0) {
      output += `### 🔴 严重风险 (${criticalRisks.length})

| # | 类别 | 问题描述 | 关联文件 |
|---|------|----------|----------|
`;
      
      criticalRisks.forEach((risk, idx) => {
        const filePath = risk.file_path ? `\`${risk.file_path}\`` : '-';
        output += `| ${idx + 1} | ${risk.category} | ${risk.message} | ${filePath} |\n`;
        
        if (risk.details) {
          try {
            const details = typeof risk.details === 'string' ? 
              JSON.parse(risk.details) : risk.details;
            output += `\n**详情**:\n\`\`\`json\n${JSON.stringify(details, null, 2)}\n\`\`\`\n\n`;
          } catch (e) {
            output += `\n**详情**: ${risk.details}\n\n`;
          }
        }
      });
      
      output += `---

`;
    }
    
    if (warningRisks.length > 0) {
      output += `### 🟡 警告风险 (${warningRisks.length})

| # | 类别 | 问题描述 | 关联文件 |
|---|------|----------|----------|
`;
      
      warningRisks.forEach((risk, idx) => {
        const filePath = risk.file_path ? `\`${risk.file_path}\`` : '-';
        output += `| ${idx + 1} | ${risk.category} | ${risk.message} | ${filePath} |\n`;
      });
      
      output += `---

`;
    }
    
    if (infoRisks.length > 0) {
      output += `### 🔵 提示信息 (${infoRisks.length})

| # | 类别 | 描述 |
|---|------|------|
`;
      
      infoRisks.forEach((risk, idx) => {
        output += `| ${idx + 1} | ${risk.category} | ${risk.message} |\n`;
      });
      
      output += `---

`;
    }
    
    return output;
  }
  
  generateNotesSection(notes) {
    if (!notes || notes.length === 0) {
      return `## 📝 处理备注

暂无备注。

---
`;
    }
    
    let output = `## 📝 处理备注

`;
    
    notes.forEach((note, idx) => {
      output += `### 备注 ${idx + 1}

- **创建者**: ${note.created_by || 'system'}
- **创建时间**: ${this.formatDate(note.created_at)}
- **内容**: 
  > ${note.content}

`;
    });
    
    output += `---

`;
    return output;
  }
  
  generateSummary(inspection) {
    const hasCritical = inspection.critical_risks > 0;
    const hasWarning = inspection.warning_risks > 0;
    
    let summary = `## 📌 巡检结论

`;
    
    if (hasCritical) {
      summary += `⚠️ **资料包存在严重问题，必须修复后才能下发给团员。**

建议:
- 优先处理所有 🔴 严重风险
- 确认分声部乐谱是否完整
- 检查文件版本一致性

`;
    } else if (hasWarning) {
      summary += `📋 **资料包基本合格，但存在需要注意的问题。**

建议:
- 查看并处理 🟡 警告风险
- 确认是否需要补充或修正文件

`;
    } else {
      summary += `✅ **资料包检查通过，可以下发给团员。**

`;
    }
    
    summary += `---

`;
    return summary;
  }
  
  generateFooter() {
    const timestamp = new Date().toLocaleString('zh-CN');
    return `## ℹ️ 关于

此文档由 **演出资料包巡检器** 自动生成
生成时间: ${timestamp}
工具版本: ${config.app.version}

---
`;
  }
  
  export(inspectionDetails, outputPath) {
    const { inspection, risks, notes } = inspectionDetails;
    
    let markdown = this.generateInspectionHeader(inspection);
    markdown += this.generateRisksSection(risks);
    markdown += this.generateNotesSection(notes);
    markdown += this.generateSummary(inspection);
    markdown += this.generateFooter();
    
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, markdown, 'utf8');
    
    return {
      path: outputPath,
      size: Buffer.byteLength(markdown, 'utf8'),
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = MarkdownExporter;
