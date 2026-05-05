"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportJson = exportJson;
function getIssueTypeLabel(type) {
    const labels = {
        N_PLUS_1: 'N+1 查询',
        DUPLICATE_QUERY: '重复查询',
        DEEP_PAGINATION: '深分页',
        MISSING_PRELOAD: '缺失预加载',
        UNUSED_FIELDS: '无用字段',
        LARGE_RESULT_SET: '大结果集',
        MISSING_INDEX: '缺失索引',
        SLOW_QUERY: '慢查询',
    };
    return labels[type] || type;
}
function getSeverityLabel(severity) {
    const labels = {
        CRITICAL: '严重',
        HIGH: '高',
        MEDIUM: '中',
        LOW: '低',
    };
    return labels[severity] || severity;
}
function exportJson(analysisResults, simulationResults, options = {}) {
    const { includeSql = false, includeSuggestions = true } = options;
    const totalRequests = analysisResults.length;
    const totalQueries = analysisResults.reduce((sum, r) => sum + r.requestGroup.totalQueryCount, 0);
    const totalIssues = analysisResults.reduce((sum, r) => sum + r.issues.length, 0);
    const issuesByType = {};
    const issuesBySeverity = {};
    for (const result of analysisResults) {
        for (const issue of result.issues) {
            issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
            issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1;
        }
    }
    const allIssues = [];
    for (const result of analysisResults) {
        allIssues.push(...result.issues);
    }
    const sortedIssues = allIssues.sort((a, b) => {
        const severityOrder = {
            CRITICAL: 4,
            HIGH: 3,
            MEDIUM: 2,
            LOW: 1,
        };
        return severityOrder[b.severity] - severityOrder[a.severity];
    });
    const issuesData = sortedIssues.map((issue, index) => {
        const data = {
            index: index + 1,
            id: issue.id,
            type: issue.type,
            typeLabel: getIssueTypeLabel(issue.type),
            severity: issue.severity,
            severityLabel: getSeverityLabel(issue.severity),
            title: issue.title,
            description: issue.description,
            requestId: issue.requestId,
            impact: {
                queryCountIncrease: issue.impact.queryCountIncrease,
                durationIncreaseMs: issue.impact.durationIncreaseMs,
                dataTransferIncreaseBytes: issue.impact.dataTransferIncreaseBytes,
            },
        };
        if (includeSql && issue.evidence.queries.length > 0) {
            data.evidence = {
                queries: issue.evidence.queries.slice(0, 10),
                parameters: issue.evidence.parameters,
                totalQueries: issue.evidence.queries.length,
            };
        }
        if (includeSuggestions) {
            data.suggestion = {
                title: issue.suggestion.title,
                description: issue.suggestion.description,
                codeExample: issue.suggestion.codeExample,
                expectedImprovement: issue.suggestion.expectedImprovement,
            };
        }
        return data;
    });
    let simulationData = null;
    if (simulationResults && simulationResults.length > 0) {
        let totalQueryReduction = 0;
        let totalDurationReduction = 0;
        let totalDataReduction = 0;
        for (const result of simulationResults) {
            totalQueryReduction += result.comparison.improvement.queryCountReduction;
            totalDurationReduction += result.comparison.improvement.durationReductionMs;
            totalDataReduction += result.comparison.improvement.dataTransferReductionBytes;
        }
        const originalTotalQueries = simulationResults.reduce((sum, r) => sum + r.comparison.original.totalQueries, 0);
        const optimizedTotalQueries = simulationResults.reduce((sum, r) => sum + r.comparison.optimized.totalQueries, 0);
        const originalDuration = simulationResults.reduce((sum, r) => sum + r.comparison.original.totalDurationMs, 0);
        const optimizedDuration = simulationResults.reduce((sum, r) => sum + r.comparison.optimized.totalDurationMs, 0);
        const originalDataTransfer = simulationResults.reduce((sum, r) => sum + r.comparison.original.totalDataTransferBytes, 0);
        const optimizedDataTransfer = simulationResults.reduce((sum, r) => sum + r.comparison.optimized.totalDataTransferBytes, 0);
        const optimizations = [];
        for (const result of simulationResults) {
            for (const opt of result.optimizations) {
                optimizations.push({
                    id: opt.id,
                    type: opt.type,
                    title: opt.title,
                    description: opt.description,
                    targetIssues: opt.targetIssues,
                    impact: opt.impact,
                    before: opt.before,
                    after: opt.after,
                });
            }
        }
        simulationData = {
            summary: {
                original: {
                    totalQueries: originalTotalQueries,
                    totalDurationMs: originalDuration,
                    totalDataTransferBytes: originalDataTransfer,
                },
                optimized: {
                    totalQueries: optimizedTotalQueries,
                    totalDurationMs: optimizedDuration,
                    totalDataTransferBytes: optimizedDataTransfer,
                },
                improvement: {
                    queryCountReduction: totalQueryReduction,
                    queryCountReductionPercent: originalTotalQueries > 0
                        ? Math.round((totalQueryReduction / originalTotalQueries) * 100)
                        : 0,
                    durationReductionMs: totalDurationReduction,
                    durationReductionPercent: originalDuration > 0
                        ? Math.round((totalDurationReduction / originalDuration) * 100)
                        : 0,
                    dataTransferReductionBytes: totalDataReduction,
                    dataTransferReductionPercent: originalDataTransfer > 0
                        ? Math.round((totalDataReduction / originalDataTransfer) * 100)
                        : 0,
                },
            },
            optimizations,
        };
    }
    const requestsData = analysisResults.map((result) => {
        const group = result.requestGroup;
        const data = {
            requestId: group.requestId,
            queryCount: group.totalQueryCount,
            queryDurationMs: group.totalQueryDuration,
            issueCount: result.issues.length,
            tables: Object.keys(group.queryByTable),
        };
        if (group.apiLog) {
            data.api = {
                path: group.apiLog.path,
                method: group.apiLog.method,
                statusCode: group.apiLog.statusCode,
                durationMs: group.apiLog.duration,
                userId: group.apiLog.userId,
            };
        }
        return data;
    });
    const report = {
        metadata: {
            generatedAt: new Date().toISOString(),
            version: '1.0.0',
            options: {
                includeSql,
                includeSuggestions,
            },
        },
        summary: {
            totalRequests,
            totalQueries,
            totalIssues,
            issuesByType: Object.fromEntries(Object.entries(issuesByType).map(([key, value]) => [
                getIssueTypeLabel(key),
                value,
            ])),
            issuesBySeverity: Object.fromEntries(Object.entries(issuesBySeverity).map(([key, value]) => [
                getSeverityLabel(key),
                value,
            ])),
        },
        issues: issuesData,
        requests: requestsData,
        ...(simulationData ? { simulation: simulationData } : {}),
    };
    return JSON.stringify(report, null, 2);
}
//# sourceMappingURL=json-exporter.js.map