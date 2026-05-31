const fs = require('fs');
const path = require('path');
const { Storage } = require('./Storage');

class Exporter {
  constructor(storage = null) {
    this.storage = storage || new Storage();
  }

  export(type, format = 'json', options = {}) {
    const exportPath = path.join(this.storage.baseDir, 'exports');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${type}_${timestamp}`;

    let data;
    switch (type) {
      case 'defects':
        data = this._prepareDefectsExport(options);
        break;
      case 'annotations':
        data = this._prepareAnnotationsExport(options);
        break;
      case 'logs':
        data = this._prepareLogsExport(options);
        break;
      case 'reviews':
        data = this._prepareReviewsExport(options);
        break;
      case 'summary':
        data = this._prepareSummaryReport(options);
        break;
      case 'full':
        data = this._prepareFullExport(options);
        break;
      default:
        throw new Error(`Unknown export type: ${type}`);
    }

    let fullPath;
    if (format === 'json') {
      fullPath = path.join(exportPath, `${filename}.json`);
      fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
    } else if (format === 'md' || format === 'markdown') {
      fullPath = path.join(exportPath, `${filename}.md`);
      fs.writeFileSync(fullPath, this._toMarkdown(type, data), 'utf8');
    } else if (format === 'csv') {
      fullPath = path.join(exportPath, `${filename}.csv`);
      fs.writeFileSync(fullPath, this._toCSV(type, data), 'utf8');
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }

    return { path: fullPath, format, type };
  }

  _prepareDefectsExport(options = {}) {
    let defects = this.storage.getDefects();
    
    if (options.filter) {
      defects = defects.filter(options.filter);
    }
    if (options.status) {
      defects = defects.filter(d => d.status === options.status);
    }
    if (options.severity) {
      defects = defects.filter(d => d.severity === options.severity);
    }
    if (options.source) {
      defects = defects.filter(d => d.source === options.source);
    }

    const result = {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        type: 'defects',
        count: defects.length,
        filters: { status: options.status, severity: options.severity, source: options.source }
      },
      consistencyCheck: this._checkDefectsConsistency(defects),
      defects: defects.map(d => d.toJSON())
    };

    return result;
  }

  _prepareAnnotationsExport(options = {}) {
    let annotations = this.storage.getAnnotations();
    
    if (options.filter) {
      annotations = annotations.filter(options.filter);
    }

    return {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        type: 'annotations',
        count: annotations.length
      },
      consistencyCheck: this._checkAnnotationsConsistency(annotations),
      annotations: annotations.map(a => a.toJSON())
    };
  }

  _prepareLogsExport(options = {}) {
    let logs = this.storage.getLogs();
    
    if (options.filter) {
      logs = logs.filter(options.filter);
    }
    if (options.anomaliesOnly) {
      logs = logs.filter(l => l.anomalyDetected);
    }

    return {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        type: 'logs',
        count: logs.length
      },
      logs: logs.map(l => l.toJSON())
    };
  }

  _prepareReviewsExport(options = {}) {
    let reviews = this.storage.getReviewHistory();
    
    if (options.defectId) {
      reviews = reviews.filter(r => r.defectId === options.defectId);
    }
    if (options.action) {
      reviews = reviews.filter(r => r.action === options.action);
    }

    return {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        type: 'reviews',
        count: reviews.length
      },
      reviews: reviews.map(r => r.toJSON())
    };
  }

  _prepareSummaryReport(options = {}) {
    const stats = this.storage.getStats();
    const defects = this.storage.getDefects();
    const reviews = this.storage.getReviewHistory();
    const logs = this.storage.getLogs();

    const recentReviews = reviews
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 20);

    const pendingDefects = defects.filter(d => d.status === 'pending' || d.status === 'needs_review');
    const highPriority = defects.filter(d => d.severity === 'critical' || d.severity === 'high');
    const duplicates = defects.filter(d => d.isDuplicate);

    return {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        type: 'summary'
      },
      overview: {
        totalDefects: stats.total.defects,
        totalAnnotations: stats.total.annotations,
        totalLogs: stats.total.logs,
        totalReviews: stats.total.reviews
      },
      statusBreakdown: stats.byStatus,
      typeBreakdown: stats.byType,
      severityBreakdown: stats.bySeverity,
      actionItems: {
        pendingReview: pendingDefects.length,
        highPriority: highPriority.length,
        duplicates: duplicates.length,
        withIssues: stats.withIssues,
        anomalies: stats.anomalies
      },
      recentActivity: recentReviews.map(r => r.toJSON()),
      consistencyReport: this._runFullConsistencyCheck()
    };
  }

  _prepareFullExport(options = {}) {
    return {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        type: 'full',
        version: '1.0.0'
      },
      metadata: this.storage.getMetadata(),
      defects: this.storage.getDefects().map(d => d.toJSON()),
      annotations: this.storage.getAnnotations().map(a => a.toJSON()),
      logs: this.storage.getLogs().map(l => l.toJSON()),
      reviews: this.storage.getReviewHistory().map(r => r.toJSON()),
      consistencyReport: this._runFullConsistencyCheck()
    };
  }

  _checkDefectsConsistency(defects) {
    const issues = [];
    const warnings = [];
    const imageDefectMap = {};

    defects.forEach(d => {
      if (!d.imageId && !d.imagePath) {
        issues.push({ defectId: d.id, type: 'missing_image_ref', message: '缺少图片标识' });
      }
      if (!d.coordinates || d.coordinates.length === 0) {
        warnings.push({ defectId: d.id, type: 'missing_coordinates', message: '缺少坐标信息' });
      }
      if (d.confidence === null) {
        warnings.push({ defectId: d.id, type: 'missing_confidence', message: '缺少置信度' });
      }
      if (d.reviewCount === 0 && d.status !== 'pending') {
        warnings.push({ defectId: d.id, type: 'status_without_review', message: '状态已变更但无复核记录' });
      }
      if (d.isDuplicate && !d.duplicateOf) {
        issues.push({ defectId: d.id, type: 'duplicate_without_original', message: '标记为重复但未关联原始缺陷' });
      }
      if (d.iou !== null && (d.iou < 0 || d.iou > 1)) {
        issues.push({ defectId: d.id, type: 'invalid_iou', message: `IoU值异常: ${d.iou}` });
      }

      const key = `${d.imageId || d.imagePath}_${d.defectType}`;
      if (!imageDefectMap[key]) {
        imageDefectMap[key] = [];
      }
      imageDefectMap[key].push(d.id);
    });

    Object.entries(imageDefectMap).forEach(([key, ids]) => {
      if (ids.length > 1) {
        warnings.push({ 
          type: 'potential_duplicates', 
          message: `同一图片同类缺陷可能重复: ${key}`,
          defectIds: ids 
        });
      }
    });

    return { issues, warnings, issueCount: issues.length, warningCount: warnings.length };
  }

  _checkAnnotationsConsistency(annotations) {
    const issues = [];
    const warnings = [];

    annotations.forEach(a => {
      if (!a.bbox || a.bbox.length === 0) {
        issues.push({ annotationId: a.id, type: 'missing_bbox', message: '缺少边界框' });
      }
      if (a.isGroundTruth && a.status !== 'verified') {
        warnings.push({ annotationId: a.id, type: 'gt_not_verified', message: '标注为真值但未验证' });
      }
      if (a.issues && a.issues.some(i => !i.resolved)) {
        issues.push({ annotationId: a.id, type: 'unresolved_issues', message: '存在未解决问题' });
      }
    });

    return { issues, warnings, issueCount: issues.length, warningCount: warnings.length };
  }

  _runFullConsistencyCheck() {
    const defects = this.storage.getDefects();
    const annotations = this.storage.getAnnotations();
    const reviews = this.storage.getReviewHistory();

    const defectConsistency = this._checkDefectsConsistency(defects);
    const annotationConsistency = this._checkAnnotationsConsistency(annotations);

    const crossCheckIssues = [];
    defects.forEach(d => {
      if (d.sourceAnnotationId) {
        const ann = annotations.find(a => a.id === d.sourceAnnotationId);
        if (!ann) {
          crossCheckIssues.push({ 
            defectId: d.id, 
            type: 'missing_annotation_ref', 
            message: '关联的标注不存在' 
          });
        }
      }
      if (d.reviewCount > 0) {
        const defectReviews = reviews.filter(r => r.defectId === d.id);
        if (defectReviews.length !== d.reviewCount) {
          crossCheckIssues.push({ 
            defectId: d.id, 
            type: 'review_count_mismatch', 
            message: `复核记录数量不匹配: 期望${d.reviewCount}, 实际${defectReviews.length}` 
          });
        }
      }
    });

    return {
      defects: defectConsistency,
      annotations: annotationConsistency,
      crossCheck: {
        issues: crossCheckIssues,
        issueCount: crossCheckIssues.length
      },
      overall: {
        totalIssues: defectConsistency.issueCount + annotationConsistency.issueCount + crossCheckIssues.length,
        totalWarnings: defectConsistency.warningCount + annotationConsistency.warningCount,
        status: (defectConsistency.issueCount + annotationConsistency.issueCount + crossCheckIssues.length) === 0 ? 'pass' : 'needs_attention'
      }
    };
  }

  _toMarkdown(type, data) {
    let md = '';
    
    switch (type) {
      case 'summary':
        md = this._summaryToMarkdown(data);
        break;
      case 'defects':
        md = this._defectsToMarkdown(data);
        break;
      default:
        md = `# ${type} 导出报告\n\n导出时间: ${data.exportMetadata?.exportedAt || new Date().toISOString()}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
    }
    
    return md;
  }

  _summaryToMarkdown(data) {
    let md = '# 图像缺陷复核 - 汇总报告\n\n';
    md += `导出时间: ${data.exportMetadata.exportedAt}\n\n`;
    
    md += '## 概览\n\n';
    md += '| 指标 | 数量 |\n';
    md += '|------|------|\n';
    md += `| 总缺陷数 | ${data.overview.totalDefects} |\n`;
    md += `| 总标注数 | ${data.overview.totalAnnotations} |\n`;
    md += `| 日志条目 | ${data.overview.totalLogs} |\n`;
    md += `| 复核记录 | ${data.overview.totalReviews} |\n\n`;

    md += '## 待处理事项\n\n';
    md += '| 类型 | 数量 | 说明 |\n';
    md += '|------|------|------|\n';
    md += `| 待复核 | ${data.actionItems.pendingReview} | 需要人工确认 |\n`;
    md += `| 高优先级 | ${data.actionItems.highPriority} | 严重/高危缺陷 |\n`;
    md += `| 重复项 | ${data.actionItems.duplicates} | 已标记为重复 |\n`;
    md += `| 标注问题 | ${data.actionItems.withIssues} | 存在未解决问题 |\n`;
    md += `| 异常日志 | ${data.actionItems.anomalies} | 训练异常检测 |\n\n`;

    md += '## 状态分布\n\n';
    md += '| 状态 | 数量 |\n';
    md += '|------|------|\n';
    Object.entries(data.statusBreakdown || {}).forEach(([k, v]) => {
      md += `| ${k} | ${v} |\n`;
    });

    md += '\n## 缺陷类型分布\n\n';
    md += '| 类型 | 数量 |\n';
    md += '|------|------|\n';
    Object.entries(data.typeBreakdown || {}).forEach(([k, v]) => {
      md += `| ${k} | ${v} |\n`;
    });

    md += '\n## 一致性检查\n\n';
    const cr = data.consistencyReport?.overall;
    md += `**整体状态**: ${cr?.status === 'pass' ? '✅ 通过' : '⚠️ 需要关注'}\n\n`;
    md += `- 问题总数: ${cr?.totalIssues || 0}\n`;
    md += `- 警告总数: ${cr?.totalWarnings || 0}\n`;

    if (data.consistencyReport?.defects?.issues?.length > 0) {
      md += '\n### 缺陷问题\n\n';
      data.consistencyReport.defects.issues.forEach(i => {
        md += `- [${i.type}] ${i.message} (${i.defectId})\n`;
      });
    }

    md += '\n## 最近活动\n\n';
    (data.recentActivity || []).forEach(r => {
      const time = new Date(r.timestamp).toLocaleString();
      md += `- **${time}** [${r.action}] ${r.reviewer || '系统'}: ${r.comment || r.newValue || ''}\n`;
    });

    return md;
  }

  _defectsToMarkdown(data) {
    let md = '# 缺陷导出报告\n\n';
    md += `导出时间: ${data.exportMetadata.exportedAt}\n`;
    md += `导出数量: ${data.exportMetadata.count}\n\n`;

    md += '## 一致性检查\n\n';
    md += `- 问题: ${data.consistencyCheck.issueCount}\n`;
    md += `- 警告: ${data.consistencyCheck.warningCount}\n\n`;

    md += '## 缺陷列表\n\n';
    data.defects.forEach(d => {
      md += `### ${d.id}\n\n`;
      md += `- **图片**: ${d.imagePath || d.imageId || '未知'}\n`;
      md += `- **类型**: ${d.defectType}\n`;
      md += `- **状态**: ${d.status}\n`;
      md += `- **严重度**: ${d.severity}\n`;
      md += `- **置信度**: ${d.confidence !== null ? d.confidence : 'N/A'}\n`;
      md += `- **来源**: ${d.source}\n`;
      md += `- **复核次数**: ${d.reviewCount}\n`;
      if (d.iou !== null) md += `- **IoU**: ${d.iou}\n`;
      if (d.notes?.length > 0) {
        md += '\n**备注:**\n';
        d.notes.forEach(n => md += `- ${n.content}\n`);
      }
      md += '\n';
    });

    return md;
  }

  _toCSV(type, data) {
    if (type === 'defects' && data.defects) {
      const headers = ['id', 'imagePath', 'defectType', 'status', 'severity', 'confidence', 'source', 'reviewCount', 'iou', 'createdAt'];
      const rows = data.defects.map(d => headers.map(h => `"${(d[h] !== undefined && d[h] !== null ? d[h] : '')}"`).join(','));
      return [headers.join(','), ...rows].join('\n');
    }
    return '';
  }
}

module.exports = { Exporter };
