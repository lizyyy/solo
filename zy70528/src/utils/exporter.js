const { Parser } = require('json2csv');
const { StatusDescriptions } = require('../models/constants');

class Exporter {
  static toJSON(strategies) {
    return JSON.stringify(strategies.map(s => s.toJSON()), null, 2);
  }

  static toCSV(strategies) {
    const fields = [
      { label: '策略ID', value: 'id' },
      { label: '策略名称', value: 'strategyName' },
      { label: '接口分组', value: row => row.apiGroups.join(', ') },
      { label: '租户范围类型', value: 'tenantScope.type' },
      { label: '租户列表', value: row => (row.tenantScope.tenants || []).join(', ') },
      { label: '降级级别', value: 'degradationLevel' },
      { label: '状态', value: row => StatusDescriptions[row.status] || row.status },
      { label: '影响接口数', value: 'impactSummary.totalApis' },
      { label: '影响租户数', value: 'impactSummary.affectedTenants' },
      { label: '影响请求数', value: 'impactSummary.estimatedRequests' },
      { label: '影响描述', value: 'impactSummary.description' },
      { label: '恢复条件类型', value: 'recoveryCondition.type' },
      { label: '创建时间', value: 'createdAt' },
      { label: '发布时间', value: 'publishedAt' },
      { label: '操作人', value: 'operator' },
      { label: '备注', value: 'remarks' }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(strategies.map(s => s.toJSON()));
  }

  static exportImpactSummaryCSV(strategy) {
    const fields = [
      { label: '记录ID', value: 'id' },
      { label: '时间', value: 'timestamp' },
      { label: '租户ID', value: 'tenantId' },
      { label: '接口路径', value: 'apiPath' },
      { label: '请求数', value: 'requestCount' },
      { label: '影响类型', value: 'impactType' }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(strategy.impactRecords);
  }

  static generateSummary(strategies) {
    const summary = {
      exportTime: new Date().toISOString(),
      totalStrategies: strategies.length,
      byStatus: {},
      byLevel: {},
      totalImpactedApis: 0,
      totalImpactedTenants: 0,
      totalImpactedRequests: 0
    };

    strategies.forEach(strategy => {
      summary.byStatus[strategy.status] = (summary.byStatus[strategy.status] || 0) + 1;
      summary.byLevel[strategy.degradationLevel] = (summary.byLevel[strategy.degradationLevel] || 0) + 1;
      summary.totalImpactedApis += strategy.impactSummary.totalApis || 0;
      summary.totalImpactedTenants += strategy.impactSummary.affectedTenants || 0;
      summary.totalImpactedRequests += strategy.impactSummary.estimatedRequests || 0;
    });

    return summary;
  }
}

module.exports = Exporter;
