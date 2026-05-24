import {
  NormalizedService,
  ServiceDiff,
  SourceDifference,
  DiffSeverity,
  SeverityThresholds,
  DiffReport,
  DataSourceType,
} from '../types';

const DEFAULT_THRESHOLDS: SeverityThresholds = {
  critical: 30,
  warning: 7,
};

export function calculateDifferences(
  services: NormalizedService[],
  thresholds: Partial<SeverityThresholds> = {}
): ServiceDiff[] {
  const effectiveThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };

  return services.map(service => calculateServiceDiff(service, effectiveThresholds));
}

function calculateServiceDiff(
  service: NormalizedService,
  thresholds: SeverityThresholds
): ServiceDiff {
  const sources = Object.entries(service.sources) as [DataSourceType, { retentionDays: number }][];
  const sourceValues: { [key in DataSourceType]?: number } = {};

  for (const [source, data] of sources) {
    sourceValues[source] = data.retentionDays;
  }

  const differences: SourceDifference[] = [];
  let maxDiffDays = 0;
  let maxSeverity: DiffSeverity = 'info';

  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const [sourceA, dataA] = sources[i];
      const [sourceB, dataB] = sources[j];

      const diffDays = Math.abs(dataA.retentionDays - dataB.retentionDays);
      const maxValue = Math.max(dataA.retentionDays, dataB.retentionDays);
      const diffPercentage = maxValue > 0 ? (diffDays / maxValue) * 100 : 0;

      const severity = getSeverity(diffDays, thresholds);

      differences.push({
        sourceA,
        sourceB,
        valueA: dataA.retentionDays,
        valueB: dataB.retentionDays,
        diffDays,
        diffPercentage: Math.round(diffPercentage * 100) / 100,
        severity,
      });

      if (diffDays > maxDiffDays) {
        maxDiffDays = diffDays;
      }

      if (severity === 'critical') {
        maxSeverity = 'critical';
      } else if (severity === 'warning' && maxSeverity !== 'critical') {
        maxSeverity = 'warning';
      }
    }
  }

  const consistencyScore = calculateConsistencyScore(sources.map(s => s[1].retentionDays));

  return {
    canonicalName: service.canonicalName,
    aliases: service.aliases,
    sources: sourceValues,
    differences,
    maxDiffDays,
    severity: differences.length > 0 ? maxSeverity : 'info',
    consistencyScore,
  };
}

function getSeverity(diffDays: number, thresholds: SeverityThresholds): DiffSeverity {
  if (diffDays === 0) return 'info';
  if (diffDays >= thresholds.critical) return 'critical';
  if (diffDays >= thresholds.warning) return 'warning';
  return 'info';
}

function calculateConsistencyScore(values: number[]): number {
  if (values.length <= 1) return 100;
  if (values.length === 0) return 0;

  const max = Math.max(...values);
  const min = Math.min(...values);

  if (max === 0) return 100;

  const ratio = min / max;
  return Math.round(ratio * 100);
}

export function generateReport(
  serviceDiffs: ServiceDiff[],
  sourceTypes: DataSourceType[],
  outputDir: string,
  sourceFiles: string[],
  thresholds: SeverityThresholds
): DiffReport {
  const consistentServices = serviceDiffs.filter(s => s.maxDiffDays === 0).length;
  const inconsistentServices = serviceDiffs.filter(s => s.maxDiffDays > 0).length;

  let criticalIssues = 0;
  let warningIssues = 0;
  let infoIssues = 0;

  for (const service of serviceDiffs) {
    for (const diff of service.differences) {
      if (diff.severity === 'critical') criticalIssues++;
      else if (diff.severity === 'warning') warningIssues++;
      else infoIssues++;
    }
  }

  const overallConsistencyScore = serviceDiffs.length > 0
    ? Math.round(serviceDiffs.reduce((sum, s) => sum + s.consistencyScore, 0) / serviceDiffs.length)
    : 100;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalServices: serviceDiffs.length,
      consistentServices,
      inconsistentServices,
      criticalIssues,
      warningIssues,
      infoIssues,
      overallConsistencyScore,
    },
    services: serviceDiffs,
    sources: sourceTypes.map(type => ({
      type,
      serviceCount: serviceDiffs.filter(s => s.sources[type] !== undefined).length,
    })),
    config: {
      outputDir,
      sources: sourceFiles,
      severityThresholds: thresholds,
    },
  };
}

export function determineExitCode(report: DiffReport): number {
  if (report.summary.criticalIssues > 0) return 2;
  if (report.summary.warningIssues > 0) return 1;
  return 0;
}
