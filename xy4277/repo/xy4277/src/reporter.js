const fs = require('fs');
const path = require('path');

const RISK_ICONS = {
  CRITICAL: '🔴',
  HIGH: '🟠',
  MEDIUM: '🟡',
  LOW: '🟢',
  OK: '✅'
};

const RISK_LABELS_CN = {
  CRITICAL: '严重',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
  OK: '正常'
};

const RULE_DESCRIPTIONS = {
  AUTH_EXPIRED: '授权已过期',
  AUTH_EXPIRING_SOON: '授权即将到期',
  DURATION_EXCEEDED: '使用时长超过授权限制',
  MISSING_SOURCE: '缺少源文件',
  MISSING_AUTH: '缺少授权合同',
  MISSING_IN_MANIFEST: '未在素材清单中列出',
  NAMING_VIOLATION: '命名不合规',
  UNUSED_MATERIAL: '素材未使用',
  NO_CONTRACT_LIMIT: '合同时长限制无法解析',
  DATE_FORMAT_INVALID: '日期格式无效'
};

class Reporter {
  constructor(options = {}) {
    this.options = {
      projectName: options.projectName || '未命名项目',
      generatedBy: options.generatedBy || '素材授权交付核对器',
      timezone: options.timezone || 'Asia/Shanghai',
      ...options
    };
  }

  generateJSON(validationResult, parsedData, scanResult) {
    const report = {
      meta: {
        projectName: this.options.projectName,
        generatedAt: new Date().toISOString(),
        generatedBy: this.options.generatedBy,
        toolVersion: '1.0.0'
      },
      summary: {
        ...validationResult.summary,
        highestRiskLabel: RISK_LABELS_CN[validationResult.summary.highestRisk] || validationResult.summary.highestRisk
      },
      materials: [],
      violations: [],
      warnings: [],
      gaps: validationResult.gaps,
      sources: {
        materialList: parsedData.materialList ? {
          fileName: parsedData.materialList.fileName,
          source: parsedData.materialList.source,
          count: parsedData.materialList.materials.length
        } : null,
        authData: parsedData.authData ? {
          fileName: parsedData.authData.fileName,
          source: parsedData.authData.source,
          count: parsedData.authData.contracts.length
        } : null,
        edlData: parsedData.edlData ? {
          fileName: parsedData.edlData.fileName,
          source: parsedData.edlData.source,
          title: parsedData.edlData.title,
          eventCount: parsedData.edlData.events.length
        } : null,
        mediaFiles: scanResult && scanResult.media ? scanResult.media.map(f => ({
          name: f.name,
          relativePath: f.relativePath,
          size: f.size
        })) : []
      }
    };

    for (const [materialId, item] of Object.entries(validationResult.byMaterialId)) {
      const materialInfo = {
        materialId,
        riskLevel: item.riskLevel,
        riskLabel: RISK_LABELS_CN[item.riskLevel] || item.riskLevel,
        hasMaterial: !!item.material,
        hasContracts: item.contracts.length > 0,
        contractCount: item.contracts.length,
        hasEDEvents: item.edlEvents.length > 0,
        edlEventCount: item.edlEvents.length,
        hasMediaFiles: item.mediaFiles.length > 0,
        mediaFileCount: item.mediaFiles.length,
        violationCount: item.violations.length,
        warningCount: item.warnings.length,
        violations: item.violations,
        warnings: item.warnings,
        material: item.material ? this._sanitizeMaterial(item.material) : null,
        contracts: item.contracts.map(c => this._sanitizeContract(c)),
        edlEvents: item.edlEvents.map(e => this._sanitizeEDLEvent(e)),
        mediaFiles: item.mediaFiles.map(f => this._sanitizeMediaFile(f))
      };
      report.materials.push(materialInfo);

      for (const v of item.violations) {
        report.violations.push({
          materialId,
          ...v
        });
      }
      for (const w of item.warnings) {
        report.warnings.push({
          materialId,
          ...w
        });
      }
    }

    report.violations.sort((a, b) => b.riskValue - a.riskValue);
    report.warnings.sort((a, b) => b.riskValue - a.riskValue);
    report.materials.sort((a, b) => {
      const priority = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, OK: 4 };
      return (priority[a.riskLevel] || 99) - (priority[b.riskLevel] || 99);
    });

    return report;
  }

  generateMarkdown(validationResult, parsedData, scanResult) {
    const jsonReport = this.generateJSON(validationResult, parsedData, scanResult);
    
    const lines = [];

    lines.push(`# ${this.options.projectName} - 素材授权交付核对报告`);
    lines.push('');
    lines.push(`> 生成时间: ${this._formatDateTime(new Date())}`);
    lines.push(`> 生成工具: ${this.options.generatedBy} v1.0.0`);
    lines.push('');

    lines.push('## 📊 执行摘要');
    lines.push('');
    
    const riskEmoji = RISK_ICONS[jsonReport.summary.highestRisk] || '❓';
    const riskLabel = RISK_LABELS_CN[jsonReport.summary.highestRisk] || jsonReport.summary.highestRisk;
    
    lines.push(`| 指标 | 数值 |`);
    lines.push(`|------|------|`);
    lines.push(`| **最高风险等级** | ${riskEmoji} ${riskLabel} |`);
    lines.push(`| **素材总数** | ${jsonReport.summary.totalMaterials} |`);
    lines.push(`| **合同总数** | ${jsonReport.summary.totalContracts} |`);
    lines.push(`| **时间线事件数** | ${jsonReport.summary.totalEDLEvents} |`);
    lines.push(`| **媒体文件数** | ${jsonReport.summary.totalMediaFiles} |`);
    lines.push(`| **违规问题数** | 🔴 ${jsonReport.summary.violations} |`);
    lines.push(`| **警告数** | 🟡 ${jsonReport.summary.warnings} |`);
    lines.push('');

    if (jsonReport.violations.length > 0) {
      lines.push('## 🔴 违规问题 (Violations)');
      lines.push('');
      
      const grouped = this._groupByRisk(jsonReport.violations);
      
      for (const [risk, items] of Object.entries(grouped)) {
        if (items.length === 0) continue;
        lines.push(`### ${RISK_ICONS[risk] || '❓'} ${RISK_LABELS_CN[risk] || risk} (${items.length}项)`);
        lines.push('');
        
        for (const item of items) {
          lines.push(`- **[${item.materialId || '全局'}]** ${item.message}`);
          if (item.code && RULE_DESCRIPTIONS[item.code]) {
            lines.push(`  - 规则: ${RULE_DESCRIPTIONS[item.code]} (${item.code})`);
          }
        }
        lines.push('');
      }
    }

    if (jsonReport.warnings.length > 0) {
      lines.push('## 🟡 警告信息 (Warnings)');
      lines.push('');
      
      const grouped = this._groupByRisk(jsonReport.warnings);
      
      for (const [risk, items] of Object.entries(grouped)) {
        if (items.length === 0) continue;
        lines.push(`### ${RISK_ICONS[risk] || '❓'} ${RISK_LABELS_CN[risk] || risk} (${items.length}项)`);
        lines.push('');
        
        for (const item of items) {
          lines.push(`- **[${item.materialId || '全局'}]** ${item.message}`);
          if (item.code && RULE_DESCRIPTIONS[item.code]) {
            lines.push(`  - 规则: ${RULE_DESCRIPTIONS[item.code]} (${item.code})`);
          }
        }
        lines.push('');
      }
    }

    if (jsonReport.gaps && jsonReport.gaps.length > 0) {
      lines.push('## ⚠️ 缺口清单');
      lines.push('');
      
      for (const gap of jsonReport.gaps) {
        lines.push(`- **[${gap.type}]** ${gap.message}`);
        if (gap.files && gap.files.length > 0) {
          lines.push(`  - 涉及文件:`);
          for (const f of gap.files) {
            lines.push(`    - ${f.relativePath || f.name}`);
          }
        }
      }
      lines.push('');
    }

    lines.push('## 📋 按素材ID详细核对结果');
    lines.push('');

    for (const material of jsonReport.materials) {
      const statusIcon = RISK_ICONS[material.riskLevel] || '❓';
      lines.push(`### ${statusIcon} ${material.materialId}`);
      lines.push('');
      
      lines.push(`| 属性 | 值 |`);
      lines.push(`|------|-----|`);
      lines.push(`| 风险等级 | ${statusIcon} ${RISK_LABELS_CN[material.riskLevel] || material.riskLevel} |`);
      lines.push(`| 素材清单 | ${material.hasMaterial ? '✅ 存在' : '❌ 缺失'} |`);
      lines.push(`| 授权合同 | ${material.hasContracts ? `✅ ${material.contractCount}份` : '❌ 缺失'} |`);
      lines.push(`| 时间线使用 | ${material.hasEDEvents ? `✅ ${material.edlEventCount}个片段` : '❌ 未使用'} |`);
      lines.push(`| 源文件 | ${material.hasMediaFiles ? `✅ ${material.mediaFileCount}个` : '❌ 缺失'} |`);
      lines.push(`| 违规问题 | ${material.violationCount > 0 ? `🔴 ${material.violationCount}` : '✅ 0'} |`);
      lines.push(`| 警告 | ${material.warningCount > 0 ? `🟡 ${material.warningCount}` : '✅ 0'} |`);
      lines.push('');

      if (material.material) {
        lines.push(`**素材信息:**`);
        lines.push('');
        lines.push(`- 名称: ${material.material.name || '未命名'}`);
        lines.push(`- 类型: ${material.material.type || '未知'}`);
        lines.push(`- 时长: ${material.material.duration || '未知'}`);
        lines.push(`- 格式: ${material.material.format || '未知'}`);
        if (material.material.source) {
          lines.push(`- 来源: ${material.material.source}`);
        }
        lines.push('');
      }

      if (material.contracts.length > 0) {
        lines.push(`**授权合同 (${material.contracts.length}份):**`);
        lines.push('');
        for (let i = 0; i < material.contracts.length; i++) {
          const c = material.contracts[i];
          lines.push(`**合同 ${i + 1}:**`);
          lines.push(`- 类型: ${c.type || '未知'}`);
          lines.push(`- 生效日期: ${c.startDate || '未知'}`);
          lines.push(`- 到期日期: ${c.endDate || '未知'}`);
          lines.push(`- 最大时长: ${c.maxDuration || '无限制'}`);
          if (c.usage) {
            lines.push(`- 使用范围: ${c.usage}`);
          }
          if (c.notes) {
            lines.push(`- 备注: ${c.notes}`);
          }
          lines.push('');
        }
      }

      if (material.edlEvents.length > 0) {
        lines.push(`**时间线片段 (${material.edlEvents.length}个):**`);
        lines.push('');
        for (const e of material.edlEvents) {
          lines.push(`- 事件 #${e.id}: ${e.reel || e.clipName || '未知'}`);
          lines.push(`  - 源入点: ${e.sourceIn}`);
          lines.push(`  - 源出点: ${e.sourceOut}`);
          lines.push(`  - 录制入点: ${e.recordIn}`);
          lines.push(`  - 录制出点: ${e.recordOut}`);
          lines.push(`  - 时长: ${this._formatDuration(e.durationSeconds)}`);
        }
        lines.push('');
      }

      if (material.mediaFiles.length > 0) {
        lines.push(`**源文件 (${material.mediaFiles.length}个):**`);
        lines.push('');
        for (const f of material.mediaFiles) {
          lines.push(`- ${f.relativePath || f.name}`);
          lines.push(`  - 大小: ${this._formatFileSize(f.size)}`);
        }
        lines.push('');
      }
    }

    lines.push('## 📁 数据源信息');
    lines.push('');
    
    if (jsonReport.sources.materialList) {
      lines.push(`### 素材清单`);
      lines.push(`- 文件名: ${jsonReport.sources.materialList.fileName}`);
      lines.push(`- 路径: ${jsonReport.sources.materialList.source}`);
      lines.push(`- 记录数: ${jsonReport.sources.materialList.count}`);
      lines.push('');
    }

    if (jsonReport.sources.authData) {
      lines.push(`### 授权合同`);
      lines.push(`- 文件名: ${jsonReport.sources.authData.fileName}`);
      lines.push(`- 路径: ${jsonReport.sources.authData.source}`);
      lines.push(`- 合同数: ${jsonReport.sources.authData.count}`);
      lines.push('');
    }

    if (jsonReport.sources.edlData) {
      lines.push(`### 时间线EDL`);
      lines.push(`- 文件名: ${jsonReport.sources.edlData.fileName}`);
      lines.push(`- 路径: ${jsonReport.sources.edlData.source}`);
      lines.push(`- 标题: ${jsonReport.sources.edlData.title || '无'}`);
      lines.push(`- 事件数: ${jsonReport.sources.edlData.eventCount}`);
      lines.push('');
    }

    if (jsonReport.sources.mediaFiles && jsonReport.sources.mediaFiles.length > 0) {
      lines.push(`### 媒体文件 (${jsonReport.sources.mediaFiles.length}个)`);
      lines.push('');
      for (const f of jsonReport.sources.mediaFiles) {
        lines.push(`- ${f.relativePath || f.name} (${this._formatFileSize(f.size)})`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('*此报告由素材授权交付核对器自动生成*');

    return lines.join('\n');
  }

  exportJSON(outputPath, validationResult, parsedData, scanResult) {
    const report = this.generateJSON(validationResult, parsedData, scanResult);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    return outputPath;
  }

  exportMarkdown(outputPath, validationResult, parsedData, scanResult) {
    const report = this.generateMarkdown(validationResult, parsedData, scanResult);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, report, 'utf-8');
    return outputPath;
  }

  _sanitizeMaterial(material) {
    const sanitized = { ...material };
    delete sanitized.rawRecord;
    return sanitized;
  }

  _sanitizeContract(contract) {
    const sanitized = { ...contract };
    delete sanitized.rawContract;
    delete sanitized.startDateObj;
    delete sanitized.endDateObj;
    return sanitized;
  }

  _sanitizeEDLEvent(event) {
    const sanitized = { ...event };
    delete sanitized.comments;
    return sanitized;
  }

  _sanitizeMediaFile(file) {
    return {
      name: file.name,
      relativePath: file.relativePath,
      size: file.size,
      extension: file.extension
    };
  }

  _groupByRisk(items) {
    const grouped = {
      CRITICAL: [],
      HIGH: [],
      MEDIUM: [],
      LOW: []
    };
    
    for (const item of items) {
      if (grouped[item.riskLevel]) {
        grouped[item.riskLevel].push(item);
      }
    }
    
    return grouped;
  }

  _formatDateTime(date) {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  _formatDuration(seconds) {
    if (typeof seconds !== 'number') return String(seconds);
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 25);

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
    } else {
      return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
    }
  }

  _formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = Reporter;
