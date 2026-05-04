import { TimeUtils } from './timeUtils.js';

export const Exporter = {
  exportMarkdownReview(dataManager, riskEvents, options = {}) {
    const summary = dataManager.getDataSummary();
    const riskSummary = this.calculateRiskSummary(riskEvents);
    
    let markdown = `# 机坪作业复盘报告\n\n`;
    
    markdown += `## 一、概览\n\n`;
    markdown += `- **生成时间**: ${new Date().toLocaleString('zh-CN')}\n`;
    markdown += `- **数据时间范围**: ${summary.timeRange.start} - ${summary.timeRange.end}\n`;
    markdown += `- **机位数量**: ${summary.stands}\n`;
    markdown += `- **车辆数量**: ${summary.vehicles}\n`;
    markdown += `- **航班数量**: ${summary.turnarounds}\n\n`;
    
    markdown += `## 二、风险统计\n\n`;
    markdown += `| 风险级别 | 数量 | 占比 |\n`;
    markdown += `|----------|------|------|\n`;
    const total = riskSummary.total || 1;
    markdown += `| 高危 | ${riskSummary.high} | ${((riskSummary.high / total) * 100).toFixed(1)}% |\n`;
    markdown += `| 中危 | ${riskSummary.medium} | ${((riskSummary.medium / total) * 100).toFixed(1)}% |\n`;
    markdown += `| 低危 | ${riskSummary.low} | ${((riskSummary.low / total) * 100).toFixed(1)}% |\n\n`;
    
    markdown += `### 按类型分布\n\n`;
    const typeLabels = {
      'speed_violation': '超速违规',
      'no_entry_violation': '禁入区违规',
      'vehicle_conflict': '车辆冲突',
      'fuel_bridge_overlap': '加油车与登机桥重叠'
    };
    
    for (const [type, count] of Object.entries(riskSummary.byType)) {
      markdown += `- **${typeLabels[type] || type}**: ${count} 起\n`;
    }
    markdown += '\n';
    
    markdown += `## 三、详细风险事件\n\n`;
    
    const sortedRisks = [...riskEvents].sort((a, b) => {
      const levelOrder = { high: 0, medium: 1, low: 2 };
      return levelOrder[a.level] - levelOrder[b.level] || a.startTime - b.startTime;
    });
    
    sortedRisks.forEach((risk, index) => {
      const levelText = { high: '🔴 高危', medium: '🟠 中危', low: '🟡 低危' };
      const typeText = {
        'speed_violation': '🚗 超速违规',
        'no_entry_violation': '🚫 禁入区违规',
        'vehicle_conflict': '💥 车辆冲突',
        'fuel_bridge_overlap': '⛽ 加油车与登机桥重叠'
      };
      
      markdown += `### 风险 #${index + 1} - ${levelText[risk.level] || risk.level}\n\n`;
      markdown += `- **类型**: ${typeText[risk.type] || risk.type}\n`;
      markdown += `- **开始时间**: ${TimeUtils.formatTime(risk.startTime)}\n`;
      markdown += `- **结束时间**: ${TimeUtils.formatTime(risk.endTime)}\n`;
      markdown += `- **持续时间**: ${(risk.duration / 1000).toFixed(1)} 秒\n`;
      markdown += `- **描述**: ${risk.description}\n\n`;
      
      if (risk.metadata) {
        markdown += `**详细信息**:\n\n`;
        markdown += '```\n';
        
        if (risk.metadata.vehicleId) {
          markdown += `车辆ID: ${risk.metadata.vehicleId}\n`;
        }
        if (risk.metadata.vehicleType) {
          markdown += `车辆类型: ${risk.metadata.vehicleType}\n`;
        }
        if (risk.metadata.maxSpeed !== undefined) {
          markdown += `最高速度: ${risk.metadata.maxSpeed.toFixed(1)} km/h\n`;
        }
        if (risk.metadata.speedLimit !== undefined) {
          markdown += `限速: ${risk.metadata.speedLimit} km/h\n`;
        }
        if (risk.metadata.zoneName) {
          markdown += `禁入区域: ${risk.metadata.zoneName}\n`;
        }
        if (risk.metadata.vehicleId1 && risk.metadata.vehicleId2) {
          markdown += `车辆1: ${risk.metadata.vehicleType1} ${risk.metadata.vehicleId1}\n`;
          markdown += `车辆2: ${risk.metadata.vehicleType2} ${risk.metadata.vehicleId2}\n`;
          markdown += `最小距离: ${risk.metadata.minDistance.toFixed(1)} m\n`;
          markdown += `安全距离: ${risk.metadata.safeDistance} m\n`;
        }
        if (risk.metadata.flightNumber) {
          markdown += `航班号: ${risk.metadata.flightNumber}\n`;
          markdown += `机位: ${risk.metadata.standId}\n`;
          markdown += `加油车: ${risk.metadata.fuelVehicleId}\n`;
          markdown += `登机桥: ${risk.metadata.bridgeVehicleId}\n`;
          markdown += `重叠时间: ${(risk.metadata.overlapDuration / 1000).toFixed(0)} 秒\n`;
        }
        
        markdown += '```\n\n';
      }
    });
    
    markdown += `## 四、航班信息\n\n`;
    markdown += `| 航班号 | 机位 | 到达时间 | 出发时间 | 周转时间 |\n`;
    markdown += `|--------|------|----------|----------|----------|\n`;
    
    dataManager.turnarounds.forEach(ta => {
      const arrival = TimeUtils.formatTime(ta.arrivalTime);
      const departure = TimeUtils.formatTime(ta.departureTime);
      const duration = ta.arrivalTime && ta.departureTime 
        ? TimeUtils.calculateDuration(ta.arrivalTime, ta.departureTime)
        : 0;
      const durationStr = duration > 0 
        ? `${Math.floor(duration / 60000)}分${Math.floor((duration % 60000) / 1000)}秒`
        : '-';
      
      markdown += `| ${ta.flightNumber || ta.id} | ${ta.standId || '-'} | ${arrival} | ${departure} | ${durationStr} |\n`;
    });
    markdown += '\n';
    
    markdown += `## 五、车辆信息\n\n`;
    markdown += `| 车辆ID | 类型 | 轨迹点数 | 数据质量 |\n`;
    markdown += `|--------|------|----------|----------|\n`;
    
    dataManager.vehicles.forEach(v => {
      const hasGaps = v.hasGaps ? '有断点' : '正常';
      markdown += `| ${v.id} | ${v.type} | ${v.tracks?.length || 0} | ${hasGaps} |\n`;
    });
    markdown += '\n';
    
    markdown += `---\n`;
    markdown += `*报告由 3D 机坪作业复盘工具自动生成*\n`;
    
    return markdown;
  },

  exportRiskEventsCSV(riskEvents) {
    const headers = [
      '风险ID',
      '风险类型',
      '风险级别',
      '开始时间',
      '结束时间',
      '持续时间(秒)',
      '描述',
      '车辆ID1',
      '车辆类型1',
      '车辆ID2',
      '车辆类型2',
      '最高速度(km/h)',
      '限速(km/h)',
      '禁入区域',
      '航班号',
      '机位',
      '最小距离(m)',
      '安全距离(m)',
      '重叠时间(秒)'
    ];
    
    const typeLabels = {
      'speed_violation': '超速违规',
      'no_entry_violation': '禁入区违规',
      'vehicle_conflict': '车辆冲突',
      'fuel_bridge_overlap': '加油车与登机桥重叠'
    };
    
    const levelLabels = {
      'high': '高危',
      'medium': '中危',
      'low': '低危'
    };
    
    const rows = riskEvents.map(risk => {
      const meta = risk.metadata || {};
      return [
        risk.id,
        typeLabels[risk.type] || risk.type,
        levelLabels[risk.level] || risk.level,
        TimeUtils.formatTime(risk.startTime),
        TimeUtils.formatTime(risk.endTime),
        (risk.duration / 1000).toFixed(1),
        risk.description,
        meta.vehicleId || meta.vehicleId1 || '',
        meta.vehicleType || meta.vehicleType1 || '',
        meta.vehicleId2 || '',
        meta.vehicleType2 || '',
        meta.maxSpeed !== undefined ? meta.maxSpeed.toFixed(1) : '',
        meta.speedLimit || '',
        meta.zoneName || '',
        meta.flightNumber || '',
        meta.standId || '',
        meta.minDistance !== undefined ? meta.minDistance.toFixed(1) : '',
        meta.safeDistance || '',
        meta.overlapDuration ? (meta.overlapDuration / 1000).toFixed(0) : ''
      ].map(v => this.escapeCSVValue(v));
    });
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  },

  escapeCSVValue(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  },

  calculateRiskSummary(riskEvents) {
    const summary = {
      total: riskEvents.length,
      high: 0,
      medium: 0,
      low: 0,
      byType: {}
    };
    
    riskEvents.forEach(risk => {
      summary[risk.level] = (summary[risk.level] || 0) + 1;
      summary.byType[risk.type] = (summary.byType[risk.type] || 0) + 1;
    });
    
    return summary;
  },

  downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  downloadMarkdownReview(dataManager, riskEvents) {
    const content = this.exportMarkdownReview(dataManager, riskEvents);
    this.downloadFile(content, 'apron_review.md', 'text/markdown');
  },

  downloadRiskEventsCSV(riskEvents) {
    const content = this.exportRiskEventsCSV(riskEvents);
    this.downloadFile(content, 'risk_events.csv', 'text/csv');
  },

  downloadAll(dataManager, riskEvents) {
    this.downloadMarkdownReview(dataManager, riskEvents);
    setTimeout(() => {
      this.downloadRiskEventsCSV(riskEvents);
    }, 100);
  }
};

export default Exporter;
