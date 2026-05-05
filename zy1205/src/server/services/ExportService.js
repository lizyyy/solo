const dataStore = require('../storage/DataStore');
const dayjs = require('dayjs');

class ExportService {
  exportToJSON(clusterId = null) {
    const data = dataStore.exportAll();
    
    if (clusterId) {
      data.clusters = data.clusters.filter(c => c.id === clusterId);
      data.instances = data.instances.filter(i => i.clusterId === clusterId);
      data.eventLogs = data.eventLogs.filter(l => l.clusterId === clusterId);
    }

    return {
      data,
      format: 'JSON',
      exportedAt: Date.now(),
      humanReadableTime: dayjs().format('YYYY-MM-DD HH:mm:ss')
    };
  }

  exportToMarkdown(clusterId = null) {
    const data = dataStore.exportAll();
    
    let clusters = data.clusters;
    let instances = data.instances;
    let eventLogs = data.eventLogs;

    if (clusterId) {
      clusters = clusters.filter(c => c.id === clusterId);
      instances = instances.filter(i => i.clusterId === clusterId);
      eventLogs = eventLogs.filter(l => l.clusterId === clusterId);
    }

    let md = '# 服务集群演练台复盘报告\n\n';
    md += `> 导出时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
    md += '---\n\n';

    md += '## 1. 集群概览\n\n';
    
    for (const cluster of clusters) {
      const clusterInstances = instances.filter(i => i.clusterId === cluster.id);
      const healthyInstances = clusterInstances.filter(i => i.status === 'HEALTHY');
      const masterInstance = clusterInstances.find(i => i.role === 'MASTER');

      md += `### 集群: ${cluster.name}\n\n`;
      md += `- **ID**: ${cluster.id}\n`;
      md += `- **描述**: ${cluster.description || '无'}\n`;
      md += `- **负载均衡策略**: ${cluster.loadBalancerStrategy}\n`;
      md += `- **健康检查间隔**: ${cluster.healthCheckInterval}ms\n`;
      md += `- **总实例数**: ${clusterInstances.length}\n`;
      md += `- **健康实例数**: ${healthyInstances.length}\n`;
      md += `- **主节点**: ${masterInstance ? masterInstance.name : '无'}\n\n`;

      md += '#### 实例列表\n\n';
      md += '| 名称 | 地址 | 角色 | 状态 | 权重 | 连接数 |\n';
      md += '|------|------|------|------|------|--------|\n';
      
      for (const inst of clusterInstances) {
        const roleEmoji = inst.role === 'MASTER' ? '👑' : '🔷';
        const statusEmoji = inst.status === 'HEALTHY' ? '✅' : 
                             inst.status === 'UNHEALTHY' ? '⚠️' : '❌';
        md += `| ${inst.name} | ${inst.host}:${inst.port} | ${roleEmoji} ${inst.role} | ${statusEmoji} ${inst.status} | ${inst.weight} | ${inst.connections} |\n`;
      }
      md += '\n';
    }

    md += '---\n\n';
    md += '## 2. 事件日志\n\n';

    const eventTypes = [
      { key: 'MASTER_FAILOVER', name: '故障转移', emoji: '🔄' },
      { key: 'MASTER_ELECTION', name: '主节点选举', emoji: '👑' },
      { key: 'REQUEST_ROUTED', name: '请求路由', emoji: '📡' },
      { key: 'INSTANCE_EVICTED', name: '实例剔除', emoji: '🚪' },
      { key: 'INSTANCE_RESTORED', name: '实例恢复', emoji: '🔧' },
      { key: 'CONFIG_WARNING', name: '配置警告', emoji: '⚠️' },
      { key: 'MANUAL_OPERATION', name: '手动操作', emoji: '👆' }
    ];

    for (const eventType of eventTypes) {
      const typeLogs = eventLogs.filter(l => l.eventType === eventType.key);
      if (typeLogs.length === 0) continue;

      md += `### ${eventType.emoji} ${eventType.name} (${typeLogs.length} 条)\n\n`;

      for (const log of typeLogs.slice(0, 50)) {
        const time = dayjs(log.timestamp).format('MM-DD HH:mm:ss');
        const severityEmoji = log.severity === 'CRITICAL' ? '🚨' :
                               log.severity === 'ERROR' ? '❌' :
                               log.severity === 'WARNING' ? '⚠️' : 'ℹ️';
        
        md += `**${time}** ${severityEmoji} ${log.message}\n\n`;
        
        if (log.details && Object.keys(log.details).length > 0) {
          md += '<details>\n<summary>查看详情</summary>\n\n';
          md += '```json\n';
          md += JSON.stringify(log.details, null, 2);
          md += '\n```\n\n';
          md += '</details>\n\n';
        }
      }

      if (typeLogs.length > 50) {
        md += `> 还有 ${typeLogs.length - 50} 条记录...\n\n`;
      }
    }

    md += '---\n\n';
    md += '## 3. 统计汇总\n\n';

    const totalRequests = eventLogs.filter(l => l.eventType === 'REQUEST_ROUTED').length;
    const failoverCount = eventLogs.filter(l => l.eventType === 'MASTER_FAILOVER').length;
    const evictionCount = eventLogs.filter(l => l.eventType === 'INSTANCE_EVICTED').length;
    const configWarnings = eventLogs.filter(l => l.eventType === 'CONFIG_WARNING').length;

    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 总请求路由次数 | ${totalRequests} |\n`;
    md += `| 故障转移次数 | ${failoverCount} |\n`;
    md += `| 实例剔除次数 | ${evictionCount} |\n`;
    md += `| 配置警告次数 | ${configWarnings} |\n\n`;

    md += '---\n\n';
    md += '## 4. 附录\n\n';
    md += '### 负载均衡策略说明\n\n';
    md += '- **ROUND_ROBIN (轮询)**: 按顺序依次将请求分配给每个实例\n';
    md += '- **WEIGHTED_ROUND_ROBIN (加权轮询)**: 根据权重比例分配请求，权重越高分配越多\n';
    md += '- **LEAST_CONNECTIONS (最小连接数)**: 选择当前连接数最少的实例\n';
    md += '- **RANDOM (随机)**: 从可用实例中随机选择\n\n';

    md += '### 实例状态说明\n\n';
    md += '- **HEALTHY (健康)**: 实例正常运行，可以接收请求\n';
    md += '- **UNHEALTHY (不健康)**: 实例连续健康检查失败，暂不接收请求\n';
    md += '- **DOWN (宕机)**: 实例被剔除，不接收请求\n';
    md += '- **MAINTENANCE (维护中)**: 实例处于维护模式\n\n';

    md += '### 故障转移规则\n\n';
    md += '1. 当主节点健康检查失败时，自动触发故障转移\n';
    md += '2. 优先选择权重高的从节点提升为主节点\n';
    md += '3. 权重相同时选择注册时间较早的实例\n';
    md += '4. 如果没有可用的从节点，故障转移失败\n\n';

    return {
      markdown: md,
      format: 'Markdown',
      exportedAt: Date.now(),
      humanReadableTime: dayjs().format('YYYY-MM-DD HH:mm:ss')
    };
  }

  getEventLogsAnalysis(clusterId = null) {
    const eventLogs = dataStore.getEventLogs({ clusterId });

    const analysis = {
      totalEvents: eventLogs.length,
      byType: {},
      bySeverity: {},
      byInstance: {},
      timeline: [],
      topEvents: []
    };

    for (const log of eventLogs) {
      if (!analysis.byType[log.eventType]) {
        analysis.byType[log.eventType] = 0;
      }
      analysis.byType[log.eventType]++;

      if (!analysis.bySeverity[log.severity]) {
        analysis.bySeverity[log.severity] = 0;
      }
      analysis.bySeverity[log.severity]++;

      if (log.instanceId) {
        if (!analysis.byInstance[log.instanceId]) {
          analysis.byInstance[log.instanceId] = {
            count: 0,
            events: []
          };
        }
        analysis.byInstance[log.instanceId].count++;
        analysis.byInstance[log.instanceId].events.push({
          type: log.eventType,
          message: log.message,
          time: log.timestamp
        });
      }
    }

    const sortedTypes = Object.entries(analysis.byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    analysis.topEvents = sortedTypes.map(([type, count]) => ({ type, count }));

    const timeGroups = {};
    for (const log of eventLogs) {
      const timeKey = dayjs(log.timestamp).format('YYYY-MM-DD HH');
      if (!timeGroups[timeKey]) {
        timeGroups[timeKey] = 0;
      }
      timeGroups[timeKey]++;
    }
    analysis.timeline = Object.entries(timeGroups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([time, count]) => ({ time, count }));

    return analysis;
  }
}

module.exports = new ExportService();
