"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchQuerySimulator = void 0;
exports.simulateBatchQuery = simulateBatchQuery;
const models_1 = require("../models");
const id_generator_1 = require("../utils/id-generator");
class BatchQuerySimulator {
    constructor(options = {}, tableStructures, repositoryMethods) {
        this.options = { ...models_1.DEFAULT_SIMULATION_OPTIONS, ...options };
        this.tableStructures = tableStructures;
        this.repositoryMethods = repositoryMethods;
    }
    simulate(requestGroup, issues) {
        if (!this.options.simulateBatchQuery)
            return null;
        const duplicateIssues = issues.filter(i => i.type === 'DUPLICATE_QUERY');
        if (duplicateIssues.length === 0)
            return null;
        const allQueries = [];
        for (const issue of duplicateIssues) {
            allQueries.push(...issue.queries);
        }
        if (allQueries.length < 2)
            return null;
        const queriesByNormalizedSql = new Map();
        for (const query of allQueries) {
            const key = query.normalizedSql;
            if (!queriesByNormalizedSql.has(key)) {
                queriesByNormalizedSql.set(key, []);
            }
            queriesByNormalizedSql.get(key).push(query);
        }
        const optimizedQueries = [];
        let totalOriginalQueries = 0;
        let totalOriginalDuration = 0;
        for (const [normalizedSql, queries] of queriesByNormalizedSql) {
            if (queries.length < 2)
                continue;
            totalOriginalQueries += queries.length;
            totalOriginalDuration += queries.reduce((sum, q) => sum + q.duration, 0);
            const optimizedQuery = this.createOptimizedQuery(queries);
            optimizedQueries.push(optimizedQuery);
        }
        if (optimizedQueries.length === 0)
            return null;
        const optimizedDuration = optimizedQueries.reduce((sum, q) => sum + q.estimatedDuration, 0);
        const originalDataTransfer = totalOriginalQueries * 100;
        const optimizedDataTransfer = optimizedQueries.length * 150;
        return {
            id: (0, id_generator_1.generateId)(),
            type: 'BATCH_QUERY',
            title: '使用请求级缓存消除重复查询',
            description: `在同一次请求中检测到 ${totalOriginalQueries} 个重复查询。通过添加请求级别的缓存或结果复用，可以消除这些重复查询。`,
            targetIssues: duplicateIssues.map(i => i.id),
            originalQueries: allQueries,
            optimizedQueries,
            impact: {
                queryCountChange: -(totalOriginalQueries - optimizedQueries.length),
                queryCountChangePercent: Math.round((1 - optimizedQueries.length / totalOriginalQueries) * 100),
                durationChangeMs: -(totalOriginalDuration - optimizedDuration),
                durationChangePercent: Math.round((1 - optimizedDuration / totalOriginalDuration) * 100),
                dataTransferChangeBytes: -(originalDataTransfer - optimizedDataTransfer),
                dataTransferChangePercent: Math.round((1 - optimizedDataTransfer / originalDataTransfer) * 100),
            },
            before: {
                queryCount: totalOriginalQueries,
                totalDurationMs: totalOriginalDuration,
                totalDataTransferBytes: originalDataTransfer,
                queries: allQueries.map(q => ({
                    sql: q.sql,
                    duration: q.duration,
                    dataTransferBytes: 100,
                })),
            },
            after: {
                queryCount: optimizedQueries.length,
                totalDurationMs: optimizedDuration,
                totalDataTransferBytes: optimizedDataTransfer,
                queries: optimizedQueries.map(q => ({
                    sql: q.sql,
                    duration: q.estimatedDuration,
                    dataTransferBytes: q.estimatedRows * 50,
                })),
            },
        };
    }
    createOptimizedQuery(queries) {
        const sampleQuery = queries[0];
        const table = sampleQuery.tableName || 'table';
        const selectFields = sampleQuery.selectFields.includes('*')
            ? '*'
            : sampleQuery.selectFields.join(', ');
        let sql = sampleQuery.sql;
        let explanation = `缓存第 1 次查询结果，后续 ${queries.length - 1} 次查询直接使用缓存结果。`;
        if (this.isBatchableQuery(sampleQuery)) {
            const allParams = this.collectAllParameters(queries);
            sql = this.generateBatchQuery(sampleQuery, allParams);
            explanation = `将 ${queries.length} 个查询合并为 1 个批量查询，使用 WHERE IN 条件。`;
        }
        const estimatedDuration = sampleQuery.duration * 0.1;
        const estimatedRows = sampleQuery.rowsAffected || 10;
        return {
            sql,
            normalizedSql: sql,
            parameters: this.collectAllParameters(queries),
            estimatedDuration,
            estimatedRows,
            explanation,
        };
    }
    isBatchableQuery(query) {
        if (query.operationType !== 'SELECT')
            return false;
        const hasSimpleWhere = query.whereClauses.length === 1 &&
            (query.whereClauses[0].operator === '=' ||
                query.whereClauses[0].operator === 'IN');
        return hasSimpleWhere;
    }
    collectAllParameters(queries) {
        const allParams = new Set();
        for (const query of queries) {
            for (const clause of query.whereClauses) {
                if (clause.value !== null && clause.value !== undefined) {
                    allParams.add(clause.value);
                }
            }
            for (const param of query.parameters) {
                allParams.add(param);
            }
        }
        return Array.from(allParams);
    }
    generateBatchQuery(sampleQuery, allParams) {
        const table = sampleQuery.tableName || 'table';
        const selectFields = sampleQuery.selectFields.includes('*')
            ? '*'
            : sampleQuery.selectFields.join(', ');
        if (sampleQuery.whereClauses.length === 1) {
            const whereClause = sampleQuery.whereClauses[0];
            return `SELECT ${selectFields} FROM ${table} WHERE ${whereClause.column} IN (${allParams.map(() => '?').join(', ')})`;
        }
        return sampleQuery.sql;
    }
}
exports.BatchQuerySimulator = BatchQuerySimulator;
function simulateBatchQuery(requestGroup, issues, options, tableStructures, repositoryMethods) {
    const simulator = new BatchQuerySimulator(options, tableStructures, repositoryMethods);
    return simulator.simulate(requestGroup, issues);
}
//# sourceMappingURL=batch-query-simulator.js.map