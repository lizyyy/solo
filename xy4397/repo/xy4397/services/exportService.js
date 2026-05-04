class ExportService {
  exportToMarkdown(project) {
    const checks = project.checks || [];
    const reviews = project.reviews || [];
    
    const statusMap = {
      'pending': '待复核',
      'confirmed': '已确认问题',
      'dismissed': '已驳回',
      'resolved': '已修复'
    };
    
    const severityMap = {
      'high': '高',
      'medium': '中',
      'low': '低'
    };
    
    const typeMap = {
      'missing': '遗漏',
      'mismatch': '错读',
      'forbidden': '违规词',
      'duration': '时长偏差'
    };
    
    let markdown = `# 口播合规检查报告\n\n`;
    markdown += `**项目名称**: ${project.name}\n\n`;
    markdown += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
    markdown += `**检查时间**: ${new Date(project.updatedAt).toLocaleString('zh-CN')}\n\n`;
    markdown += `---\n\n`;
    
    const stats = this.getStats(checks, reviews);
    markdown += `## 概览\n\n`;
    markdown += `| 指标 | 数量 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 总检查项 | ${checks.length} |\n`;
    markdown += `| 高严重度 | ${stats.high} |\n`;
    markdown += `| 中严重度 | ${stats.medium} |\n`;
    markdown += `| 低严重度 | ${stats.low} |\n`;
    markdown += `| 待复核 | ${stats.pending} |\n`;
    markdown += `| 已确认问题 | ${stats.confirmed} |\n`;
    markdown += `| 已驳回 | ${stats.dismissed} |\n\n`;
    
    const checksByType = this.groupByType(checks, reviews);
    
    if (checksByType.missing.length > 0) {
      markdown += `## 遗漏检查\n\n`;
      checksByType.missing.forEach((item, index) => {
        const review = reviews.find(r => r.checkId === item.id);
        markdown += `### ${index + 1}. ${item.requirement || '未命名'}\n\n`;
        markdown += `- **类型**: 遗漏\n`;
        markdown += `- **严重度**: ${severityMap[item.severity] || item.severity}\n`;
        markdown += `- **预期内容**: ${item.expected || '无'}\n`;
        markdown += `- **建议**: ${item.suggestion || '无'}\n`;
        if (review) {
          markdown += `- **复核状态**: ${statusMap[review.status] || review.status}\n`;
          if (review.notes) {
            markdown += `- **复核备注**: ${review.notes}\n`;
          }
        }
        markdown += `\n`;
      });
    }
    
    if (checksByType.mismatch.length > 0) {
      markdown += `## 错读检查\n\n`;
      checksByType.mismatch.forEach((item, index) => {
        const review = reviews.find(r => r.checkId === item.id);
        markdown += `### ${index + 1}. ${item.requirement || '未命名'}\n\n`;
        markdown += `- **类型**: 错读\n`;
        markdown += `- **严重度**: ${severityMap[item.severity] || item.severity}\n`;
        markdown += `- **预期内容**: ${item.expected || '无'}\n`;
        markdown += `- **实际内容**: ${item.found || '无'}\n`;
        markdown += `- **上下文**: ${item.context || '无'}\n`;
        if (item.similarity) {
          markdown += `- **相似度**: ${(item.similarity * 100).toFixed(1)}%\n`;
        }
        markdown += `- **建议**: ${item.suggestion || '无'}\n`;
        if (review) {
          markdown += `- **复核状态**: ${statusMap[review.status] || review.status}\n`;
          if (review.notes) {
            markdown += `- **复核备注**: ${review.notes}\n`;
          }
        }
        markdown += `\n`;
      });
    }
    
    if (checksByType.forbidden.length > 0) {
      markdown += `## 违规词检查\n\n`;
      checksByType.forbidden.forEach((item, index) => {
        const review = reviews.find(r => r.checkId === item.id);
        markdown += `### ${index + 1}. ${item.requirement || '未命名'}\n\n`;
        markdown += `- **类型**: 违规词\n`;
        markdown += `- **严重度**: ${severityMap[item.severity] || item.severity}\n`;
        markdown += `- **发现内容**: ${item.found || '无'}\n`;
        markdown += `- **上下文**: ${item.context || '无'}\n`;
        markdown += `- **建议**: ${item.suggestion || '无'}\n`;
        if (review) {
          markdown += `- **复核状态**: ${statusMap[review.status] || review.status}\n`;
          if (review.notes) {
            markdown += `- **复核备注**: ${review.notes}\n`;
          }
        }
        markdown += `\n`;
      });
    }
    
    if (checksByType.duration.length > 0) {
      markdown += `## 时长偏差检查\n\n`;
      checksByType.duration.forEach((item, index) => {
        const review = reviews.find(r => r.checkId === item.id);
        markdown += `### ${index + 1}. ${item.requirement || '未命名'}\n\n`;
        markdown += `- **类型**: 时长偏差\n`;
        markdown += `- **严重度**: ${severityMap[item.severity] || item.severity}\n`;
        markdown += `- **预期时长**: ${item.expected}秒\n`;
        markdown += `- **实际时长**: ${item.found}秒\n`;
        if (item.deviation) {
          markdown += `- **偏差**: ${(item.deviation * 100).toFixed(0)}%\n`;
        }
        markdown += `- **建议**: ${item.suggestion || '无'}\n`;
        if (review) {
          markdown += `- **复核状态**: ${statusMap[review.status] || review.status}\n`;
          if (review.notes) {
            markdown += `- **复核备注**: ${review.notes}\n`;
          }
        }
        markdown += `\n`;
      });
    }
    
    markdown += `---\n\n`;
    markdown += `*此报告由口播合规检查助手自动生成*\n`;
    
    return markdown;
  }

  exportToCSV(project) {
    const checks = project.checks || [];
    const reviews = project.reviews || [];
    
    const statusMap = {
      'pending': '待复核',
      'confirmed': '已确认问题',
      'dismissed': '已驳回',
      'resolved': '已修复'
    };
    
    const severityMap = {
      'high': '高',
      'medium': '中',
      'low': '低'
    };
    
    const typeMap = {
      'missing': '遗漏',
      'mismatch': '错读',
      'forbidden': '违规词',
      'duration': '时长偏差'
    };
    
    const headers = [
      '序号',
      '类型',
      '严重度',
      '要求项',
      '预期内容',
      '实际内容',
      '上下文',
      '建议',
      '复核状态',
      '复核备注'
    ];
    
    let csv = '\ufeff' + headers.join(',') + '\n';
    
    checks.forEach((check, index) => {
      const review = reviews.find(r => r.checkId === check.id);
      const row = [
        index + 1,
        this.escapeCSV(typeMap[check.type] || check.type),
        this.escapeCSV(severityMap[check.severity] || check.severity),
        this.escapeCSV(check.requirement || ''),
        this.escapeCSV(check.expected || ''),
        this.escapeCSV(check.found || ''),
        this.escapeCSV(check.context || ''),
        this.escapeCSV(check.suggestion || ''),
        this.escapeCSV(review ? (statusMap[review.status] || review.status) : '待复核'),
        this.escapeCSV(review ? review.notes : '')
      ];
      csv += row.join(',') + '\n';
    });
    
    return csv;
  }

  exportToJSON(project) {
    const auditPackage = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      },
      transcript: {
        length: project.transcript ? project.transcript.length : 0,
        preview: project.transcript ? project.transcript.substring(0, 200) : ''
      },
      configuration: {
        sponsorRequirements: project.sponsorRequirements || [],
        forbiddenTerms: project.forbiddenTerms || []
      },
      checks: (project.checks || []).map(check => {
        const review = (project.reviews || []).find(r => r.checkId === check.id);
        return {
          ...check,
          review: review || null
        };
      }),
      summary: this.getDetailedStats(project.checks || [], project.reviews || [])
    };
    
    return JSON.stringify(auditPackage, null, 2);
  }

  escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  getStats(checks, reviews) {
    const stats = {
      high: 0,
      medium: 0,
      low: 0,
      pending: 0,
      confirmed: 0,
      dismissed: 0,
      resolved: 0
    };
    
    checks.forEach(check => {
      if (check.severity === 'high') stats.high++;
      else if (check.severity === 'medium') stats.medium++;
      else stats.low++;
    });
    
    reviews.forEach(review => {
      if (review.status === 'pending') stats.pending++;
      else if (review.status === 'confirmed') stats.confirmed++;
      else if (review.status === 'dismissed') stats.dismissed++;
      else if (review.status === 'resolved') stats.resolved++;
    });
    
    return stats;
  }

  getDetailedStats(checks, reviews) {
    const stats = {
      total: checks.length,
      bySeverity: {
        high: checks.filter(c => c.severity === 'high').length,
        medium: checks.filter(c => c.severity === 'medium').length,
        low: checks.filter(c => c.severity === 'low').length
      },
      byType: {
        missing: checks.filter(c => c.type === 'missing').length,
        mismatch: checks.filter(c => c.type === 'mismatch').length,
        forbidden: checks.filter(c => c.type === 'forbidden').length,
        duration: checks.filter(c => c.type === 'duration').length
      },
      byStatus: {
        pending: reviews.filter(r => r.status === 'pending').length,
        confirmed: reviews.filter(r => r.status === 'confirmed').length,
        dismissed: reviews.filter(r => r.status === 'dismissed').length,
        resolved: reviews.filter(r => r.status === 'resolved').length
      }
    };
    
    return stats;
  }

  groupByType(checks, reviews) {
    const groups = {
      missing: [],
      mismatch: [],
      forbidden: [],
      duration: []
    };
    
    checks.forEach(check => {
      if (groups[check.type]) {
        groups[check.type].push(check);
      }
    });
    
    return groups;
  }
}

module.exports = new ExportService();
