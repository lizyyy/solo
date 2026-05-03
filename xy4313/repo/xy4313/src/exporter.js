export class Exporter {
  constructor() {
    this.exportDate = new Date();
  }

  exportMarkdown(session, options = {}) {
    const {
      includeEvidence = true,
      includeStatistics = true,
      includeReviews = true
    } = options;

    const events = session?.derived?.detectedEvents || [];
    const statistics = session?.derived?.statistics || this.calculateStats(events);
    const data = session?.data || {};

    const md = [];

    md.push(`# 叉车盲区复盘报告`);
    md.push(``);
    md.push(`> 复盘时间: ${this.formatDateTime(this.exportDate)}`);
    md.push(`> 会话名称: ${session?.name || '未命名会话'}`);
    md.push(`> 会话ID: ${session?.id || 'N/A'}`);
    md.push(``);

    if (includeStatistics) {
      md.push(`## 📊 统计概览`);
      md.push(``);
      md.push(`| 指标 | 数值 |`);
      md.push(`|------|------|`);
      md.push(`| 总事件数 | ${statistics.total || 0} |`);
      md.push(`| 高风险事件 | ${statistics.bySeverity?.high || 0} |`);
      md.push(`| 中风险事件 | ${statistics.bySeverity?.medium || 0} |`);
      md.push(`| 低风险事件 | ${statistics.bySeverity?.low || 0} |`);
      md.push(`| 已复核 | ${statistics.byReviewStatus?.confirmed || 0} |`);
      md.push(`| 已驳回 | ${statistics.byReviewStatus?.dismissed || 0} |`);
      md.push(`| 待复核 | ${statistics.byReviewStatus?.unreviewed || 0} |`);
      md.push(``);

      if (statistics.byType && Object.keys(statistics.byType).length > 0) {
        md.push(`### 事件类型分布`);
        md.push(``);
        md.push(`| 事件类型 | 数量 |`);
        md.push(`|----------|------|`);
        Object.entries(statistics.byType).forEach(([type, count]) => {
          md.push(`| ${this.getEventTypeName(type)} | ${count} |`);
        });
        md.push(``);
      }
    }

    if (events.length > 0) {
      md.push(`## ⚠️ 风险事件详情`);
      md.push(``);

      const sortedEvents = [...events].sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
      });

      sortedEvents.forEach((event, index) => {
        md.push(`### ${index + 1}. ${this.getEventTypeName(event.type)}`);
        md.push(``);
        
        md.push(`- **严重程度**: ${this.getSeverityLabel(event.severity)}`);
        md.push(`- **发生时间**: ${this.formatTimestamp(event.timestamp)}`);
        md.push(`- **位置**: (${event.location?.x?.toFixed(2) || 'N/A'}, ${event.location?.z?.toFixed(2) || 'N/A'})`);
        md.push(`- **复核状态**: ${this.getReviewStatusLabel(event.reviewStatus)}`);
        md.push(``);
        
        md.push(`**描述**: ${event.description || '无描述'}`);
        md.push(``);

        if (event.subType) {
          md.push(`**子类型**: ${this.getSubTypeName(event.subType)}`);
          md.push(``);
        }

        if (event.maxSpeed !== undefined) {
          md.push(`**最大速度**: ${event.maxSpeed.toFixed(2)} km/h`);
          md.push(``);
        }

        if (event.duration !== undefined) {
          md.push(`**持续时间**: ${event.duration.toFixed(1)} 秒`);
          md.push(``);
        }

        if (includeReviews && event.reviewNotes) {
          md.push(`**复核意见**: ${event.reviewNotes}`);
          md.push(``);
        }

        if (includeEvidence && event.evidence) {
          md.push(`**证据**: `);
          if (event.evidence.cameraFeeds && event.evidence.cameraFeeds.length > 0) {
            event.evidence.cameraFeeds.forEach((feed, i) => {
              md.push(`  - 摄像头 ${feed.cameraId || i + 1}: ${feed.description || '视频片段'}`);
            });
          }
          md.push(``);
        }

        md.push(`---`);
        md.push(``);
      });
    } else {
      md.push(`## ✅ 无风险事件`);
      md.push(``);
      md.push(`本次复盘未检测到任何风险事件。`);
      md.push(``);
    }

    if (data.forkliftTrajectory) {
      md.push(`## 🚛 叉车运行信息`);
      md.push(``);
      const traj = data.forkliftTrajectory;
      md.push(`- **叉车编号**: ${traj.forkliftId || 'N/A'}`);
      md.push(`- **开始时间**: ${this.formatTimestamp(traj.startTime)}`);
      md.push(`- **结束时间**: ${this.formatTimestamp(traj.endTime)}`);
      md.push(`- **总行驶距离**: ${(traj.totalDistance || 0).toFixed(2)} 米`);
      md.push(`- **数据点数量**: ${traj.points?.length || 0}`);
      md.push(``);
    }

    md.push(`---`);
    md.push(``);
    md.push(`*报告生成于: ${this.formatDateTime(this.exportDate)}*`);
    md.push(`*工具: 叉车盲区回放沙盘 v1.0.0*`);

    return md.join('\n');
  }

  exportCSV(session, options = {}) {
    const events = session?.derived?.detectedEvents || [];
    
    if (events.length === 0) {
      return this.generateEmptyCSV();
    }

    const headers = [
      '序号',
      '事件类型',
      '严重程度',
      '发生时间',
      '位置X',
      '位置Z',
      '描述',
      '最大速度(km/h)',
      '持续时间(秒)',
      '复核状态',
      '复核意见',
      '涉及货架',
      '事件ID'
    ];

    const rows = events.map((event, index) => {
      return [
        index + 1,
        this.getEventTypeName(event.type),
        this.getSeverityLabel(event.severity),
        this.formatCSVDateTime(event.timestamp),
        event.location?.x?.toFixed(2) || '',
        event.location?.z?.toFixed(2) || '',
        this.escapeCSV(event.description || ''),
        event.maxSpeed?.toFixed(2) || '',
        event.duration?.toFixed(2) || '',
        this.getReviewStatusLabel(event.reviewStatus),
        this.escapeCSV(event.reviewNotes || ''),
        this.escapeCSV(event.shelfName || ''),
        event.id
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
  }

  exportJSON(session, options = {}) {
    const {
      includeRawData = true,
      includeEvents = true,
      includeReviews = true
    } = options;

    const auditPackage = {
      version: '1.0.0',
      auditType: 'forklift-blind-spot-review',
      generatedAt: this.exportDate.toISOString(),
      session: {
        id: session?.id,
        name: session?.name,
        createdAt: session?.createdAt,
        updatedAt: session?.updatedAt
      }
    };

    if (includeRawData && session?.data) {
      auditPackage.rawData = {
        shelves: session.data.shelves,
        forkliftTrajectory: {
          forkliftId: session.data.forkliftTrajectory?.forkliftId,
          startTime: session.data.forkliftTrajectory?.startTime,
          endTime: session.data.forkliftTrajectory?.endTime,
          totalDistance: session.data.forkliftTrajectory?.totalDistance,
          pointCount: session.data.forkliftTrajectory?.points?.length
        },
        nearMissEvents: session.data.nearMissEvents?.events?.length || 0,
        cameraAnnotations: session.data.cameraAnnotations?.cameras?.length || 0
      };
    }

    if (includeEvents && session?.derived) {
      auditPackage.events = {
        statistics: session.derived.statistics,
        list: session.derived.detectedEvents?.map(event => ({
          id: event.id,
          type: event.type,
          subType: event.subType,
          severity: event.severity,
          timestamp: event.timestamp,
          location: event.location,
          description: event.description,
          maxSpeed: event.maxSpeed,
          duration: event.duration,
          shelfId: event.shelfId,
          shelfName: event.shelfName,
          minDistance: event.minDistance,
          involvedEntities: event.involvedEntities
        })) || []
      };
    }

    if (includeReviews && session?.derived?.eventReviews) {
      auditPackage.reviews = session.derived.eventReviews;
    }

    auditPackage.summary = this.generateSummary(session);

    return JSON.stringify(auditPackage, null, 2);
  }

  generateSummary(session) {
    const events = session?.derived?.detectedEvents || [];
    const stats = session?.derived?.statistics || this.calculateStats(events);

    return {
      totalEvents: stats.total || 0,
      riskLevel: this.assessOverallRisk(events),
      keyFindings: this.extractKeyFindings(events),
      recommendations: this.generateRecommendations(events)
    };
  }

  assessOverallRisk(events) {
    const highCount = events.filter(e => e.severity === 'high').length;
    const mediumCount = events.filter(e => e.severity === 'medium').length;

    if (highCount > 0) return 'high';
    if (mediumCount > 2) return 'medium';
    if (events.length > 0) return 'low';
    return 'none';
  }

  extractKeyFindings(events) {
    const findings = [];
    const blindSpotEvents = events.filter(e => e.type === 'blind-spot');
    const overspeedEvents = events.filter(e => e.type === 'overspeed');
    const noEntryEvents = events.filter(e => e.type === 'no-entry');

    if (blindSpotEvents.length > 0) {
      findings.push(`检测到 ${blindSpotEvents.length} 起盲区交汇事件，涉及 ${this.countUniqueShelves(blindSpotEvents)} 个盲区货架`);
    }

    if (overspeedEvents.length > 0) {
      const maxSpeed = Math.max(...overspeedEvents.map(e => e.maxSpeed || 0));
      findings.push(`检测到 ${overspeedEvents.length} 起超速事件，最大速度 ${maxSpeed.toFixed(1)} km/h`);
    }

    if (noEntryEvents.length > 0) {
      findings.push(`检测到 ${noEntryEvents.length} 起禁行区穿越事件`);
    }

    return findings;
  }

  countUniqueShelves(events) {
    const shelfIds = new Set(events.map(e => e.shelfId).filter(Boolean));
    return shelfIds.size;
  }

  generateRecommendations(events) {
    const recommendations = [];
    const blindSpotEvents = events.filter(e => e.type === 'blind-spot');
    const overspeedEvents = events.filter(e => e.type === 'overspeed');
    const turningOverspeed = overspeedEvents.filter(e => e.subType === 'turning');
    const reverseOverspeed = overspeedEvents.filter(e => e.subType === 'reverse');

    if (blindSpotEvents.length > 0) {
      recommendations.push('建议在盲区货架区域增加警示标识和反光镜');
      recommendations.push('考虑在高风险盲区安装声光报警器');
    }

    if (turningOverspeed.length > 0) {
      recommendations.push('转弯时超速现象明显，建议加强驾驶员培训');
    }

    if (reverseOverspeed.length > 0) {
      recommendations.push('倒车超速风险高，建议安装倒车辅助雷达');
    }

    if (events.filter(e => e.severity === 'high').length > 0) {
      recommendations.push('高风险事件需要重点关注，建议立即组织安全会议');
    }

    if (recommendations.length === 0) {
      recommendations.push('本次复盘无严重风险事件，继续保持良好的安全规范');
    }

    return recommendations;
  }

  generateEmptyCSV() {
    return [
      '序号,事件类型,严重程度,发生时间,位置X,位置Z,描述,最大速度(km/h),持续时间(秒),复核状态,复核意见,涉及货架,事件ID',
      '0,无事件,-,-,-,-,本次复盘未检测到风险事件,-,-,-,-,-,-'
    ].join('\n');
  }

  getEventTypeName(type) {
    const names = {
      'blind-spot': '盲区交汇',
      'overspeed': '超速',
      'no-entry': '禁行区穿越',
      'near-miss': '近失事件'
    };
    return names[type] || type;
  }

  getSubTypeName(subType) {
    const names = {
      'turning': '转弯时',
      'reverse': '倒车时',
      'temporary-obstacle': '临时障碍物'
    };
    return names[subType] || subType;
  }

  getSeverityLabel(severity) {
    const labels = {
      'high': '高风险',
      'medium': '中风险',
      'low': '低风险'
    };
    return labels[severity] || severity;
  }

  getReviewStatusLabel(status) {
    const labels = {
      'unreviewed': '待复核',
      'reviewed': '已复核',
      'confirmed': '已确认风险',
      'dismissed': '已驳回'
    };
    return labels[status] || status;
  }

  formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  formatCSVDateTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toISOString().replace('T', ' ').substring(0, 19);
  }

  formatDateTime(date) {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const strValue = String(value);
    if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
      return `"${strValue.replace(/"/g, '""')}"`;
    }
    return strValue;
  }

  calculateStats(events) {
    const stats = {
      total: events.length,
      byType: {},
      bySeverity: { high: 0, medium: 0, low: 0 },
      byReviewStatus: { unreviewed: 0, reviewed: 0, dismissed: 0, confirmed: 0 }
    };

    events.forEach(event => {
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
      stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;
      stats.byReviewStatus[event.reviewStatus] = (stats.byReviewStatus[event.reviewStatus] || 0) + 1;
    });

    return stats;
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  downloadMarkdown(session, options = {}) {
    const content = this.exportMarkdown(session, options);
    const filename = `叉车复盘报告_${this.formatDateForFilename()}.md`;
    this.downloadFile(content, filename, 'text/markdown;charset=utf-8');
  }

  downloadCSV(session, options = {}) {
    const content = this.exportCSV(session, options);
    const filename = `风险清单_${this.formatDateForFilename()}.csv`;
    this.downloadFile(content, filename, 'text/csv;charset=utf-8');
  }

  downloadJSON(session, options = {}) {
    const content = this.exportJSON(session, options);
    const filename = `审计包_${this.formatDateForFilename()}.json`;
    this.downloadFile(content, filename, 'application/json;charset=utf-8');
  }

  formatDateForFilename() {
    const date = this.exportDate;
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  }
}

export default Exporter;
