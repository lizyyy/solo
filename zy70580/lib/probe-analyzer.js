class ProbeAnalyzer {
  constructor(options = {}) {
    this.thresholds = {
      minInitialDelaySeconds: options.minInitialDelaySeconds || 0,
      maxInitialDelaySeconds: options.maxInitialDelaySeconds || 300,
      minPeriodSeconds: options.minPeriodSeconds || 1,
      maxPeriodSeconds: options.maxPeriodSeconds || 300,
      minTimeoutSeconds: options.minTimeoutSeconds || 1,
      maxTimeoutSeconds: options.maxTimeoutSeconds || 60,
      minFailureThreshold: options.minFailureThreshold || 1,
      maxFailureThreshold: options.maxFailureThreshold || 20,
      ...options.thresholds
    };
    this.issues = [];
  }

  analyze(parsedData) {
    const result = {
      summary: {
        totalFiles: parsedData.totalFiles,
        successfulFiles: parsedData.successfulFiles,
        totalDocuments: 0,
        totalContainers: 0,
        containersWithLiveness: 0,
        containersWithReadiness: 0,
        containersWithStartup: 0,
        issuesCount: 0,
        warningsCount: 0
      },
      containers: [],
      issues: [],
      comparisons: [],
      environmentGroups: {},
      raw: parsedData
    };

    for (const file of parsedData.files) {
      for (const doc of file.documents) {
        result.summary.totalDocuments++;
        
        for (const container of doc.containers) {
          result.summary.totalContainers++;
          
          const containerAnalysis = this.analyzeContainer(container, doc, file);
          result.containers.push(containerAnalysis);
          
          if (container.livenessProbe) result.summary.containersWithLiveness++;
          if (container.readinessProbe) result.summary.containersWithReadiness++;
          if (container.startupProbe) result.summary.containersWithStartup++;

          const env = this.detectEnvironment(doc, file);
          if (!result.environmentGroups[env]) {
            result.environmentGroups[env] = [];
          }
          result.environmentGroups[env].push(containerAnalysis);
        }
      }
    }

    result.issues = this.issues;
    result.summary.issuesCount = this.issues.filter(i => i.severity === 'error').length;
    result.summary.warningsCount = this.issues.filter(i => i.severity === 'warning').length;

    result.comparisons = this.compareEnvironments(result.environmentGroups);

    return result;
  }

  analyzeContainer(container, doc, file) {
    const analysis = {
      name: container.name,
      namespace: doc.metadata.namespace || 'default',
      workloadName: doc.metadata.name,
      workloadKind: doc.kind,
      filePath: file.filePath,
      fileName: file.fileName,
      probes: {
        liveness: container.livenessProbe,
        readiness: container.readinessProbe,
        startup: container.startupProbe
      },
      probeIssues: []
    };

    ['liveness', 'readiness', 'startup'].forEach(probeType => {
      const probe = container[`${probeType}Probe`];
      if (probe) {
        const issues = this.checkProbeThresholds(probe, probeType, container.name, doc, file);
        analysis.probeIssues.push(...issues);
        this.issues.push(...issues);
      }
    });

    if (!container.livenessProbe && !container.startupProbe) {
      this.issues.push({
        severity: 'warning',
        type: 'MISSING_PROBE',
        message: `容器 ${container.name} 缺少 livenessProbe`,
        container: container.name,
        filePath: file.filePath,
        workloadName: doc.metadata.name,
        workloadKind: doc.kind
      });
    }

    if (!container.readinessProbe) {
      this.issues.push({
        severity: 'warning',
        type: 'MISSING_PROBE',
        message: `容器 ${container.name} 缺少 readinessProbe`,
        container: container.name,
        filePath: file.filePath,
        workloadName: doc.metadata.name,
        workloadKind: doc.kind
      });
    }

    return analysis;
  }

  checkProbeThresholds(probe, probeType, containerName, doc, file) {
    const issues = [];
    const t = this.thresholds;

    const checks = [
      {
        field: 'initialDelaySeconds',
        value: probe.initialDelaySeconds,
        min: t.minInitialDelaySeconds,
        max: t.maxInitialDelaySeconds
      },
      {
        field: 'periodSeconds',
        value: probe.periodSeconds,
        min: t.minPeriodSeconds,
        max: t.maxPeriodSeconds
      },
      {
        field: 'timeoutSeconds',
        value: probe.timeoutSeconds,
        min: t.minTimeoutSeconds,
        max: t.maxTimeoutSeconds
      },
      {
        field: 'failureThreshold',
        value: probe.failureThreshold,
        min: t.minFailureThreshold,
        max: t.maxFailureThreshold
      }
    ];

    for (const check of checks) {
      if (check.value < check.min) {
        issues.push({
          severity: 'warning',
          type: 'THRESHOLD_VIOLATION',
          message: `${probeType}Probe 的 ${check.field} (${check.value}s) 低于建议最小值 ${check.min}s`,
          container: containerName,
          probeType,
          field: check.field,
          value: check.value,
          threshold: check.min,
          thresholdType: 'min',
          filePath: file.filePath,
          workloadName: doc.metadata.name,
          workloadKind: doc.kind
        });
      }
      if (check.value > check.max) {
        issues.push({
          severity: 'error',
          type: 'THRESHOLD_VIOLATION',
          message: `${probeType}Probe 的 ${check.field} (${check.value}s) 超过建议最大值 ${check.max}s`,
          container: containerName,
          probeType,
          field: check.field,
          value: check.value,
          threshold: check.max,
          thresholdType: 'max',
          filePath: file.filePath,
          workloadName: doc.metadata.name,
          workloadKind: doc.kind
        });
      }
    }

    return issues;
  }

  detectEnvironment(doc, file) {
    const labels = doc.metadata.labels || {};
    const namespace = doc.metadata.namespace || '';
    const name = doc.metadata.name || '';
    const fileName = file.fileName || '';

    const envPatterns = [
      { pattern: /prod|production|prd/i, name: '生产环境' },
      { pattern: /stag|staging/i, name: '预发布环境' },
      { pattern: /test|tst/i, name: '测试环境' },
      { pattern: /dev|develop/i, name: '开发环境' }
    ];

    for (const pattern of envPatterns) {
      if (pattern.pattern.test(namespace) || 
          pattern.pattern.test(name) || 
          pattern.pattern.test(fileName) ||
          Object.values(labels).some(v => pattern.pattern.test(String(v)))) {
        return pattern.name;
      }
    }

    return '未知环境';
  }

  compareEnvironments(envGroups) {
    const comparisons = [];
    const envs = Object.keys(envGroups);
    
    if (envs.length < 2) {
      return comparisons;
    }

    const probeTypes = ['liveness', 'readiness', 'startup'];
    const fields = ['initialDelaySeconds', 'periodSeconds', 'timeoutSeconds', 'failureThreshold'];

    for (const probeType of probeTypes) {
      for (const field of fields) {
        const envValues = {};
        
        for (const env of envs) {
          const containers = envGroups[env];
          const values = containers
            .map(c => c.probes[probeType]?.[field])
            .filter(v => v !== undefined && v !== null);
          
          if (values.length > 0) {
            envValues[env] = {
              avg: values.reduce((a, b) => a + b, 0) / values.length,
              min: Math.min(...values),
              max: Math.max(...values),
              count: values.length
            };
          }
        }

        const envNames = Object.keys(envValues);
        if (envNames.length >= 2) {
          const values = envNames.map(e => envValues[e].avg);
          const maxDiff = Math.max(...values) - Math.min(...values);
          const maxDiffPercent = Math.max(...values) > 0 ? (maxDiff / Math.max(...values)) * 100 : 0;

          if (maxDiffPercent > 20) {
            comparisons.push({
              type: 'ENV_DIFFERENCE',
              severity: maxDiffPercent > 50 ? 'error' : 'warning',
              probeType,
              field,
              maxDiff,
              maxDiffPercent: Math.round(maxDiffPercent),
              envValues,
              message: `${probeType}Probe 的 ${field} 在各环境间差异显著 (${Math.round(maxDiffPercent)}%)`
            });
          }
        }
      }
    }

    return comparisons;
  }
}

module.exports = ProbeAnalyzer;
