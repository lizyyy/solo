export class Exporter {
  generatePlacementReport(stateManager, rulesEngine) {
    const state = stateManager.getState();
    const allIssues = [];
    
    for (let step = 1; step <= state.maxStep; step++) {
      const stepIssues = rulesEngine.validateAll(
        state.teethData, 
        state.attachments, 
        step
      );
      allIssues.push(...stepIssues.map(issue => ({ ...issue, step })));
    }
    
    const summary = rulesEngine.getIssueSummary(allIssues);
    const attachmentsByStep = this.groupByStep(state.attachments);
    const totalAttachments = state.attachments.length;
    
    let md = `# 正畸附件放置报告\n\n`;
    md += `## 报告信息\n\n`;
    md += `- **生成时间**: ${new Date().toLocaleString('zh-CN')}\n`;
    md += `- **总步数**: ${state.maxStep}\n`;
    md += `- **总附件数**: ${totalAttachments}\n\n`;
    
    md += `## 问题汇总\n\n`;
    md += `| 类型 | 数量 |\n`;
    md += `|------|------|\n`;
    md += `| **错误** | ${summary.errors} |\n`;
    md += `| **警告** | ${summary.warnings} |\n`;
    md += `| **信息** | ${summary.infos} |\n`;
    md += `| **总计** | ${summary.total} |\n\n`;
    
    if (summary.total > 0) {
      md += `## 问题详情\n\n`;
      
      const byType = {};
      allIssues.forEach(issue => {
        if (!byType[issue.type]) {
          byType[issue.type] = [];
        }
        byType[issue.type].push(issue);
      });
      
      const typeNames = {
        'collision': '碰撞问题',
        'range_violation': '范围违规',
        'mirror_mismatch': '镜像问题',
        'missing_tooth': '缺牙问题'
      };
      
      Object.keys(byType).forEach(type => {
        const issues = byType[type];
        const errors = issues.filter(i => i.severity === 'error').length;
        const warnings = issues.filter(i => i.severity === 'warning').length;
        
        md += `### ${typeNames[type] || type} (${issues.length} 个问题)\n\n`;
        
        issues.forEach(issue => {
          const severityEmoji = issue.severity === 'error' ? '🔴' : 
                                 issue.severity === 'warning' ? '🟡' : '🔵';
          
          md += `#### ${severityEmoji} 步骤 ${issue.step}\n\n`;
          md += `${issue.message}\n\n`;
          
          if (issue.distance !== undefined) {
            md += `- 实际距离: ${issue.distance}\n`;
            md += `- 最小允许距离: ${issue.minAllowed}\n\n`;
          }
          
          if (issue.currentValue !== undefined) {
            md += `- 当前值: ${issue.currentValue}\n`;
            md += `- 允许范围: ${issue.allowedRange}\n\n`;
          }
          
          if (issue.difference !== undefined) {
            md += `- 位置差异: ${issue.difference}\n\n`;
          }
        });
      });
    } else {
      md += `✅ **所有步骤均未检测到问题**\n\n`;
    }
    
    md += `## 附件统计\n\n`;
    md += `| 步骤 | 附件数 |\n`;
    md += `|------|--------|\n`;
    
    for (let step = 1; step <= state.maxStep; step++) {
      const count = attachmentsByStep[step] ? attachmentsByStep[step].length : 0;
      md += `| ${step} | ${count} |\n`;
    }
    md += `\n`;
    
    md += `## 附件详情\n\n`;
    
    for (let step = 1; step <= state.maxStep; step++) {
      const stepAttachments = attachmentsByStep[step] || [];
      if (stepAttachments.length === 0) continue;
      
      md += `### 步骤 ${step}\n\n`;
      md += `| 附件ID | 牙位 | 类型 | 位置 (x,y,z) | 旋转 (x,y,z) | 镜像 |\n`;
      md += `|--------|------|------|--------------|--------------|------|\n`;
      
      stepAttachments.forEach(att => {
        const pos = `${att.position.x.toFixed(3)}, ${att.position.y.toFixed(3)}, ${att.position.z.toFixed(3)}`;
        const rot = `${att.rotation.x.toFixed(2)}, ${att.rotation.y.toFixed(2)}, ${att.rotation.z.toFixed(2)}`;
        const mirrored = att.isMirrored ? '是' : '否';
        
        md += `| ${att.id} | ${att.toothNumber} | ${att.type} | ${pos} | ${rot} | ${mirrored} |\n`;
      });
      md += `\n`;
    }
    
    return md;
  }

  generateIssuesCSV(stateManager, rulesEngine) {
    const state = stateManager.getState();
    const allIssues = [];
    
    for (let step = 1; step <= state.maxStep; step++) {
      const stepIssues = rulesEngine.validateAll(
        state.teethData, 
        state.attachments, 
        step
      );
      allIssues.push(...stepIssues);
    }
    
    let csv = `step,type,severity,message,affected_teeth,affected_attachments,details\n`;
    
    allIssues.forEach(issue => {
      const step = issue.step;
      const type = issue.type;
      const severity = issue.severity;
      const message = this.escapeCSV(issue.message);
      const affectedTeeth = issue.affectedTeeth ? issue.affectedTeeth.join(';') : '';
      const affectedAttachments = issue.affectedAttachments ? issue.affectedAttachments.join(';') : '';
      
      let details = '';
      if (issue.distance !== undefined) {
        details = `distance:${issue.distance};min_allowed:${issue.minAllowed}`;
      } else if (issue.currentValue !== undefined) {
        details = `current:${issue.currentValue};range:${issue.allowedRange};side:${issue.side}`;
      } else if (issue.difference !== undefined) {
        details = `difference:${issue.difference};issue:${issue.issue}`;
      } else if (issue.issue) {
        details = `issue:${issue.issue}`;
      }
      
      csv += `${step},${type},${severity},${message},${affectedTeeth},${affectedAttachments},${details}\n`;
    });
    
    return csv;
  }

  downloadReport(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportPlacementReport(stateManager, rulesEngine) {
    const content = this.generatePlacementReport(stateManager, rulesEngine);
    const timestamp = new Date().toISOString().slice(0, 10);
    this.downloadReport(content, `placement_report_${timestamp}.md`, 'text/markdown');
  }

  exportIssuesCSV(stateManager, rulesEngine) {
    const content = this.generateIssuesCSV(stateManager, rulesEngine);
    const timestamp = new Date().toISOString().slice(0, 10);
    this.downloadReport(content, `issues_${timestamp}.csv`, 'text/csv');
  }

  groupByStep(attachments) {
    const groups = {};
    attachments.forEach(att => {
      if (!groups[att.step]) {
        groups[att.step] = [];
      }
      groups[att.step].push(att);
    });
    return groups;
  }

  escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
