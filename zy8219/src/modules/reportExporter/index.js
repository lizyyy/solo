export class ReportExporter {
  constructor() {
    this.reportData = null;
  }

  generateReport(analysisResult, metadata = {}) {
    const { risks, statistics } = analysisResult;
    
    this.reportData = {
      metadata: {
        reportId: this.generateReportId(),
        generatedAt: new Date().toISOString(),
        ...metadata
      },
      summary: {
        totalRisks: risks.length,
        criticalRisks: statistics.criticalRisks || 0,
        warningRisks: statistics.warningRisks || 0,
        byType: {
          blindSpot: statistics.totalBlindSpotRisks || 0,
          nearMiss: statistics.totalNearMissRisks || 0,
          wrongWay: statistics.totalWrongWayRisks || 0,
          turningBlindSpot: statistics.totalTurningBlindSpotRisks || 0
        }
      },
      risks: this.sortAndGroupRisks(risks),
      statistics: statistics
    };

    return this.reportData;
  }

  generateReportId() {
    return 'RPT-' + Date.now().toString(36).toUpperCase();
  }

  sortAndGroupRisks(risks) {
    const sortedRisks = [...risks].sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const severityDiff = (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
      if (severityDiff !== 0) return severityDiff;
      return a.timestamp - b.timestamp;
    });

    return sortedRisks;
  }

  exportToJSON(prettyPrint = true) {
    if (!this.reportData) {
      throw new Error('没有报告数据，请先生成报告');
    }

    return prettyPrint 
      ? JSON.stringify(this.reportData, null, 2)
      : JSON.stringify(this.reportData);
  }

  exportToMarkdown() {
    if (!this.reportData) {
      throw new Error('没有报告数据，请先生成报告');
    }

    const { metadata, summary, risks } = this.reportData;

    let markdown = `# 仓库叉车盲区冲突风险分析报告\n\n`;

    markdown += `## 报告信息\n\n`;
    markdown += `| 项目 | 内容 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 报告ID | ${metadata.reportId} |\n`;
    markdown += `| 生成时间 | ${this.formatDate(metadata.generatedAt)} |\n`;
    if (metadata.warehouseName) {
      markdown += `| 仓库名称 | ${metadata.warehouseName} |\n`;
    }
    if (metadata.analysisPeriod) {
      markdown += `| 分析时段 | ${metadata.analysisPeriod} |\n`;
    }
    markdown += `\n`;

    markdown += `## 风险概览\n\n`;
    markdown += `### 总体统计\n\n`;
    markdown += `- **总风险数**: ${summary.totalRisks}\n`;
    markdown += `- **严重风险**: ${summary.criticalRisks} (🔴)\n`;
    markdown += `- **警告风险**: ${summary.warningRisks} (🟡)\n\n`;

    markdown += `### 风险类型分布\n\n`;
    markdown += `| 风险类型 | 数量 | 说明 |\n`;
    markdown += `|----------|------|------|\n`;
    markdown += `| 货架盲区 | ${summary.byType.blindSpot} | 货架遮挡驾驶员视线 |\n`;
    markdown += `| 近失事件 | ${summary.byType.nearMiss} | 与行人距离过近 |\n`;
    markdown += `| 逆行违规 | ${summary.byType.wrongWay} | 在通道逆向行驶 |\n`;
    markdown += `| 转弯盲区 | ${summary.byType.turningBlindSpot} | 转弯时存在视线盲区 |\n\n`;

    if (risks.length > 0) {
      markdown += `## 风险详情\n\n`;
      
      const criticalRisks = risks.filter(r => r.severity === 'critical');
      const warningRisks = risks.filter(r => r.severity === 'warning');
      const infoRisks = risks.filter(r => r.severity === 'info');

      if (criticalRisks.length > 0) {
        markdown += `### 🔴 严重风险 (${criticalRisks.length})\n\n`;
        criticalRisks.forEach((risk, index) => {
          markdown += this.formatRiskItem(risk, index + 1);
        });
      }

      if (warningRisks.length > 0) {
        markdown += `### 🟡 警告风险 (${warningRisks.length})\n\n`;
        warningRisks.forEach((risk, index) => {
          markdown += this.formatRiskItem(risk, index + 1);
        });
      }

      if (infoRisks.length > 0) {
        markdown += `### 🔵 信息提示 (${infoRisks.length})\n\n`;
        infoRisks.forEach((risk, index) => {
          markdown += this.formatRiskItem(risk, index + 1);
        });
      }
    }

    markdown += `## 风险类型说明\n\n`;
    markdown += `### 货架盲区 (blind_spot)\n`;
    markdown += `货架遮挡驾驶员视线，可能导致无法及时发现障碍物或行人。\n\n`;
    
    markdown += `### 近失事件 (near_miss)\n`;
    markdown += `叉车与行人距离过近，存在碰撞风险。根据距离分为：\n`;
    markdown += `- **严重**: 距离小于安全阈值\n`;
    markdown += `- **警告**: 距离接近安全阈值\n\n`;
    
    markdown += `### 逆行违规 (wrong_way)\n`;
    markdown += `叉车在单向通道逆向行驶，增加碰撞风险。\n\n`;
    
    markdown += `### 转弯盲区 (turning_blind_spot)\n`;
    markdown += `叉车转弯时，由于车身角度变化产生额外的视线盲区。\n\n`;

    markdown += `---\n\n`;
    markdown += `*本报告由叉车盲区冲突复盘工具自动生成*\n`;
    markdown += `*生成时间: ${this.formatDate(metadata.generatedAt)}*\n`;

    return markdown;
  }

  formatRiskItem(risk, index) {
    let item = `#### ${index}. ${risk.description}\n\n`;
    item += `- **时间**: ${this.formatTimestamp(risk.timestamp)}\n`;
    item += `- **位置**: (${risk.location.x.toFixed(2)}, ${risk.location.z.toFixed(2)})\n`;
    item += `- **类型**: ${this.getRiskTypeLabel(risk.type)}\n`;
    
    if (risk.details) {
      item += `- **详情**:\n`;
      Object.entries(risk.details).forEach(([key, value]) => {
        const formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
        item += `  - ${this.formatDetailKey(key)}: ${formattedValue}\n`;
      });
    }
    
    item += `\n`;
    return item;
  }

  getRiskTypeLabel(type) {
    const labels = {
      blind_spot: '货架盲区',
      near_miss: '近失事件',
      wrong_way: '逆行违规',
      turning_blind_spot: '转弯盲区'
    };
    return labels[type] || type;
  }

  formatDetailKey(key) {
    const keyMap = {
      rackId: '货架ID',
      rackName: '货架名称',
      distance: '距离(m)',
      angleToRack: '与货架角度(°)',
      isObscured: '是否遮挡',
      angleChange: '角度变化(°)',
      turningDirection: '转向',
      extraBlindDistance: '额外盲区距离(m)',
      timeDifference: '时间差(ms)',
      forkliftLocation: '叉车位置',
      pedestrianLocation: '行人位置',
      pedestrianId: '行人ID',
      currentDirection: '当前方向(°)',
      allowedDirection: '允许方向',
      aisleId: '通道ID',
      aisleName: '通道名称'
    };
    return keyMap[key] || key;
  }

  formatTimestamp(timestamp) {
    if (!timestamp) return '未知时间';
    
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        const hours = Math.floor(timestamp / 3600000);
        const minutes = Math.floor((timestamp % 3600000) / 60000);
        const seconds = Math.floor((timestamp % 60000) / 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      return date.toLocaleTimeString('zh-CN', { hour12: false });
    } catch (e) {
      return '时间解析错误';
    }
  }

  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (e) {
      return dateString;
    }
  }

  downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  downloadJSON(filename = 'risk-report.json') {
    const content = this.exportToJSON();
    this.downloadFile(content, filename, 'application/json');
  }

  downloadMarkdown(filename = 'risk-report.md') {
    const content = this.exportToMarkdown();
    this.downloadFile(content, filename, 'text/markdown');
  }

  getReportData() {
    return this.reportData;
  }
}

export default ReportExporter;
