"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDifferences = calculateDifferences;
exports.generateReport = generateReport;
exports.determineExitCode = determineExitCode;
const DEFAULT_THRESHOLDS = {
    critical: 30,
    warning: 7,
};
function calculateDifferences(services, thresholds = {}) {
    const effectiveThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    return services.map(service => calculateServiceDiff(service, effectiveThresholds));
}
function calculateServiceDiff(service, thresholds) {
    const sources = Object.entries(service.sources);
    const sourceValues = {};
    for (const [source, data] of sources) {
        sourceValues[source] = data.retentionDays;
    }
    const differences = [];
    let maxDiffDays = 0;
    let maxSeverity = 'info';
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
            }
            else if (severity === 'warning' && maxSeverity !== 'critical') {
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
function getSeverity(diffDays, thresholds) {
    if (diffDays === 0)
        return 'info';
    if (diffDays >= thresholds.critical)
        return 'critical';
    if (diffDays >= thresholds.warning)
        return 'warning';
    return 'info';
}
function calculateConsistencyScore(values) {
    if (values.length <= 1)
        return 100;
    if (values.length === 0)
        return 0;
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (max === 0)
        return 100;
    const ratio = min / max;
    return Math.round(ratio * 100);
}
function generateReport(serviceDiffs, sourceTypes, outputDir, sourceFiles, thresholds) {
    const consistentServices = serviceDiffs.filter(s => s.maxDiffDays === 0).length;
    const inconsistentServices = serviceDiffs.filter(s => s.maxDiffDays > 0).length;
    let criticalIssues = 0;
    let warningIssues = 0;
    let infoIssues = 0;
    for (const service of serviceDiffs) {
        for (const diff of service.differences) {
            if (diff.severity === 'critical')
                criticalIssues++;
            else if (diff.severity === 'warning')
                warningIssues++;
            else
                infoIssues++;
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
function determineExitCode(report) {
    if (report.summary.criticalIssues > 0)
        return 2;
    if (report.summary.warningIssues > 0)
        return 1;
    return 0;
}
