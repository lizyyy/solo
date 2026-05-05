"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportCsv = exportCsv;
exports.exportSummaryCsv = exportSummaryCsv;
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
function escapeCsvField(field) {
    if (field === null || field === undefined) {
        return '';
    }
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}
function exportCsv(analysisResults, options = {}) {
    const { includeSql = false, includeSuggestions = true } = options;
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
    const headers = [
        '序号',
        '问题ID',
        '类型',
        '类型描述',
        '严重程度',
        '严重程度描述',
        '标题',
        '描述',
        '请求ID',
        '查询次数增加',
        '耗时增加(ms)',
        '数据传输增加(bytes)',
    ];
    if (includeSql) {
        headers.push('相关SQL示例');
        headers.push('SQL数量');
    }
    if (includeSuggestions) {
        headers.push('建议标题');
        headers.push('建议描述');
        headers.push('预期查询次数减少');
        headers.push('预期耗时减少(%)');
        headers.push('预期数据传输减少(%)');
    }
    const rows = [];
    rows.push(headers);
    for (const [index, issue] of sortedIssues.entries()) {
        const row = [
            String(index + 1),
            issue.id,
            issue.type,
            getIssueTypeLabel(issue.type),
            issue.severity,
            getSeverityLabel(issue.severity),
            issue.title,
            issue.description,
            issue.requestId,
            String(issue.impact.queryCountIncrease),
            String(issue.impact.durationIncreaseMs.toFixed(2)),
            String(issue.impact.dataTransferIncreaseBytes),
        ];
        if (includeSql) {
            const sampleSql = issue.evidence.queries[0] || '';
            row.push(sampleSql.substring(0, 500));
            row.push(String(issue.evidence.queries.length));
        }
        if (includeSuggestions) {
            row.push(issue.suggestion.title);
            row.push(issue.suggestion.description);
            row.push(String(issue.suggestion.expectedImprovement.queryCountReduction || 0));
            row.push(String(issue.suggestion.expectedImprovement.durationReductionPercent || 0));
            row.push(String(issue.suggestion.expectedImprovement.dataTransferReductionPercent || 0));
        }
        rows.push(row);
    }
    return rows.map(row => row.map(escapeCsvField).join(',')).join('\n');
}
function exportSummaryCsv(analysisResults) {
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
    const rows = [];
    rows.push(['概览']);
    rows.push(['指标', '数值']);
    rows.push(['总请求数', String(totalRequests)]);
    rows.push(['总查询数', String(totalQueries)]);
    rows.push(['总问题数', String(totalIssues)]);
    rows.push([]);
    rows.push(['按类型统计']);
    rows.push(['类型', '数量']);
    for (const [type, count] of Object.entries(issuesByType)) {
        rows.push([getIssueTypeLabel(type), String(count)]);
    }
    rows.push([]);
    rows.push(['按严重程度统计']);
    rows.push(['严重程度', '数量']);
    for (const [severity, count] of Object.entries(issuesBySeverity)) {
        rows.push([getSeverityLabel(severity), String(count)]);
    }
    rows.push([]);
    rows.push(['请求详情']);
    rows.push(['请求ID', '路径', '方法', '状态码', '查询次数', '问题数']);
    for (const result of analysisResults) {
        const group = result.requestGroup;
        rows.push([
            group.requestId,
            group.apiLog?.path || '',
            group.apiLog?.method || '',
            String(group.apiLog?.statusCode || ''),
            String(group.totalQueryCount),
            String(result.issues.length),
        ]);
    }
    return rows.map(row => row.map(escapeCsvField).join(',')).join('\n');
}
//# sourceMappingURL=csv-exporter.js.map