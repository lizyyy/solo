const _ = require('lodash');
const { IMPACT_LEVELS, CALENDAR_CHANGE_TYPES } = require('./validator');

function aggregateByImpactLevel(validationResult) {
  const impactGroups = {
    [IMPACT_LEVELS.HIGH]: [],
    [IMPACT_LEVELS.MEDIUM]: [],
    [IMPACT_LEVELS.LOW]: []
  };

  for (const metric of validationResult.allMetrics) {
    const level = metric.validation.impactLevel;
    if (impactGroups[level]) {
      impactGroups[level].push({
        metricId: metric.metricId,
        metricName: metric.metricName,
        sourceFile: metric.sourceFile,
        owner: metric.owner,
        department: metric.department,
        businessDomain: metric.businessDomain,
        impacts: metric.validation.impacts,
        issues: metric.validation.issues
      });
    }
  }

  return {
    high: impactGroups[IMPACT_LEVELS.HIGH],
    medium: impactGroups[IMPACT_LEVELS.MEDIUM],
    low: impactGroups[IMPACT_LEVELS.LOW],
    summary: {
      highCount: impactGroups[IMPACT_LEVELS.HIGH].length,
      mediumCount: impactGroups[IMPACT_LEVELS.MEDIUM].length,
      lowCount: impactGroups[IMPACT_LEVELS.LOW].length
    }
  };
}

function aggregateByDepartment(validationResult) {
  const departmentGroups = {};

  for (const metric of validationResult.allMetrics) {
    const dept = metric.department || '未分配';
    if (!departmentGroups[dept]) {
      departmentGroups[dept] = {
        department: dept,
        metrics: [],
        affectedCount: 0,
        highImpactCount: 0
      };
    }
    departmentGroups[dept].metrics.push({
      metricId: metric.metricId,
      metricName: metric.metricName,
      impactLevel: metric.validation.impactLevel,
      sourceFile: metric.sourceFile
    });
    if (metric.validation.impacts.length > 0) {
      departmentGroups[dept].affectedCount++;
    }
    if (metric.validation.impactLevel === IMPACT_LEVELS.HIGH) {
      departmentGroups[dept].highImpactCount++;
    }
  }

  return Object.values(departmentGroups).sort((a, b) => b.highImpactCount - a.highImpactCount);
}

function aggregateByBusinessDomain(validationResult) {
  const domainGroups = {};

  for (const metric of validationResult.allMetrics) {
    const domain = metric.businessDomain || '未分配';
    if (!domainGroups[domain]) {
      domainGroups[domain] = {
        businessDomain: domain,
        metrics: [],
        affectedCount: 0,
        highImpactCount: 0,
        affectedDashboards: new Set()
      };
    }
    domainGroups[domain].metrics.push({
      metricId: metric.metricId,
      metricName: metric.metricName,
      impactLevel: metric.validation.impactLevel,
      sourceFile: metric.sourceFile
    });
    if (metric.validation.impacts.length > 0) {
      domainGroups[domain].affectedCount++;
      for (const impact of metric.validation.impacts) {
        for (const dashboard of impact.affectedDashboards || []) {
          domainGroups[domain].affectedDashboards.add(dashboard);
        }
      }
    }
    if (metric.validation.impactLevel === IMPACT_LEVELS.HIGH) {
      domainGroups[domain].highImpactCount++;
    }
  }

  return Object.values(domainGroups).map(g => ({
    ...g,
    affectedDashboards: Array.from(g.affectedDashboards)
  })).sort((a, b) => b.highImpactCount - a.highImpactCount);
}

function aggregateByChangeType(validationResult) {
  const changeTypeGroups = {};

  for (const metric of validationResult.allMetrics) {
    for (const impact of metric.validation.impacts) {
      const type = impact.type;
      if (!changeTypeGroups[type]) {
        changeTypeGroups[type] = {
          changeType: type,
          metrics: [],
          affectedCount: 0,
          affectedDashboards: new Set()
        };
      }
      changeTypeGroups[type].metrics.push({
        metricId: metric.metricId,
        metricName: metric.metricName,
        impactLevel: metric.validation.impactLevel,
        sourceFile: metric.sourceFile,
        impactDescription: impact.description
      });
      changeTypeGroups[type].affectedCount++;
      for (const dashboard of impact.affectedDashboards || []) {
        changeTypeGroups[type].affectedDashboards.add(dashboard);
      }
    }
  }

  return Object.values(changeTypeGroups).map(g => ({
    ...g,
    affectedDashboards: Array.from(g.affectedDashboards)
  }));
}

function aggregateBySourceFile(validationResult) {
  return validationResult.files.map(file => ({
    fileName: file.fileName,
    filePath: file.filePath,
    totalMetrics: file.totalMetricsCount,
    validMetrics: file.validMetricsCount,
    affectedMetrics: file.affectedCount,
    fileErrors: file.fileErrors,
    fileWarnings: file.fileWarnings,
    metricsWithIssues: file.metrics
      .filter(m => !m.isValid || m.impacts.length > 0)
      .map(m => ({
        metricId: m.metricId,
        metricName: m.metricName,
        isValid: m.isValid,
        impactLevel: m.impactLevel,
        issues: m.issues,
        impacts: m.impacts
      }))
  }));
}

function aggregateDashboardList(validationResult) {
  const dashboardMap = new Map();

  for (const metric of validationResult.allMetrics) {
    for (const impact of metric.validation.impacts) {
      for (const dashboard of impact.affectedDashboards || []) {
        if (!dashboardMap.has(dashboard)) {
          dashboardMap.set(dashboard, {
            dashboardName: dashboard,
            affectedMetrics: [],
            highImpactCount: 0,
            totalImpactCount: 0,
            departments: new Set(),
            businessDomains: new Set()
          });
        }
        const dashInfo = dashboardMap.get(dashboard);
        dashInfo.affectedMetrics.push({
          metricId: metric.metricId,
          metricName: metric.metricName,
          impactLevel: metric.validation.impactLevel,
          impactDescription: impact.description,
          sourceFile: metric.sourceFile,
          owner: metric.owner
        });
        dashInfo.totalImpactCount++;
        if (metric.validation.impactLevel === IMPACT_LEVELS.HIGH) {
          dashInfo.highImpactCount++;
        }
        if (metric.department) dashInfo.departments.add(metric.department);
        if (metric.businessDomain) dashInfo.businessDomains.add(metric.businessDomain);
      }
    }
  }

  return Array.from(dashboardMap.values()).map(d => ({
    ...d,
    departments: Array.from(d.departments),
    businessDomains: Array.from(d.businessDomains),
    affectedMetrics: _.uniqBy(d.affectedMetrics, m => m.metricId)
  })).sort((a, b) => b.highImpactCount - a.highImpactCount);
}

function aggregateExceptionReport(validationResult) {
  const exceptions = [];

  for (const file of validationResult.files) {
    for (const error of file.fileErrors) {
      exceptions.push({
        type: 'FILE_ERROR',
        source: file.fileName,
        message: error,
        recommendation: '检查文件格式和编码'
      });
    }

    for (const metric of file.metrics) {
      for (const issue of metric.issues) {
        if (issue.code === 'METRIC_ALIAS_FOUND') {
          exceptions.push({
            type: 'METRIC_ALIAS',
            source: file.fileName,
            metricId: metric.metricId,
            metricName: metric.metricName,
            lineNumber: issue.lineNumber,
            message: issue.message,
            recommendation: '确认别名是否需要同步口径变更'
          });
        }
        if (issue.code === 'HISTORY_SNAPSHOT_FOUND') {
          exceptions.push({
            type: 'HISTORY_SNAPSHOT',
            source: file.fileName,
            metricId: metric.metricId,
            metricName: metric.metricName,
            lineNumber: issue.lineNumber,
            message: issue.message,
            recommendation: '评估历史快照数据是否需要重新计算'
          });
        }
        if (issue.code === 'FORMULA_NESTING_TOO_DEEP') {
          exceptions.push({
            type: 'FORMULA_NESTING',
            source: file.fileName,
            metricId: metric.metricId,
            metricName: metric.metricName,
            lineNumber: issue.lineNumber,
            message: issue.message,
            recommendation: '检查依赖指标口径变更的传导影响'
          });
        }
        if (issue.type === 'ERROR') {
          exceptions.push({
            type: 'VALIDATION_ERROR',
            source: file.fileName,
            metricId: metric.metricId,
            metricName: metric.metricName,
            lineNumber: issue.lineNumber,
            message: issue.message,
            recommendation: '修复指标配置后重新分析'
          });
        }
      }
    }
  }

  return exceptions;
}

function aggregateAll(validationResult) {
  return {
    summary: {
      totalFiles: validationResult.totalFiles,
      totalMetrics: validationResult.totalMetrics,
      validMetrics: validationResult.validMetrics,
      affectedMetrics: validationResult.affectedMetrics,
      highImpactMetrics: validationResult.highImpactMetrics
    },
    byImpactLevel: aggregateByImpactLevel(validationResult),
    byDepartment: aggregateByDepartment(validationResult),
    byBusinessDomain: aggregateByBusinessDomain(validationResult),
    byChangeType: aggregateByChangeType(validationResult),
    bySourceFile: aggregateBySourceFile(validationResult),
    dashboardList: aggregateDashboardList(validationResult),
    exceptions: aggregateExceptionReport(validationResult)
  };
}

module.exports = {
  aggregateByImpactLevel,
  aggregateByDepartment,
  aggregateByBusinessDomain,
  aggregateByChangeType,
  aggregateBySourceFile,
  aggregateDashboardList,
  aggregateExceptionReport,
  aggregateAll
};
