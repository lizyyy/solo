const { Op } = require('sequelize');
const { Device, ScanRecord, PairingEvent, Zone, Anomaly, HandlingRecord, sequelize } = require('../models');

class ReportGenerator {
  constructor() {}

  async generateReport(options = {}) {
    const { 
      format = 'markdown',
      includeHighRisk = true,
      includeZoneIssues = true,
      includePairingFailures = true,
      includePendingActions = true,
      timeRange = null
    } = options;

    const reportData = {
      generatedAt: new Date().toISOString(),
      summary: {},
      highRiskDevices: [],
      zoneIssues: [],
      pairingFailures: [],
      pendingActions: [],
      statistics: {}
    };

    const summary = await this.getSummary(timeRange);
    reportData.summary = summary;

    if (includeHighRisk) {
      reportData.highRiskDevices = await this.getHighRiskDevices(timeRange);
    }

    if (includeZoneIssues) {
      reportData.zoneIssues = await this.getZoneIssues(timeRange);
    }

    if (includePairingFailures) {
      reportData.pairingFailures = await this.getPairingFailures(timeRange);
    }

    if (includePendingActions) {
      reportData.pendingActions = await this.getPendingActions();
    }

    reportData.statistics = await this.getStatistics(timeRange);

    switch (format.toLowerCase()) {
      case 'html':
        return this.formatAsHTML(reportData);
      case 'csv':
        return this.formatAsCSV(reportData);
      case 'markdown':
      default:
        return this.formatAsMarkdown(reportData);
    }
  }

  async getSummary(timeRange) {
    const deviceCount = await Device.count();
    const activeDevices = await Device.count({ where: { status: 'active' } });
    const devicesWithRiskTags = await Device.count({
      where: sequelize.where(
        sequelize.fn('json_array_length', sequelize.col('risk_tags')),
        Op.gt,
        0
      )
    });

    const openAnomalies = await Anomaly.count({
      where: { status: { [Op.in]: ['open', 'acknowledged', 'investigating'] } }
    });

    const criticalAnomalies = await Anomaly.count({
      where: { 
        severity: 'critical',
        status: { [Op.in]: ['open', 'acknowledged', 'investigating'] }
      }
    });

    return {
      totalDevices: deviceCount,
      activeDevices,
      devicesWithRiskTags,
      openAnomalies,
      criticalAnomalies,
      riskScore: Math.round((devicesWithRiskTags / deviceCount) * 100) || 0
    };
  }

  async getHighRiskDevices(timeRange) {
    const highRiskAnomalies = await Anomaly.findAll({
      where: {
        severity: { [Op.in]: ['critical', 'high'] },
        status: { [Op.in]: ['open', 'acknowledged', 'investigating'] }
      },
      include: [
        { model: Device, as: 'device' }
      ],
      order: [['risk_score', 'DESC']],
      limit: 50
    });

    return highRiskAnomalies.map(anomaly => ({
      anomalyId: anomaly.id,
      anomalyType: anomaly.anomaly_type,
      anomalyTypeLabel: this.getAnomalyTypeLabel(anomaly.anomaly_type),
      severity: anomaly.severity,
      riskScore: anomaly.risk_score,
      title: anomaly.title,
      description: anomaly.description,
      detectedAt: anomaly.detected_at,
      device: anomaly.device ? {
        id: anomaly.device.id,
        macAddress: anomaly.device.mac_address,
        deviceName: anomaly.device.device_name,
        deviceType: anomaly.device.device_type,
        deviceTypeLabel: this.getDeviceTypeLabel(anomaly.device.device_type),
        batteryLevel: anomaly.device.battery_level,
        status: anomaly.device.status,
        riskTags: anomaly.device.risk_tags
      } : null,
      evidence: anomaly.evidence
    }));
  }

  async getZoneIssues(timeRange) {
    const zoneViolations = await Anomaly.findAll({
      where: {
        anomaly_type: 'zone_violation',
        status: { [Op.in]: ['open', 'acknowledged', 'investigating'] }
      },
      include: [
        { model: Device, as: 'device' },
        { model: Zone, as: 'zone' }
      ],
      order: [['detected_at', 'DESC']]
    });

    const zones = await Zone.findAll({
      include: [
        { model: Device, as: 'devices' }
      ]
    });

    const zoneStats = zones.map(zone => ({
      zoneId: zone.id,
      zoneName: zone.zone_name,
      zoneCode: zone.zone_code,
      zoneType: zone.zone_type,
      zoneTypeLabel: this.getZoneTypeLabel(zone.zone_type),
      deviceCount: zone.devices ? zone.devices.length : 0,
      rssiThreshold: zone.rssi_threshold,
      violations: zoneViolations.filter(v => v.zone_id === zone.id).length
    }));

    return {
      summary: zoneStats,
      violations: zoneViolations.map(violation => ({
        violationId: violation.id,
        title: violation.title,
        description: violation.description,
        detectedAt: violation.detected_at,
        severity: violation.severity,
        device: violation.device ? {
          id: violation.device.id,
          macAddress: violation.device.mac_address,
          deviceName: violation.device.device_name,
          deviceType: violation.device.device_type
        } : null,
        zone: violation.zone ? {
          id: violation.zone.id,
          name: violation.zone.zone_name,
          code: violation.zone.zone_code
        } : null,
        evidence: violation.evidence
      }))
    };
  }

  async getPairingFailures(timeRange) {
    const whereClause = { status: 'failed' };
    
    if (timeRange && timeRange.start && timeRange.end) {
      whereClause.event_timestamp = { [Op.between]: [timeRange.start, timeRange.end] };
    }

    const failedEvents = await PairingEvent.findAll({
      where: whereClause,
      include: [
        { model: Device, as: 'device' }
      ],
      order: [['event_timestamp', 'DESC']],
      limit: 100
    });

    const byDevice = {};
    const byErrorCode = {};

    for (const event of failedEvents) {
      const mac = event.mac_address;
      if (!byDevice[mac]) {
        byDevice[mac] = {
          macAddress: mac,
          deviceName: event.device ? event.device.device_name : null,
          deviceType: event.device ? event.device.device_type : null,
          count: 0,
          recentFailures: []
        };
      }
      byDevice[mac].count++;
      byDevice[mac].recentFailures.push({
        timestamp: event.event_timestamp,
        errorCode: event.error_code,
        errorMessage: event.error_message,
        hostDevice: event.host_device
      });

      const errorCode = event.error_code || 'UNKNOWN';
      if (!byErrorCode[errorCode]) {
        byErrorCode[errorCode] = {
          errorCode,
          count: 0,
          affectedDevices: new Set()
        };
      }
      byErrorCode[errorCode].count++;
      byErrorCode[errorCode].affectedDevices.add(mac);
    }

    return {
      summary: {
        totalFailures: failedEvents.length,
        affectedDevices: Object.keys(byDevice).length
      },
      byDevice: Object.values(byDevice)
        .filter(d => d.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
        .map(d => ({
          ...d,
          affectedDevices: undefined,
          deviceTypeLabel: this.getDeviceTypeLabel(d.deviceType)
        })),
      byErrorCode: Object.values(byErrorCode).map(e => ({
        ...e,
        affectedDevices: Array.from(e.affectedDevices)
      }))
    };
  }

  async getPendingActions() {
    const openAnomalies = await Anomaly.findAll({
      where: {
        status: { [Op.in]: ['open', 'acknowledged', 'investigating'] }
      },
      include: [
        { model: Device, as: 'device' },
        { model: Zone, as: 'zone' },
        { model: HandlingRecord, as: 'handlingRecords', limit: 5 }
      ],
      order: [
        ['severity', 'DESC'],
        ['risk_score', 'DESC'],
        ['detected_at', 'ASC']
      ]
    });

    return openAnomalies.map(anomaly => ({
      anomalyId: anomaly.id,
      anomalyType: anomaly.anomaly_type,
      anomalyTypeLabel: this.getAnomalyTypeLabel(anomaly.anomaly_type),
      severity: anomaly.severity,
      riskScore: anomaly.risk_score,
      status: anomaly.status,
      statusLabel: this.getStatusLabel(anomaly.status),
      title: anomaly.title,
      description: anomaly.description,
      detectedAt: anomaly.detected_at,
      assignedTo: anomaly.assigned_to,
      device: anomaly.device ? {
        id: anomaly.device.id,
        macAddress: anomaly.device.mac_address,
        deviceName: anomaly.device.device_name,
        deviceType: anomaly.device.device_type
      } : null,
      zone: anomaly.zone ? {
        id: anomaly.zone.id,
        name: anomaly.zone.zone_name
      } : null,
      handlingRecords: anomaly.handlingRecords ? anomaly.handlingRecords.map(r => ({
        id: r.id,
        actionType: r.action_type,
        actionTypeLabel: this.getActionTypeLabel(r.action_type),
        actionTime: r.action_time,
        handler: r.handler,
        details: r.details,
        result: r.result
      })) : []
    }));
  }

  async getStatistics(timeRange) {
    const deviceStats = await Device.findAll({
      attributes: [
        'device_type',
        [sequelize.fn('count', sequelize.col('id')), 'count'],
        [sequelize.fn('sum', sequelize.literal('CASE WHEN battery_level < 20 THEN 1 ELSE 0 END')), 'low_battery_count']
      ],
      group: ['device_type']
    });

    const anomalyStats = await Anomaly.findAll({
      attributes: [
        'anomaly_type',
        'severity',
        [sequelize.fn('count', sequelize.col('id')), 'count']
      ],
      where: {
        status: { [Op.in]: ['open', 'acknowledged', 'investigating'] }
      },
      group: ['anomaly_type', 'severity']
    });

    return {
      byDeviceType: deviceStats.map(s => ({
        deviceType: s.device_type,
        deviceTypeLabel: this.getDeviceTypeLabel(s.device_type),
        count: parseInt(s.dataValues.count),
        lowBatteryCount: parseInt(s.dataValues.low_battery_count)
      })),
      byAnomalyType: anomalyStats.map(s => ({
        anomalyType: s.anomaly_type,
        anomalyTypeLabel: this.getAnomalyTypeLabel(s.anomaly_type),
        severity: s.severity,
        count: parseInt(s.dataValues.count)
      }))
    };
  }

  getDeviceTypeLabel(type) {
    const labels = {
      'esl': '电子价签',
      'printer': '小票打印机',
      'beacon': 'Beacon信标',
      'scanner': '扫码枪',
      'headset': '员工耳机',
      'other': '其他设备'
    };
    return labels[type] || type;
  }

  getAnomalyTypeLabel(type) {
    const labels = {
      'rssi_fluctuation': 'RSSI信号波动',
      'long_disconnect': '长时间失联',
      'duplicate_device': '重复设备',
      'random_address_drift': '随机地址漂移',
      'low_battery': '低电量',
      'pairing_failures': '配对失败',
      'zone_violation': '区域越界',
      'scan_failure': '扫描失败',
      'connection_drop': '连接断开',
      'unknown': '未知异常'
    };
    return labels[type] || type;
  }

  getZoneTypeLabel(type) {
    const labels = {
      'warehouse': '仓库',
      'retail': '零售区',
      'office': '办公区',
      'storage': '存储区',
      'entrance': '入口区',
      'checkout': '收银区',
      'other': '其他区域'
    };
    return labels[type] || type;
  }

  getStatusLabel(status) {
    const labels = {
      'open': '待处理',
      'acknowledged': '已确认',
      'investigating': '调查中',
      'resolved': '已解决',
      'false_positive': '误报'
    };
    return labels[status] || status;
  }

  getActionTypeLabel(type) {
    const labels = {
      'acknowledge': '确认异常',
      'investigate': '开始调查',
      'assign': '分配任务',
      'visit_site': '现场排查',
      'replace_battery': '更换电池',
      're_pair': '重新配对',
      'replace_device': '更换设备',
      'update_config': '更新配置',
      'mark_false_positive': '标记误报',
      'resolve': '标记解决',
      'comment': '添加备注',
      'other': '其他操作'
    };
    return labels[type] || type;
  }

  getSeverityColor(severity) {
    const colors = {
      'critical': '#dc2626',
      'high': '#ea580c',
      'medium': '#ca8a04',
      'low': '#2563eb',
      'info': '#16a34a'
    };
    return colors[severity] || '#6b7280';
  }

  formatAsMarkdown(data) {
    const lines = [];

    lines.push('# 蓝牙巡检报告');
    lines.push('');
    lines.push(`**生成时间**: ${new Date(data.generatedAt).toLocaleString('zh-CN')}`);
    lines.push('');

    lines.push('## 一、概览');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 设备总数 | ${data.summary.totalDevices} |`);
    lines.push(`| 活跃设备 | ${data.summary.activeDevices} |`);
    lines.push(`| 带风险标签设备 | ${data.summary.devicesWithRiskTags} |`);
    lines.push(`| 待处理异常 | ${data.summary.openAnomalies} |`);
    lines.push(`| 严重异常 | ${data.summary.criticalAnomalies} |`);
    lines.push(`| 风险评分 | ${data.summary.riskScore}/100 |`);
    lines.push('');

    lines.push('## 二、高风险设备');
    lines.push('');

    if (data.highRiskDevices.length === 0) {
      lines.push('暂无高风险设备。');
      lines.push('');
    } else {
      const criticalDevices = data.highRiskDevices.filter(d => d.severity === 'critical');
      const highDevices = data.highRiskDevices.filter(d => d.severity === 'high');

      if (criticalDevices.length > 0) {
        lines.push('### 严重 (Critical)');
        lines.push('');
        lines.push('| 设备MAC | 设备名称 | 类型 | 异常类型 | 风险分数 | 描述 |');
        lines.push('|---------|---------|------|---------|---------|------|');
        for (const d of criticalDevices.slice(0, 10)) {
          const deviceName = d.device?.deviceName || '-';
          const deviceType = d.device?.deviceTypeLabel || '-';
          lines.push(`| ${d.device?.macAddress || '-'} | ${deviceName} | ${deviceType} | ${d.anomalyTypeLabel} | ${d.riskScore} | ${d.title} |`);
        }
        lines.push('');
      }

      if (highDevices.length > 0) {
        lines.push('### 高危 (High)');
        lines.push('');
        lines.push('| 设备MAC | 设备名称 | 类型 | 异常类型 | 风险分数 | 描述 |');
        lines.push('|---------|---------|------|---------|---------|------|');
        for (const d of highDevices.slice(0, 10)) {
          const deviceName = d.device?.deviceName || '-';
          const deviceType = d.device?.deviceTypeLabel || '-';
          lines.push(`| ${d.device?.macAddress || '-'} | ${deviceName} | ${deviceType} | ${d.anomalyTypeLabel} | ${d.riskScore} | ${d.title} |`);
        }
        lines.push('');
      }
    }

    lines.push('## 三、区域问题');
    lines.push('');

    if (data.zoneIssues.violations.length === 0) {
      lines.push('暂无区域越界问题。');
      lines.push('');
    } else {
      lines.push('### 区域统计');
      lines.push('');
      lines.push('| 区域名称 | 区域类型 | 设备数 | 越界数 |');
      lines.push('|---------|---------|--------|--------|');
      for (const z of data.zoneIssues.summary) {
        lines.push(`| ${z.zoneName} | ${z.zoneTypeLabel} | ${z.deviceCount} | ${z.violations} |`);
      }
      lines.push('');

      lines.push('### 越界详情');
      lines.push('');
      lines.push('| 时间 | 设备 | 区域 | 描述 | 严重程度 |');
      lines.push('|------|------|------|------|---------|');
      for (const v of data.zoneIssues.violations.slice(0, 15)) {
        const deviceInfo = v.device ? `${v.device.macAddress} (${v.device.deviceName || '-'})` : '-';
        const zoneInfo = v.zone ? v.zone.name : '-';
        const time = new Date(v.detectedAt).toLocaleString('zh-CN');
        lines.push(`| ${time} | ${deviceInfo} | ${zoneInfo} | ${v.description} | ${v.severity} |`);
      }
      lines.push('');
    }

    lines.push('## 四、配对失败汇总');
    lines.push('');

    if (data.pairingFailures.summary.totalFailures === 0) {
      lines.push('暂无配对失败记录。');
      lines.push('');
    } else {
      lines.push(`**总失败次数**: ${data.pairingFailures.summary.totalFailures}`);
      lines.push(`**受影响设备数**: ${data.pairingFailures.summary.affectedDevices}`);
      lines.push('');

      if (data.pairingFailures.byDevice.length > 0) {
        lines.push('### 按设备统计');
        lines.push('');
        lines.push('| 设备MAC | 设备名称 | 类型 | 失败次数 |');
        lines.push('|---------|---------|------|---------|');
        for (const d of data.pairingFailures.byDevice.slice(0, 10)) {
          lines.push(`| ${d.macAddress} | ${d.deviceName || '-'} | ${d.deviceTypeLabel || '-'} | ${d.count} |`);
        }
        lines.push('');
      }

      if (data.pairingFailures.byErrorCode.length > 0) {
        lines.push('### 按错误码统计');
        lines.push('');
        lines.push('| 错误码 | 失败次数 | 受影响设备数 |');
        lines.push('|--------|---------|-------------|');
        for (const e of data.pairingFailures.byErrorCode) {
          lines.push(`| ${e.errorCode} | ${e.count} | ${e.affectedDevices.length} |`);
        }
        lines.push('');
      }
    }

    lines.push('## 五、待处理清单');
    lines.push('');

    if (data.pendingActions.length === 0) {
      lines.push('暂无待处理事项。');
      lines.push('');
    } else {
      lines.push('| ID | 异常类型 | 严重程度 | 状态 | 设备 | 描述 | 分配给 |');
      lines.push('|----|---------|---------|------|------|------|--------|');
      for (const a of data.pendingActions.slice(0, 20)) {
        const deviceInfo = a.device ? `${a.device.macAddress} (${a.device.deviceName || '-'})` : '-';
        lines.push(`| ${a.anomalyId} | ${a.anomalyTypeLabel} | ${a.severity} | ${a.statusLabel} | ${deviceInfo} | ${a.title} | ${a.assignedTo || '-'} |`);
      }
      lines.push('');
    }

    lines.push('## 六、统计数据');
    lines.push('');

    if (data.statistics.byDeviceType.length > 0) {
      lines.push('### 设备类型分布');
      lines.push('');
      lines.push('| 设备类型 | 数量 | 低电量数 |');
      lines.push('|---------|------|---------|');
      for (const s of data.statistics.byDeviceType) {
        lines.push(`| ${s.deviceTypeLabel} | ${s.count} | ${s.lowBatteryCount} |`);
      }
      lines.push('');
    }

    if (data.statistics.byAnomalyType.length > 0) {
      lines.push('### 异常类型分布');
      lines.push('');
      lines.push('| 异常类型 | 严重程度 | 数量 |');
      lines.push('|---------|---------|------|');
      for (const s of data.statistics.byAnomalyType) {
        lines.push(`| ${s.anomalyTypeLabel} | ${s.severity} | ${s.count} |`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('*报告由蓝牙巡检工具自动生成*');

    return lines.join('\n');
  }

  formatAsHTML(data) {
    const lines = [];

    lines.push('<!DOCTYPE html>');
    lines.push('<html lang="zh-CN">');
    lines.push('<head>');
    lines.push('  <meta charset="UTF-8">');
    lines.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
    lines.push('  <title>蓝牙巡检报告</title>');
    lines.push('  <style>');
    lines.push('    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; background: #f9fafb; }');
    lines.push('    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }');
    lines.push('    h1 { color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }');
    lines.push('    h2 { color: #374151; margin-top: 30px; border-left: 4px solid #3b82f6; padding-left: 10px; }');
    lines.push('    h3 { color: #4b5563; margin-top: 20px; }');
    lines.push('    table { width: 100%; border-collapse: collapse; margin: 15px 0; }');
    lines.push('    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }');
    lines.push('    th { background: #f3f4f6; font-weight: 600; color: #374151; }');
    lines.push('    tr:hover { background: #f9fafb; }');
    lines.push('    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }');
    lines.push('    .summary-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }');
    lines.push('    .summary-card h3 { color: white; margin: 0 0 10px 0; font-size: 14px; opacity: 0.9; }');
    lines.push('    .summary-card .value { font-size: 32px; font-weight: bold; }');
    lines.push('    .critical { color: #dc2626; }');
    lines.push('    .high { color: #ea580c; }');
    lines.push('    .medium { color: #ca8a04; }');
    lines.push('    .low { color: #2563eb; }');
    lines.push('    .badge { padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }');
    lines.push('    .badge-critical { background: #fef2f2; color: #dc2626; }');
    lines.push('    .badge-high { background: #fff7ed; color: #ea580c; }');
    lines.push('    .badge-medium { background: #fefce8; color: #ca8a04; }');
    lines.push('    .badge-low { background: #eff6ff; color: #2563eb; }');
    lines.push('    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px; }');
    lines.push('  </style>');
    lines.push('</head>');
    lines.push('<body>');
    lines.push('<div class="container">');

    lines.push('<h1>蓝牙巡检报告</h1>');
    lines.push(`<p><strong>生成时间:</strong> ${new Date(data.generatedAt).toLocaleString('zh-CN')}</p>`);

    lines.push('<h2>一、概览</h2>');
    lines.push('<div class="summary-grid">');
    lines.push(`  <div class="summary-card"><h3>设备总数</h3><div class="value">${data.summary.totalDevices}</div></div>`);
    lines.push(`  <div class="summary-card"><h3>活跃设备</h3><div class="value">${data.summary.activeDevices}</div></div>`);
    lines.push(`  <div class="summary-card"><h3>带风险标签</h3><div class="value">${data.summary.devicesWithRiskTags}</div></div>`);
    lines.push(`  <div class="summary-card"><h3>待处理异常</h3><div class="value">${data.summary.openAnomalies}</div></div>`);
    lines.push(`  <div class="summary-card"><h3>严重异常</h3><div class="value">${data.summary.criticalAnomalies}</div></div>`);
    lines.push(`  <div class="summary-card"><h3>风险评分</h3><div class="value">${data.summary.riskScore}/100</div></div>`);
    lines.push('</div>');

    lines.push('<h2>二、高风险设备</h2>');

    if (data.highRiskDevices.length === 0) {
      lines.push('<p>暂无高风险设备。</p>');
    } else {
      const criticalDevices = data.highRiskDevices.filter(d => d.severity === 'critical');
      const highDevices = data.highRiskDevices.filter(d => d.severity === 'high');

      if (criticalDevices.length > 0) {
        lines.push('<h3>严重 (Critical)</h3>');
        lines.push('<table>');
        lines.push('<thead><tr><th>设备MAC</th><th>设备名称</th><th>类型</th><th>异常类型</th><th>风险分数</th><th>描述</th></tr></thead>');
        lines.push('<tbody>');
        for (const d of criticalDevices.slice(0, 10)) {
          const deviceName = d.device?.deviceName || '-';
          const deviceType = d.device?.deviceTypeLabel || '-';
          lines.push(`<tr><td>${d.device?.macAddress || '-'}</td><td>${deviceName}</td><td>${deviceType}</td><td><span class="badge badge-critical">${d.anomalyTypeLabel}</span></td><td>${d.riskScore}</td><td>${d.title}</td></tr>`);
        }
        lines.push('</tbody></table>');
      }

      if (highDevices.length > 0) {
        lines.push('<h3>高危 (High)</h3>');
        lines.push('<table>');
        lines.push('<thead><tr><th>设备MAC</th><th>设备名称</th><th>类型</th><th>异常类型</th><th>风险分数</th><th>描述</th></tr></thead>');
        lines.push('<tbody>');
        for (const d of highDevices.slice(0, 10)) {
          const deviceName = d.device?.deviceName || '-';
          const deviceType = d.device?.deviceTypeLabel || '-';
          lines.push(`<tr><td>${d.device?.macAddress || '-'}</td><td>${deviceName}</td><td>${deviceType}</td><td><span class="badge badge-high">${d.anomalyTypeLabel}</span></td><td>${d.riskScore}</td><td>${d.title}</td></tr>`);
        }
        lines.push('</tbody></table>');
      }
    }

    lines.push('<h2>三、区域问题</h2>');

    if (data.zoneIssues.violations.length === 0) {
      lines.push('<p>暂无区域越界问题。</p>');
    } else {
      lines.push('<h3>区域统计</h3>');
      lines.push('<table>');
      lines.push('<thead><tr><th>区域名称</th><th>区域类型</th><th>设备数</th><th>越界数</th></tr></thead>');
      lines.push('<tbody>');
      for (const z of data.zoneIssues.summary) {
        lines.push(`<tr><td>${z.zoneName}</td><td>${z.zoneTypeLabel}</td><td>${z.deviceCount}</td><td>${z.violations}</td></tr>`);
      }
      lines.push('</tbody></table>');

      lines.push('<h3>越界详情</h3>');
      lines.push('<table>');
      lines.push('<thead><tr><th>时间</th><th>设备</th><th>区域</th><th>描述</th><th>严重程度</th></tr></thead>');
      lines.push('<tbody>');
      for (const v of data.zoneIssues.violations.slice(0, 15)) {
        const deviceInfo = v.device ? `${v.device.macAddress} (${v.device.deviceName || '-'})` : '-';
        const zoneInfo = v.zone ? v.zone.name : '-';
        const time = new Date(v.detectedAt).toLocaleString('zh-CN');
        const severityClass = v.severity === 'critical' ? 'badge-critical' : (v.severity === 'high' ? 'badge-high' : 'badge-medium');
        lines.push(`<tr><td>${time}</td><td>${deviceInfo}</td><td>${zoneInfo}</td><td>${v.description}</td><td><span class="badge ${severityClass}">${v.severity}</span></td></tr>`);
      }
      lines.push('</tbody></table>');
    }

    lines.push('<h2>四、配对失败汇总</h2>');

    if (data.pairingFailures.summary.totalFailures === 0) {
      lines.push('<p>暂无配对失败记录。</p>');
    } else {
      lines.push(`<p><strong>总失败次数:</strong> ${data.pairingFailures.summary.totalFailures} | <strong>受影响设备数:</strong> ${data.pairingFailures.summary.affectedDevices}</p>`);

      if (data.pairingFailures.byDevice.length > 0) {
        lines.push('<h3>按设备统计</h3>');
        lines.push('<table>');
        lines.push('<thead><tr><th>设备MAC</th><th>设备名称</th><th>类型</th><th>失败次数</th></tr></thead>');
        lines.push('<tbody>');
        for (const d of data.pairingFailures.byDevice.slice(0, 10)) {
          lines.push(`<tr><td>${d.macAddress}</td><td>${d.deviceName || '-'}</td><td>${d.deviceTypeLabel || '-'}</td><td>${d.count}</td></tr>`);
        }
        lines.push('</tbody></table>');
      }

      if (data.pairingFailures.byErrorCode.length > 0) {
        lines.push('<h3>按错误码统计</h3>');
        lines.push('<table>');
        lines.push('<thead><tr><th>错误码</th><th>失败次数</th><th>受影响设备数</th></tr></thead>');
        lines.push('<tbody>');
        for (const e of data.pairingFailures.byErrorCode) {
          lines.push(`<tr><td>${e.errorCode}</td><td>${e.count}</td><td>${e.affectedDevices.length}</td></tr>`);
        }
        lines.push('</tbody></table>');
      }
    }

    lines.push('<h2>五、待处理清单</h2>');

    if (data.pendingActions.length === 0) {
      lines.push('<p>暂无待处理事项。</p>');
    } else {
      lines.push('<table>');
      lines.push('<thead><tr><th>ID</th><th>异常类型</th><th>严重程度</th><th>状态</th><th>设备</th><th>描述</th><th>分配给</th></tr></thead>');
      lines.push('<tbody>');
      for (const a of data.pendingActions.slice(0, 20)) {
        const deviceInfo = a.device ? `${a.device.macAddress} (${a.device.deviceName || '-'})` : '-';
        const severityClass = a.severity === 'critical' ? 'badge-critical' : (a.severity === 'high' ? 'badge-high' : (a.severity === 'medium' ? 'badge-medium' : 'badge-low'));
        lines.push(`<tr><td>${a.anomalyId}</td><td><span class="badge ${severityClass}">${a.anomalyTypeLabel}</span></td><td>${a.severity}</td><td>${a.statusLabel}</td><td>${deviceInfo}</td><td>${a.title}</td><td>${a.assignedTo || '-'}</td></tr>`);
      }
      lines.push('</tbody></table>');
    }

    lines.push('<div class="footer">');
    lines.push('  <p>报告由蓝牙巡检工具自动生成</p>');
    lines.push(`  <p>生成时间: ${new Date(data.generatedAt).toLocaleString('zh-CN')}</p>`);
    lines.push('</div>');

    lines.push('</div>');
    lines.push('</body>');
    lines.push('</html>');

    return lines.join('\n');
  }

  formatAsCSV(data) {
    const sections = [];

    sections.push('=== 概览 ===');
    sections.push('指标,数值');
    sections.push(`设备总数,${data.summary.totalDevices}`);
    sections.push(`活跃设备,${data.summary.activeDevices}`);
    sections.push(`带风险标签设备,${data.summary.devicesWithRiskTags}`);
    sections.push(`待处理异常,${data.summary.openAnomalies}`);
    sections.push(`严重异常,${data.summary.criticalAnomalies}`);
    sections.push(`风险评分,${data.summary.riskScore}/100`);
    sections.push('');

    sections.push('=== 高风险设备 ===');
    if (data.highRiskDevices.length > 0) {
      sections.push('设备MAC,设备名称,设备类型,异常类型,严重程度,风险分数,描述');
      for (const d of data.highRiskDevices.slice(0, 30)) {
        const deviceMac = d.device?.macAddress || '-';
        const deviceName = (d.device?.deviceName || '-').replace(/,/g, ';');
        const deviceType = d.device?.deviceTypeLabel || '-';
        const title = d.title.replace(/,/g, ';');
        sections.push(`${deviceMac},${deviceName},${deviceType},${d.anomalyTypeLabel},${d.severity},${d.riskScore},${title}`);
      }
    } else {
      sections.push('暂无高风险设备');
    }
    sections.push('');

    sections.push('=== 配对失败汇总 ===');
    sections.push(`总失败次数,${data.pairingFailures.summary.totalFailures}`);
    sections.push(`受影响设备数,${data.pairingFailures.summary.affectedDevices}`);
    if (data.pairingFailures.byDevice.length > 0) {
      sections.push('');
      sections.push('按设备统计:');
      sections.push('设备MAC,设备名称,设备类型,失败次数');
      for (const d of data.pairingFailures.byDevice.slice(0, 30)) {
        const deviceName = (d.deviceName || '-').replace(/,/g, ';');
        sections.push(`${d.macAddress},${deviceName},${d.deviceTypeLabel || '-'},${d.count}`);
      }
    }
    sections.push('');

    sections.push('=== 待处理清单 ===');
    if (data.pendingActions.length > 0) {
      sections.push('异常ID,异常类型,严重程度,状态,设备MAC,设备名称,描述,分配给');
      for (const a of data.pendingActions.slice(0, 50)) {
        const deviceMac = a.device?.macAddress || '-';
        const deviceName = (a.device?.deviceName || '-').replace(/,/g, ';');
        const title = a.title.replace(/,/g, ';');
        sections.push(`${a.anomalyId},${a.anomalyTypeLabel},${a.severity},${a.statusLabel},${deviceMac},${deviceName},${title},${a.assignedTo || '-'}`);
      }
    } else {
      sections.push('暂无待处理事项');
    }

    return sections.join('\n');
  }
}

module.exports = ReportGenerator;
