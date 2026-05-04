import { db } from '../config/database.js';
import AssetModel from '../models/AssetModel.js';
import { 
  IPAddressModel, 
  NetworkSegmentModel, 
  VLANModel, 
  SwitchPortModel,
  DHCPLeaseModel 
} from '../models/NetworkModel.js';
import { 
  AlertModel, 
  FirewallRuleModel, 
  ChangeOrderModel, 
  RiskModel 
} from '../models/AlertChangeRiskModel.js';
import { 
  TopologyModel, 
  ServicePortModel, 
  RiskEngine 
} from '../models/TopologyRiskModel.js';

class ReportService {
  static generateReport(format = 'markdown') {
    const data = this.collectReportData();
    
    switch (format.toLowerCase()) {
      case 'markdown':
        return this.generateMarkdown(data);
      case 'html':
        return this.generateHTML(data);
      case 'csv':
        return this.generateCSV(data);
      default:
        return this.generateMarkdown(data);
    }
  }

  static collectReportData() {
    const assetStats = AssetModel.getStats();
    const alertStats = AlertModel.getStats();
    const changeStats = ChangeOrderModel.getStats();
    const riskStats = RiskModel.getStats();
    
    const highRiskDevices = RiskModel.findAll({ severity: 'high', is_resolved: false });
    const criticalRiskDevices = RiskModel.findAll({ severity: 'critical', is_resolved: false });
    const ipConflicts = RiskModel.findByType(RiskEngine.RISK_TYPES.IP_CONFLICT);
    const pendingChanges = ChangeOrderModel.findAll({ status: 'pending_evaluation' });
    const recentAlerts = AlertModel.findAll({ 
      is_acknowledged: false, 
      limit: 20 
    });

    const segments = NetworkSegmentModel.findAll();
    const segmentUtilization = segments.map(s => ({
      name: s.name,
      cidr: s.cidr,
      total: s.total_ips,
      used: s.used_ips,
      utilization: s.total_ips > 0 ? ((s.used_ips / s.total_ips) * 100).toFixed(1) : 0
    }));

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalAssets: assetStats.total,
        activeAlerts: alertStats.unacknowledged,
        pendingChanges: changeStats.pending,
        unresolvedRisks: riskStats.unresolved,
        highRiskCount: riskStats.highRisk
      },
      highRiskDevices: [...criticalRiskDevices, ...highRiskDevices],
      ipConflicts,
      pendingChanges,
      recentAlerts,
      segmentUtilization,
      recommendations: this.generateRecommendations({
        highRiskDevices: [...criticalRiskDevices, ...highRiskDevices],
        ipConflicts,
        pendingChanges,
        segments
      })
    };
  }

  static generateRecommendations(data) {
    const recommendations = [];

    if (data.ipConflicts && data.ipConflicts.length > 0) {
      recommendations.push({
        priority: 'critical',
        title: '立即处理IP地址冲突',
        description: `发现 ${data.ipConflicts.length} 个IP地址冲突，需要立即排查并解决。冲突IP可能导致网络中断和安全隐患。`,
        action: '建议步骤：1) 检查冲突设备的DHCP租约；2) 确认静态IP分配；3) 清理重复配置；4) 更新资产记录。'
      });
    }

    if (data.highRiskDevices && data.highRiskDevices.length > 0) {
      const criticalCount = data.highRiskDevices.filter(r => r.severity === 'critical').length;
      recommendations.push({
        priority: 'high',
        title: '处理高风险设备',
        description: `存在 ${data.highRiskDevices.length} 个高风险项（其中 ${criticalCount} 个严重），需要优先处理。`,
        action: '按优先级逐个排查：严重风险立即处理，高风险24小时内处理，中风险一周内处理。'
      });
    }

    if (data.segments) {
      const highUtilization = data.segments.filter(s => 
        s.total_ips > 0 && (s.used_ips / s.total_ips) >= 0.9
      );
      if (highUtilization.length > 0) {
        recommendations.push({
          priority: 'high',
          title: '网段容量规划',
          description: `${highUtilization.length} 个网段利用率超过90%，存在IP地址耗尽风险。`,
          action: '建议：1) 评估是否需要扩容网段；2) 清理未使用的静态IP；3) 考虑IP地址重新规划。'
        });
      }
    }

    if (data.pendingChanges && data.pendingChanges.length > 0) {
      recommendations.push({
        priority: 'medium',
        title: '待处理变更单',
        description: `有 ${data.pendingChanges.length} 个变更单等待评估或执行。`,
        action: '请及时审核和执行变更单，确保变更操作有完整的审批和回滚计划。'
      });
    }

    recommendations.push({
      priority: 'low',
      title: '定期审计建议',
      description: '建议定期执行以下审计操作以维护网络健康。',
      action: '建议周期：1) 每日检查告警和风险；2) 每周审核防火墙规则；3) 每月盘点资产；4) 每季度进行完整的网络扫描。'
    });

    return recommendations;
  }

  static generateMarkdown(data) {
    let md = `# 公司网络管理报告\n\n`;
    md += `**生成时间**: ${data.generatedAt}\n\n`;
    
    md += `## 执行摘要\n\n`;
    md += `| 指标 | 数值 |\n|------|------|\n`;
    md += `| 总资产数量 | ${data.summary.totalAssets} |\n`;
    md += `| 未处理告警 | ${data.summary.activeAlerts} |\n`;
    md += `| 待处理变更 | ${data.summary.pendingChanges} |\n`;
    md += `| 未解决风险 | ${data.summary.unresolvedRisks} |\n`;
    md += `| 高风险项 | ${data.summary.highRiskCount} |\n\n`;

    if (data.highRiskDevices && data.highRiskDevices.length > 0) {
      md += `## 高风险设备\n\n`;
      md += `| 严重程度 | 类型 | 标题 | 描述 | 关联IP |\n`;
      md += `|----------|------|------|------|--------|\n`;
      data.highRiskDevices.forEach( risk => {
        md += `| ${risk.severity.toUpperCase()} | ${risk.type} | ${risk.title} | ${risk.description || '-'} | ${risk.ip_address || '-'} |\n`;
      });
      md += `\n`;
    }

    if (data.ipConflicts && data.ipConflicts.length > 0) {
      md += `## IP地址冲突\n\n`;
      md += `| IP地址 | 标题 | 描述 |\n`;
      md += `|--------|------|------|\n`;
      data.ipConflicts.forEach( risk => {
        md += `| ${risk.ip_address || '-'} | ${risk.title} | ${risk.description || '-'} |\n`;
      });
      md += `\n`;
    }

    if (data.pendingChanges && data.pendingChanges.length > 0) {
      md += `## 待处理变更单\n\n`;
      md += `| 标题 | 类型 | 状态 | 请求时间 | 影响设备数 |\n`;
      md += `|------|------|------|----------|------------|\n`;
      data.pendingChanges.forEach( change => {
        md += `| ${change.title} | ${change.type} | ${change.status} | ${change.requested_at || '-'} | ${change.affected_count || 0} |\n`;
      });
      md += `\n`;
    }

    if (data.recentAlerts && data.recentAlerts.length > 0) {
      md += `## 近期告警摘要\n\n`;
      md += `| 严重程度 | 类型 | 标题 | 描述 | 创建时间 |\n`;
      md += `|----------|------|------|------|----------|\n`;
      data.recentAlerts.slice(0, 10).forEach( alert => {
        md += `| ${alert.severity.toUpperCase()} | ${alert.type} | ${alert.title} | ${alert.description || '-'} | ${alert.created_at || '-'} |\n`;
      });
      md += `\n`;
    }

    if (data.segmentUtilization && data.segmentUtilization.length > 0) {
      md += `## 网段利用率\n\n`;
      md += `| 网段名称 | CIDR | 总量 | 已用 | 利用率 |\n`;
      md += `|----------|------|------|------|--------|\n`;
      data.segmentUtilization.forEach( segment => {
        const utilClass = parseFloat(segment.utilization) >= 90 ? '**' : '';
        md += `| ${segment.name} | ${segment.cidr} | ${segment.total} | ${segment.used} | ${utilClass}${segment.utilization}%${utilClass} |\n`;
      });
      md += `\n`;
    }

    if (data.recommendations && data.recommendations.length > 0) {
      md += `## 整改建议\n\n`;
      data.recommendations.forEach( (rec, index) => {
        const priorityEmoji = rec.priority === 'critical' ? '🔴' : 
                              rec.priority === 'high' ? '🟠' : 
                              rec.priority === 'medium' ? '🟡' : '🟢';
        md += `### ${index + 1}. ${priorityEmoji} ${rec.title}\n\n`;
        md += `${rec.description}\n\n`;
        md += `**建议行动**: ${rec.action}\n\n`;
      });
    }

    return md;
  }

  static generateHTML(data) {
    const severityColors = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#28a745',
      info: '#17a2b8'
    };

    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>公司网络管理报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; max-width: 1200px; margin: 0 auto; }
        h1, h2, h3, h4 { color: #2c3e50; margin-top: 30px; margin-bottom: 15px; }
        h1 { border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { border-bottom: 2px solid #ecf0f1; padding-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: 600; color: #495057; }
        tr:hover { background-color: #f5f5f5; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; }
        .summary-card h3 { color: white; margin: 0; font-size: 14px; opacity: 0.9; }
        .summary-card .value { font-size: 36px; font-weight: bold; margin: 10px 0; }
        .recommendation { background: #fff; border-left: 4px solid #3498db; padding: 15px; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .recommendation h4 { margin-top: 0; color: #2c3e50; }
        .critical { background-color: #dc3545; color: white; }
        .high { background-color: #fd7e14; color: white; }
        .medium { background-color: #ffc107; color: #333; }
        .low { background-color: #28a745; color: white; }
        .meta { color: #6c757d; font-size: 14px; margin-bottom: 20px; }
        .high-util { background-color: #fff3cd !important; }
    </style>
</head>
<body>
    <h1>公司网络管理报告</h1>
    <p class="meta"><strong>生成时间:</strong> ${data.generatedAt}</p>

    <h2>执行摘要</h2>
    <div class="summary-grid">
        <div class="summary-card">
            <h3>总资产数量</h3>
            <div class="value">${data.summary.totalAssets}</div>
        </div>
        <div class="summary-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
            <h3>未处理告警</h3>
            <div class="value">${data.summary.activeAlerts}</div>
        </div>
        <div class="summary-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
            <h3>待处理变更</h3>
            <div class="value">${data.summary.pendingChanges}</div>
        </div>
        <div class="summary-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
            <h3>高风险项</h3>
            <div class="value">${data.summary.highRiskCount}</div>
        </div>
    </div>
`;

    if (data.highRiskDevices && data.highRiskDevices.length > 0) {
      html += `
    <h2>高风险设备</h2>
    <table>
        <thead>
            <tr>
                <th>严重程度</th>
                <th>类型</th>
                <th>标题</th>
                <th>描述</th>
                <th>关联IP</th>
            </tr>
        </thead>
        <tbody>`;
      data.highRiskDevices.forEach( risk => {
        const sevClass = risk.severity;
        html += `
            <tr>
                <td><span class="badge ${sevClass}">${risk.severity.toUpperCase()}</span></td>
                <td>${risk.type}</td>
                <td>${risk.title}</td>
                <td>${risk.description || '-'}</td>
                <td>${risk.ip_address || '-'}</td>
            </tr>`;
      });
      html += `
        </tbody>
    </table>`;
    }

    if (data.ipConflicts && data.ipConflicts.length > 0) {
      html += `
    <h2>IP地址冲突</h2>
    <table>
        <thead>
            <tr>
                <th>IP地址</th>
                <th>标题</th>
                <th>描述</th>
            </tr>
        </thead>
        <tbody>`;
      data.ipConflicts.forEach( risk => {
        html += `
            <tr>
                <td><strong>${risk.ip_address || '-'}</strong></td>
                <td>${risk.title}</td>
                <td>${risk.description || '-'}</td>
            </tr>`;
      });
      html += `
        </tbody>
    </table>`;
    }

    if (data.pendingChanges && data.pendingChanges.length > 0) {
      html += `
    <h2>待处理变更单</h2>
    <table>
        <thead>
            <tr>
                <th>标题</th>
                <th>类型</th>
                <th>状态</th>
                <th>请求时间</th>
                <th>影响设备数</th>
            </tr>
        </thead>
        <tbody>`;
      data.pendingChanges.forEach( change => {
        html += `
            <tr>
                <td>${change.title}</td>
                <td>${change.type}</td>
                <td><span class="badge medium">${change.status}</span></td>
                <td>${change.requested_at || '-'}</td>
                <td>${change.affected_count || 0}</td>
            </tr>`;
      });
      html += `
        </tbody>
    </table>`;
    }

    if (data.recentAlerts && data.recentAlerts.length > 0) {
      html += `
    <h2>近期告警摘要</h2>
    <table>
        <thead>
            <tr>
                <th>严重程度</th>
                <th>类型</th>
                <th>标题</th>
                <th>描述</th>
                <th>创建时间</th>
            </tr>
        </thead>
        <tbody>`;
      data.recentAlerts.slice(0, 10).forEach( alert => {
        const sevClass = alert.severity;
        html += `
            <tr>
                <td><span class="badge ${sevClass}">${alert.severity.toUpperCase()}</span></td>
                <td>${alert.type}</td>
                <td>${alert.title}</td>
                <td>${alert.description || '-'}</td>
                <td>${alert.created_at || '-'}</td>
            </tr>`;
      });
      html += `
        </tbody>
    </table>`;
    }

    if (data.segmentUtilization && data.segmentUtilization.length > 0) {
      html += `
    <h2>网段利用率</h2>
    <table>
        <thead>
            <tr>
                <th>网段名称</th>
                <th>CIDR</th>
                <th>总量</th>
                <th>已用</th>
                <th>利用率</th>
            </tr>
        </thead>
        <tbody>`;
      data.segmentUtilization.forEach( segment => {
        const util = parseFloat(segment.utilization);
        const rowClass = util >= 90 ? 'high-util' : '';
        const badgeClass = util >= 90 ? 'critical' : util >= 80 ? 'high' : util >= 60 ? 'medium' : 'low';
        html += `
            <tr class="${rowClass}">
                <td>${segment.name}</td>
                <td>${segment.cidr}</td>
                <td>${segment.total}</td>
                <td>${segment.used}</td>
                <td><span class="badge ${badgeClass}">${segment.utilization}%</span></td>
            </tr>`;
      });
      html += `
        </tbody>
    </table>`;
    }

    if (data.recommendations && data.recommendations.length > 0) {
      html += `
    <h2>整改建议</h2>`;
      data.recommendations.forEach( (rec, index) => {
        const priorityColor = rec.priority === 'critical' ? '#dc3545' : 
                              rec.priority === 'high' ? '#fd7e14' : 
                              rec.priority === 'medium' ? '#ffc107' : '#28a745';
        html += `
    <div class="recommendation" style="border-left-color: ${priorityColor};">
        <h4>${index + 1}. ${rec.title}</h4>
        <p><strong>优先级:</strong> <span class="badge ${rec.priority}">${rec.priority.toUpperCase()}</span></p>
        <p>${rec.description}</p>
        <p><strong>建议行动:</strong> ${rec.action}</p>
    </div>`;
      });
    }

    html += `
</body>
</html>`;

    return html;
  }

  static generateCSV(data) {
    let csv = '';
    
    csv += `"公司网络管理报告"\n`;
    csv += `"生成时间","${data.generatedAt}"\n\n`;
    
    csv += `"执行摘要"\n`;
    csv += `"指标","数值"\n`;
    csv += `"总资产数量","${data.summary.totalAssets}"\n`;
    csv += `"未处理告警","${data.summary.activeAlerts}"\n`;
    csv += `"待处理变更","${data.summary.pendingChanges}"\n`;
    csv += `"未解决风险","${data.summary.unresolvedRisks}"\n`;
    csv += `"高风险项","${data.summary.highRiskCount}"\n\n`;

    if (data.highRiskDevices && data.highRiskDevices.length > 0) {
      csv += `"高风险设备"\n`;
      csv += `"严重程度","类型","标题","描述","关联IP"\n`;
      data.highRiskDevices.forEach( risk => {
        csv += `"${risk.severity.toUpperCase()}","${risk.type}","${risk.title}","${risk.description || ''}","${risk.ip_address || ''}"\n`;
      });
      csv += `\n`;
    }

    if (data.ipConflicts && data.ipConflicts.length > 0) {
      csv += `"IP地址冲突"\n`;
      csv += `"IP地址","标题","描述"\n`;
      data.ipConflicts.forEach( risk => {
        csv += `"${risk.ip_address || ''}","${risk.title}","${risk.description || ''}"\n`;
      });
      csv += `\n`;
    }

    if (data.pendingChanges && data.pendingChanges.length > 0) {
      csv += `"待处理变更单"\n`;
      csv += `"标题","类型","状态","请求时间","影响设备数"\n`;
      data.pendingChanges.forEach( change => {
        csv += `"${change.title}","${change.type}","${change.status}","${change.requested_at || ''}","${change.affected_count || 0}"\n`;
      });
      csv += `\n`;
    }

    if (data.segmentUtilization && data.segmentUtilization.length > 0) {
      csv += `"网段利用率"\n`;
      csv += `"网段名称","CIDR","总量","已用","利用率"\n`;
      data.segmentUtilization.forEach( segment => {
        csv += `"${segment.name}","${segment.cidr}","${segment.total}","${segment.used}","${segment.utilization}%"\n`;
      });
      csv += `\n`;
    }

    if (data.recommendations && data.recommendations.length > 0) {
      csv += `"整改建议"\n`;
      csv += `"序号","优先级","标题","描述","建议行动"\n`;
      data.recommendations.forEach( (rec, index) => {
        csv += `"${index + 1}","${rec.priority.toUpperCase()}","${rec.title}","${rec.description}","${rec.action}"\n`;
      });
    }

    return csv;
  }
}

export default ReportService;
