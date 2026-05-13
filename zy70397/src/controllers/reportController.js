const { getFieldUsageStats, getRequestHistory } = require('../utils/storage');
const config = require('../config/compatibility');

function getCompatibilityReport(req, res) {
  const stats = getFieldUsageStats();
  const history = getRequestHistory();
  
  const report = {
    generatedAt: new Date().toISOString(),
    versions: {
      current: config.versions.current,
      deprecated: config.versions.deprecated,
      minimumSupported: config.versions.minimumSupported
    },
    fieldMappings: config.fieldMappings.map(m => ({
      oldField: m.oldField,
      newField: m.newField,
      deprecatedSince: m.deprecatedSince
    })),
    deprecatedFields: config.deprecatedFields.map(d => ({
      field: d.field,
      willBeRemoved: d.willBeRemoved,
      suggestion: d.suggestion
    })),
    byVersion: {},
    overallStats: {
      totalRequests: 0,
      requestsWithOldFields: 0,
      requestsWithDeprecatedFields: 0,
      requestsWithConflicts: 0
    }
  };
  
  Object.keys(stats).forEach(version => {
    const versionStats = stats[version];
    
    report.byVersion[version] = {
      totalRequests: versionStats.totalRequests,
      oldFieldUsage: Object.entries(versionStats.oldFields).map(([field, count]) => ({
        field,
        count,
        mappedTo: config.fieldMappings.find(m => m.oldField === field)?.newField
      })),
      deprecatedFieldUsage: Object.entries(versionStats.deprecatedFields).map(([field, count]) => {
        const deprecatedConfig = config.deprecatedFields.find(d => d.field === field);
        return {
          field,
          count,
          willBeRemoved: deprecatedConfig?.willBeRemoved,
          suggestion: deprecatedConfig?.suggestion
        };
      }),
      stillUsingOldFields: Object.keys(versionStats.oldFields).length > 0
    };
    
    report.overallStats.totalRequests += versionStats.totalRequests;
    
    if (Object.keys(versionStats.oldFields).length > 0) {
      report.overallStats.requestsWithOldFields += versionStats.totalRequests;
    }
    
    if (Object.keys(versionStats.deprecatedFields).length > 0) {
      report.overallStats.requestsWithDeprecatedFields += versionStats.totalRequests;
    }
  });
  
  const conflictRequests = history.filter(h => h.errors.some(e => e.type === 'fieldConflict'));
  report.overallStats.requestsWithConflicts = conflictRequests.length;
  
  report.recommendations = generateRecommendations(stats);
  
  res.json({
    success: true,
    data: report
  });
}

function generateRecommendations(stats) {
  const recommendations = [];
  const allOldFields = {};
  const allDeprecatedFields = {};
  
  Object.values(stats).forEach(versionStats => {
    Object.entries(versionStats.oldFields).forEach(([field, count]) => {
      allOldFields[field] = (allOldFields[field] || 0) + count;
    });
    Object.entries(versionStats.deprecatedFields).forEach(([field, count]) => {
      allDeprecatedFields[field] = (allDeprecatedFields[field] || 0) + count;
    });
  });
  
  const sortedOldFields = Object.entries(allOldFields)
    .sort((a, b) => b[1] - a[1]);
  
  if (sortedOldFields.length > 0) {
    recommendations.push({
      type: 'oldFieldUsage',
      priority: sortedOldFields[0][1] > 100 ? 'high' : 'medium',
      message: `仍有客户端在使用旧字段`,
      details: sortedOldFields.map(([field, count]) => ({
        field,
        count,
        mappedTo: config.fieldMappings.find(m => m.oldField === field)?.newField
      })),
      action: '建议监控旧字段使用量，当使用量低于阈值时可考虑正式下线'
    });
  }
  
  const sortedDeprecatedFields = Object.entries(allDeprecatedFields)
    .sort((a, b) => b[1] - a[1]);
  
  if (sortedDeprecatedFields.length > 0) {
    recommendations.push({
      type: 'deprecatedFieldUsage',
      priority: 'high',
      message: '检测到即将下线字段的使用',
      details: sortedDeprecatedFields.map(([field, count]) => {
        const deprecatedConfig = config.deprecatedFields.find(d => d.field === field);
        return {
          field,
          count,
          willBeRemoved: deprecatedConfig?.willBeRemoved
        };
      }),
      action: '建议通知相关客户端团队尽快迁移，避免字段下线后服务不可用'
    });
  }
  
  const lowVersions = Object.keys(stats).filter(v => 
    config.versions.deprecated.includes(v)
  );
  
  if (lowVersions.length > 0) {
    recommendations.push({
      type: 'deprecatedVersion',
      priority: 'high',
      message: `检测到废弃版本仍在使用: ${lowVersions.join(', ')}`,
      action: '建议通过应用内提醒、强制更新等方式引导用户升级'
    });
  }
  
  return recommendations;
}

module.exports = {
  getCompatibilityReport
};
