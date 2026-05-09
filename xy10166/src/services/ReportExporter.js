const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

class ReportExporter {
  constructor() {
    this.outputDir = path.join(process.cwd(), 'data', 'output');
    this._ensureDirectory();
  }

  _ensureDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async exportJSONReport(checkResult, options = {}) {
    const { includeDetails = true } = options;
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const fileName = `conflict_report_${timestamp}.json`;
    const filePath = path.join(this.outputDir, fileName);

    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalAppointments: checkResult.totalAppointments,
        checkedAppointments: checkResult.checkedAppointments,
        midnightAppointments: checkResult.midnightAppointments || 0,
        conflictCount: checkResult.conflicts ? checkResult.conflicts.length : 0,
        statistics: checkResult.statistics || {}
      },
      message: checkResult.message
    };

    if (includeDetails && checkResult.conflicts) {
      report.conflicts = checkResult.conflicts;
      report.repairSuggestions = this._generateRepairSuggestions(checkResult.conflicts);
    }

    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');

    return {
      filePath,
      fileName,
      format: 'json',
      conflictCount: report.summary.conflictCount
    };
  }

  async exportMarkdownReport(checkResult, options = {}) {
    const { includeDetails = true } = options;
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const fileName = `conflict_report_${timestamp}.md`;
    const filePath = path.join(this.outputDir, fileName);

    let mdContent = `# 诊疗预约冲突检测报告\n\n`;
    mdContent += `> 生成时间：${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n\n`;
    mdContent += `> 检测结果：${checkResult.message}\n\n`;

    mdContent += `## 统计概览\n\n`;
    mdContent += `| 指标 | 数值 |\n`;
    mdContent += `|------|------|\n`;
    mdContent += `| 总预约数 | ${checkResult.totalAppointments} |\n`;
    mdContent += `| 实际检测数 | ${checkResult.checkedAppointments} |\n`;
    mdContent += `| 跨午夜预约 | ${checkResult.midnightAppointments || 0} |\n`;
    mdContent += `| 冲突总数 | ${checkResult.conflicts ? checkResult.conflicts.length : 0} |\n\n`;

    const stats = checkResult.statistics || {};
    mdContent += `### 按资源类型\n\n`;
    mdContent += `| 资源类型 | 冲突数 |\n`;
    mdContent += `|----------|--------|\n`;
    mdContent += `| 医生 | ${stats.byType?.doctor || 0} |\n`;
    mdContent += `| 诊室 | ${stats.byType?.room || 0} |\n`;
    mdContent += `| 设备 | ${stats.byType?.equipment || 0} |\n\n`;

    mdContent += `### 按严重程度\n\n`;
    mdContent += `| 严重程度 | 冲突数 |\n`;
    mdContent += `|----------|--------|\n`;
    mdContent += `| 严重 | ${stats.bySeverity?.high || 0} |\n`;
    mdContent += `| 中等 | ${stats.bySeverity?.medium || 0} |\n`;
    mdContent += `| 轻微 | ${stats.bySeverity?.low || 0} |\n\n`;

    if (includeDetails && checkResult.conflicts && checkResult.conflicts.length > 0) {
      mdContent += `## 冲突详情\n\n`;
      
      const sortedConflicts = [...checkResult.conflicts].sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });

      for (let i = 0; i < sortedConflicts.length; i++) {
        const conflict = sortedConflicts[i];
        mdContent += `### 冲突 #${i + 1}\n\n`;
        mdContent += `**严重程度：** ${this._formatSeverity(conflict.severity)}\n\n`;
        mdContent += `**资源类型：** ${this._formatResourceType(conflict.resourceType)} (${conflict.resourceId})\n\n`;
        mdContent += `**重叠时间：** ${conflict.overlapMinutes} 分钟\n\n`;
        mdContent += `**描述：** ${conflict.description}\n\n`;
        
        mdContent += `**涉及预约：**\n\n`;
        for (const slot of conflict.affectedSlots || []) {
          mdContent += `- ${slot.patientName} (${slot.patientId}): ${slot.startTime} ~ ${slot.endTime}`;
          if (slot.isSplit) mdContent += ` (跨午夜拆分)`;
          mdContent += `\n`;
        }
        
        mdContent += `\n`;
      }

      mdContent += `## 修复建议\n\n`;
      const suggestions = this._generateRepairSuggestions(checkResult.conflicts);
      
      for (let i = 0; i < suggestions.length; i++) {
        const s = suggestions[i];
        mdContent += `### 建议 #${i + 1}\n\n`;
        mdContent += `**问题：** ${s.problem}\n\n`;
        mdContent += `**建议：** ${s.suggestion}\n\n`;
        mdContent += `**涉及资源：** ${this._formatResourceType(s.resourceType)} (${s.resourceId})\n\n`;
      }
    }

    fs.writeFileSync(filePath, mdContent, 'utf-8');

    return {
      filePath,
      fileName,
      format: 'markdown',
      conflictCount: checkResult.conflicts ? checkResult.conflicts.length : 0
    };
  }

  _formatSeverity(severity) {
    const map = {
      high: '🔴 严重',
      medium: '🟡 中等',
      low: '🟢 轻微'
    };
    return map[severity] || severity;
  }

  _formatResourceType(type) {
    const map = {
      doctor: '医生',
      room: '诊室',
      equipment: '设备'
    };
    return map[type] || type;
  }

  _generateRepairSuggestions(conflicts) {
    const resourceGroups = {};
    
    for (const conflict of conflicts) {
      const key = `${conflict.resourceType}_${conflict.resourceId}`;
      if (!resourceGroups[key]) {
        resourceGroups[key] = {
          resourceType: conflict.resourceType,
          resourceId: conflict.resourceId,
          conflicts: [],
          highestSeverity: conflict.severity
        };
      }
      resourceGroups[key].conflicts.push(conflict);
      
      const severityOrder = { high: 3, medium: 2, low: 1 };
      if (severityOrder[conflict.severity] > severityOrder[resourceGroups[key].highestSeverity]) {
        resourceGroups[key].highestSeverity = conflict.severity;
      }
    }

    const suggestions = [];
    const sortedGroups = Object.values(resourceGroups).sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      if (severityOrder[b.highestSeverity] !== severityOrder[a.highestSeverity]) {
        return severityOrder[b.highestSeverity] - severityOrder[a.highestSeverity];
      }
      return b.conflicts.length - a.conflicts.length;
    });

    for (const group of sortedGroups) {
      const suggestion = {
        resourceType: group.resourceType,
        resourceId: group.resourceId,
        conflictCount: group.conflicts.length,
        problem: this._generateProblemDescription(group),
        suggestion: this._generateSpecificSuggestion(group)
      };
      suggestions.push(suggestion);
    }

    return suggestions;
  }

  _generateProblemDescription(group) {
    const resourceName = this._formatResourceType(group.resourceType);
    const count = group.conflicts.length;
    
    if (count === 1) {
      return `${resourceName} ${group.resourceId} 存在 1 个时间冲突`;
    }
    return `${resourceName} ${group.resourceId} 在多个时间段存在 ${count} 个冲突`;
  }

  _generateSpecificSuggestion(group) {
    const type = group.resourceType;
    const count = group.conflicts.length;
    
    const baseSuggestions = {
      doctor: [
        `建议将冲突的预约调整到该医生的其他空闲时段`,
        `如果可能，考虑安排其他同科室医生接诊`,
        `对于紧急加号，可考虑延长门诊时间`
      ],
      room: [
        `建议调整冲突预约的时间安排`,
        `考虑使用其他可用的诊室`,
        `优化诊室使用顺序，缩短就诊间隙`
      ],
      equipment: [
        `建议调整检查顺序，使用时间间隔策略`,
        `如果有同类设备，考虑设备调配`,
        `对于紧急患者，可考虑临时加急`
      ]
    };

    const typeSuggestions = baseSuggestions[type] || baseSuggestions.doctor;
    
    if (count === 1) {
      return typeSuggestions[0];
    } else if (count === 2) {
      return `${typeSuggestions[0]}。${typeSuggestions[1]}`;
    }
    return `${typeSuggestions[0]}。${typeSuggestions[1]}。${typeSuggestions[2]}`;
  }
}

module.exports = ReportExporter;
