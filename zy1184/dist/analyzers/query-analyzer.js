"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryAnalyzer = void 0;
exports.analyzeQuery = analyzeQuery;
exports.analyzeQueriesBatch = analyzeQueriesBatch;
const models_1 = require("../models");
const n_plus_one_detector_1 = require("./n-plus-one-detector");
const duplicate_query_detector_1 = require("./duplicate-query-detector");
const deep_pagination_detector_1 = require("./deep-pagination-detector");
const missing_preload_detector_1 = require("./missing-preload-detector");
const unused_fields_detector_1 = require("./unused-fields-detector");
const slow_query_detector_1 = require("./slow-query-detector");
class QueryAnalyzer {
    constructor(options = {}, tableStructures, repositoryMethods) {
        this.options = { ...models_1.DEFAULT_ANALYSIS_OPTIONS, ...options };
        this.tableStructures = tableStructures;
        this.repositoryMethods = repositoryMethods;
    }
    analyze(requestGroup) {
        const issues = [];
        if (this.options.checkNPlus1) {
            issues.push(...(0, n_plus_one_detector_1.detectNPlusOne)(requestGroup, this.options));
        }
        if (this.options.checkDuplicateQueries) {
            issues.push(...(0, duplicate_query_detector_1.detectDuplicateQueries)(requestGroup, this.options));
        }
        if (this.options.checkDeepPagination) {
            issues.push(...(0, deep_pagination_detector_1.detectDeepPagination)(requestGroup, this.options));
        }
        if (this.options.checkMissingPreload) {
            issues.push(...(0, missing_preload_detector_1.detectMissingPreload)(requestGroup, this.options, this.repositoryMethods));
        }
        if (this.options.checkUnusedFields) {
            issues.push(...(0, unused_fields_detector_1.detectUnusedFields)(requestGroup, this.options, this.tableStructures));
        }
        if (this.options.checkLargeResultSets) {
            issues.push(...this.detectLargeResultSets(requestGroup));
        }
        if (this.options.checkMissingIndexes) {
            issues.push(...this.detectMissingIndexes(requestGroup));
        }
        const slowIssues = (0, slow_query_detector_1.detectSlowQueries)(requestGroup, this.options, this.tableStructures);
        issues.push(...slowIssues);
        const summary = this.createSummary([{ requestGroup, issues }]);
        return {
            requestId: requestGroup.requestId,
            requestGroup,
            issues,
            summary,
            analysisTime: new Date(),
        };
    }
    analyzeBatch(requestGroups) {
        const results = [];
        for (const group of requestGroups) {
            results.push(this.analyze(group));
        }
        return results;
    }
    detectLargeResultSets(requestGroup) {
        const issues = [];
        const largeResultSetThreshold = 1000;
        for (const query of requestGroup.sqlQueries) {
            if (query.operationType === 'SELECT' && query.rowsAffected && query.rowsAffected >= largeResultSetThreshold) {
                const severity = query.rowsAffected >= 10000 ? 'HIGH' :
                    query.rowsAffected >= 5000 ? 'MEDIUM' : 'LOW';
                issues.push({
                    id: '',
                    type: 'LARGE_RESULT_SET',
                    severity,
                    title: `大结果集查询在表 ${query.tableName || 'unknown'}`,
                    description: `查询返回了 ${query.rowsAffected} 行数据，超过阈值 ${largeResultSetThreshold} 行。大结果集会消耗大量内存和网络带宽。`,
                    requestId: requestGroup.requestId,
                    queries: [query],
                    suggestion: {
                        title: '使用分页或限制返回行数',
                        description: `对大结果集使用分页，或添加 LIMIT 限制。考虑是否真的需要所有这些数据。`,
                        codeExample: `// 添加分页
const results = await Model.findAll({
  where: { /* 条件 */ },
  limit: 100,  // 限制每页数量
  offset: 0
});

// 或使用游标分页
const results = await Model.findAll({
  where: {
    id: { [Op.gt]: lastCursorId }
  },
  limit: 100,
  order: [['id', 'ASC']]
});`,
                        expectedImprovement: {
                            queryCountReduction: 0,
                            durationReductionPercent: 50,
                            dataTransferReductionPercent: 90,
                        },
                    },
                    impact: {
                        queryCountIncrease: 0,
                        durationIncreaseMs: query.duration * 0.5,
                        dataTransferIncreaseBytes: query.rowsAffected * 100,
                    },
                    evidence: {
                        queries: [query.sql],
                        parameters: [{ rowsAffected: query.rowsAffected, threshold: largeResultSetThreshold }],
                    },
                });
            }
        }
        return issues;
    }
    detectMissingIndexes(requestGroup) {
        const issues = [];
        if (!this.tableStructures)
            return issues;
        for (const query of requestGroup.sqlQueries) {
            if (query.operationType !== 'SELECT')
                continue;
            if (query.whereClauses.length === 0)
                continue;
            const table = this.tableStructures.find(t => t.tableName === query.tableName);
            if (!table)
                continue;
            const indexedColumns = this.getAllIndexedColumns(table);
            const whereColumns = query.whereClauses.map(c => c.column.toLowerCase());
            const hasMatchingIndex = whereColumns.some(col => indexedColumns.has(col));
            if (!hasMatchingIndex && query.duration > 50) {
                issues.push({
                    id: '',
                    type: 'MISSING_INDEX',
                    severity: query.duration > 200 ? 'HIGH' : query.duration > 100 ? 'MEDIUM' : 'LOW',
                    title: `可能缺失索引在表 ${query.tableName || 'unknown'}`,
                    description: `查询条件使用了列 (${whereColumns.join(', ')})，但这些列没有可用的索引。查询耗时 ${query.duration}ms。`,
                    requestId: requestGroup.requestId,
                    queries: [query],
                    suggestion: {
                        title: '为查询条件添加索引',
                        description: `为 WHERE 条件中使用的列添加索引。建议先分析执行计划，确认最有效的索引策略。`,
                        codeExample: `-- 添加索引
CREATE INDEX idx_${query.tableName}_${whereColumns[0]} 
ON ${query.tableName} (${whereColumns.join(', ')});

-- 检查执行计划
EXPLAIN ${query.sql};`,
                        expectedImprovement: {
                            queryCountReduction: 0,
                            durationReductionPercent: 80,
                            dataTransferReductionPercent: 0,
                        },
                    },
                    impact: {
                        queryCountIncrease: 0,
                        durationIncreaseMs: query.duration * 0.7,
                        dataTransferIncreaseBytes: 0,
                    },
                    evidence: {
                        queries: [query.sql],
                        parameters: [{
                                whereColumns,
                                indexedColumns: Array.from(indexedColumns),
                                duration: query.duration
                            }],
                    },
                });
            }
        }
        return issues;
    }
    getAllIndexedColumns(table) {
        const columns = new Set();
        if (table.primaryKey) {
            for (const col of table.primaryKey.columns) {
                columns.add(col.toLowerCase());
            }
        }
        for (const index of table.indexes) {
            for (const col of index.columns) {
                columns.add(col.toLowerCase());
            }
        }
        return columns;
    }
    createSummary(results) {
        const issuesByType = {
            N_PLUS_1: 0,
            DUPLICATE_QUERY: 0,
            DEEP_PAGINATION: 0,
            MISSING_PRELOAD: 0,
            UNUSED_FIELDS: 0,
            LARGE_RESULT_SET: 0,
            MISSING_INDEX: 0,
            SLOW_QUERY: 0,
        };
        const issuesBySeverity = {
            CRITICAL: 0,
            HIGH: 0,
            MEDIUM: 0,
            LOW: 0,
        };
        let totalPotentialImprovement = {
            queryCountReduction: 0,
            durationReductionMs: 0,
            dataTransferReductionBytes: 0,
        };
        const allIssues = [];
        for (const result of results) {
            allIssues.push(...result.issues);
            for (const issue of result.issues) {
                issuesByType[issue.type]++;
                issuesBySeverity[issue.severity]++;
                if (issue.suggestion.expectedImprovement.queryCountReduction) {
                    totalPotentialImprovement.queryCountReduction +=
                        issue.suggestion.expectedImprovement.queryCountReduction;
                }
                if (issue.impact.durationIncreaseMs) {
                    totalPotentialImprovement.durationReductionMs += issue.impact.durationIncreaseMs;
                }
                if (issue.impact.dataTransferIncreaseBytes) {
                    totalPotentialImprovement.dataTransferReductionBytes +=
                        issue.impact.dataTransferIncreaseBytes;
                }
            }
        }
        const sortedIssues = [...allIssues].sort((a, b) => {
            const severityOrder = {
                CRITICAL: 4,
                HIGH: 3,
                MEDIUM: 2,
                LOW: 1,
            };
            return severityOrder[b.severity] - severityOrder[a.severity];
        });
        const topIssues = sortedIssues.slice(0, 10);
        return {
            totalRequests: results.length,
            totalQueries: results.reduce((sum, r) => sum + r.requestGroup.totalQueryCount, 0),
            totalIssues: allIssues.length,
            issuesByType,
            issuesBySeverity,
            topIssues,
            totalPotentialImprovement,
        };
    }
    static analyzeBatch(requestGroups, options, tableStructures, repositoryMethods) {
        const analyzer = new QueryAnalyzer(options, tableStructures, repositoryMethods);
        return analyzer.analyzeBatch(requestGroups);
    }
}
exports.QueryAnalyzer = QueryAnalyzer;
function analyzeQuery(requestGroup, options, tableStructures, repositoryMethods) {
    const analyzer = new QueryAnalyzer(options, tableStructures, repositoryMethods);
    return analyzer.analyze(requestGroup);
}
function analyzeQueriesBatch(requestGroups, options, tableStructures, repositoryMethods) {
    return QueryAnalyzer.analyzeBatch(requestGroups, options, tableStructures, repositoryMethods);
}
//# sourceMappingURL=query-analyzer.js.map