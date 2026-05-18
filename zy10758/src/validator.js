const _ = require('lodash');

const CALENDAR_CHANGE_TYPES = {
  DEFINITION_CHANGE: '口径定义变更',
  DIMENSION_CHANGE: '维度变更',
  AGGREGATION_CHANGE: '聚合方式变更',
  TIME_GRANULARITY_CHANGE: '时间粒度变更',
  DATA_SOURCE_CHANGE: '数据源变更',
  FILTER_CHANGE: '过滤条件变更'
};

const IMPACT_LEVELS = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低'
};

function validateMetric(metric, changeContext = {}) {
  const issues = [];
  const impacts = [];

  if (!metric.metricId) {
    issues.push({
      type: 'ERROR',
      code: 'MISSING_METRIC_ID',
      message: '指标ID为空',
      lineNumber: metric.lineNumber
    });
  }

  if (!metric.metricName) {
    issues.push({
      type: 'ERROR',
      code: 'MISSING_METRIC_NAME',
      message: '指标名称为空',
      lineNumber: metric.lineNumber
    });
  }

  if (metric.alias) {
    issues.push({
      type: 'WARNING',
      code: 'METRIC_ALIAS_FOUND',
      message: `指标存在别名: ${metric.alias}`,
      lineNumber: metric.lineNumber
    });
  }

  if (metric.snapshot) {
    issues.push({
      type: 'WARNING',
      code: 'HISTORY_SNAPSHOT_FOUND',
      message: `配置了历史快照: ${metric.snapshot}`,
      lineNumber: metric.lineNumber
    });
  }

  if (metric.formulaNestingLevel > 2) {
    issues.push({
      type: 'WARNING',
      code: 'FORMULA_NESTING_TOO_DEEP',
      message: `公式嵌套层级过深: ${metric.formulaNestingLevel}层`,
      lineNumber: metric.lineNumber
    });
  }

  const changeImpacts = analyzeCalendarChangeImpact(metric, changeContext);
  impacts.push(...changeImpacts);

  const dependencyIssues = validateDependencies(metric);
  issues.push(...dependencyIssues);

  return {
    metricId: metric.metricId,
    metricName: metric.metricName,
    isValid: issues.filter(i => i.type === 'ERROR').length === 0,
    issues,
    impacts,
    impactLevel: calculateOverallImpactLevel(impacts),
    metric
  };
}

function analyzeCalendarChangeImpact(metric, changeContext) {
  const impacts = [];
  const changeType = changeContext.changeType || '';
  const changedMetrics = changeContext.changedMetrics || [];

  if (changedMetrics.includes(metric.metricId)) {
    impacts.push({
      type: CALENDAR_CHANGE_TYPES.DEFINITION_CHANGE,
      description: '指标本身口径发生变更',
      level: IMPACT_LEVELS.HIGH,
      affectedDashboards: findAffectedDashboards(metric)
    });
  }

  const dependencyImpacts = checkDependencyImpacts(metric, changedMetrics);
  impacts.push(...dependencyImpacts);

  if (metric.type === '公式指标' && metric.dependencies.length > 0) {
    const impactedDeps = metric.dependencies.filter(d => changedMetrics.includes(d));
    if (impactedDeps.length > 0) {
      impacts.push({
        type: CALENDAR_CHANGE_TYPES.DEFINITION_CHANGE,
        description: `依赖的${impactedDeps.length}个指标口径变更`,
        level: IMPACT_LEVELS.HIGH,
        affectedMetrics: impactedDeps,
        affectedDashboards: findAffectedDashboards(metric)
      });
    }
  }

  return impacts;
}

function checkDependencyImpacts(metric, changedMetrics) {
  const impacts = [];
  const dependencies = metric.dependencies || [];

  for (const dep of dependencies) {
    if (changedMetrics.includes(dep)) {
      impacts.push({
        type: CALENDAR_CHANGE_TYPES.DEFINITION_CHANGE,
        description: `依赖指标 ${dep} 口径变更`,
        level: IMPACT_LEVELS.HIGH,
        dependency: dep,
        affectedDashboards: findAffectedDashboards(metric)
      });
    }
  }

  return impacts;
}

function validateDependencies(metric) {
  const issues = [];
  const dependencies = metric.dependencies || [];

  if (dependencies.length > 10) {
    issues.push({
      type: 'WARNING',
      code: 'TOO_MANY_DEPENDENCIES',
      message: `指标依赖过多: ${dependencies.length}个依赖`,
      lineNumber: metric.lineNumber
    });
  }

  return issues;
}

function findAffectedDashboards(metric) {
  const dashboards = [];
  if (metric.businessDomain) {
    dashboards.push(`${metric.businessDomain}核心看板`);
  }
  if (metric.department) {
    dashboards.push(`${metric.department}运营看板`);
  }
  dashboards.push('综合数据看板');
  return dashboards;
}

function calculateOverallImpactLevel(impacts) {
  if (impacts.length === 0) return IMPACT_LEVELS.LOW;
  if (impacts.some(i => i.level === IMPACT_LEVELS.HIGH)) return IMPACT_LEVELS.HIGH;
  if (impacts.some(i => i.level === IMPACT_LEVELS.MEDIUM)) return IMPACT_LEVELS.MEDIUM;
  return IMPACT_LEVELS.LOW;
}

function validateAll(parsedFiles, changeContext = {}) {
  const allValidationResults = [];
  const allMetrics = [];

  for (const file of parsedFiles) {
    const fileResults = {
      fileName: file.fileName,
      filePath: file.filePath,
      metrics: []
    };

    for (const metric of file.metrics) {
      const result = validateMetric(metric, changeContext);
      fileResults.metrics.push(result);
      allMetrics.push({
        ...metric,
        validation: result,
        sourceFile: file.fileName
      });
    }

    fileResults.fileErrors = file.errors;
    fileResults.fileWarnings = file.warnings;
    fileResults.totalMetricsCount = file.metrics.length;
    fileResults.validMetricsCount = fileResults.metrics.filter(m => m.isValid).length;
    fileResults.affectedCount = fileResults.metrics.filter(m => m.impacts.length > 0).length;

    allValidationResults.push(fileResults);
  }

  return {
    files: allValidationResults,
    allMetrics,
    totalFiles: parsedFiles.length,
    totalMetrics: allMetrics.length,
    validMetrics: allMetrics.filter(m => m.validation.isValid).length,
    affectedMetrics: allMetrics.filter(m => m.validation.impacts.length > 0).length,
    highImpactMetrics: allMetrics.filter(m => m.validation.impactLevel === IMPACT_LEVELS.HIGH).length
  };
}

module.exports = {
  validateMetric,
  validateAll,
  CALENDAR_CHANGE_TYPES,
  IMPACT_LEVELS,
  analyzeCalendarChangeImpact
};
