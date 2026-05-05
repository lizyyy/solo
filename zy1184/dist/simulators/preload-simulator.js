"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreloadSimulator = void 0;
exports.simulatePreload = simulatePreload;
const models_1 = require("../models");
const id_generator_1 = require("../utils/id-generator");
class PreloadSimulator {
    constructor(options = {}, tableStructures, repositoryMethods) {
        this.options = { ...models_1.DEFAULT_SIMULATION_OPTIONS, ...options };
        this.tableStructures = tableStructures;
        this.repositoryMethods = repositoryMethods;
    }
    simulate(requestGroup, issues) {
        if (!this.options.simulatePreload)
            return null;
        const nPlusOneIssues = issues.filter(i => i.type === 'N_PLUS_1' || i.type === 'MISSING_PRELOAD');
        if (nPlusOneIssues.length === 0)
            return null;
        const allRelatedQueries = [];
        const mainQueries = [];
        for (const issue of nPlusOneIssues) {
            for (const query of issue.queries) {
                if (this.isIdLookupQuery(query)) {
                    allRelatedQueries.push(query);
                }
                else {
                    mainQueries.push(query);
                }
            }
        }
        if (allRelatedQueries.length < 2)
            return null;
        const queriesByTable = new Map();
        for (const query of allRelatedQueries) {
            const table = query.tableName || 'unknown';
            if (!queriesByTable.has(table)) {
                queriesByTable.set(table, []);
            }
            queriesByTable.get(table).push(query);
        }
        const optimizedQueries = [];
        let totalOriginalDuration = 0;
        let totalOriginalQueries = allRelatedQueries.length;
        for (const [table, queries] of queriesByTable) {
            if (queries.length < 2)
                continue;
            totalOriginalDuration += queries.reduce((sum, q) => sum + q.duration, 0);
            const optimizedQuery = this.createOptimizedQuery(table, queries);
            optimizedQueries.push(optimizedQuery);
        }
        if (optimizedQueries.length === 0)
            return null;
        const originalDuration = totalOriginalDuration;
        const optimizedDuration = optimizedQueries.reduce((sum, q) => sum + q.estimatedDuration, 0);
        const estimatedDataTransferOriginal = allRelatedQueries.length * 200;
        const estimatedDataTransferOptimized = optimizedQueries.length * 300;
        return {
            id: (0, id_generator_1.generateId)(),
            type: 'PRELOAD',
            title: '使用预加载优化 N+1 查询',
            description: `将 ${totalOriginalQueries} 个单独查询替换为 ${optimizedQueries.length} 个批量查询，使用 WHERE IN 替代多个单条查询。`,
            targetIssues: nPlusOneIssues.map(i => i.id),
            originalQueries: allRelatedQueries,
            optimizedQueries,
            impact: {
                queryCountChange: -(totalOriginalQueries - optimizedQueries.length),
                queryCountChangePercent: Math.round((1 - optimizedQueries.length / totalOriginalQueries) * 100),
                durationChangeMs: -(originalDuration - optimizedDuration),
                durationChangePercent: Math.round((1 - optimizedDuration / originalDuration) * 100),
                dataTransferChangeBytes: -(estimatedDataTransferOriginal - estimatedDataTransferOptimized),
                dataTransferChangePercent: Math.round((1 - estimatedDataTransferOptimized / estimatedDataTransferOriginal) * 100),
            },
            before: {
                queryCount: totalOriginalQueries,
                totalDurationMs: originalDuration,
                totalDataTransferBytes: estimatedDataTransferOriginal,
                queries: allRelatedQueries.map(q => ({
                    sql: q.sql,
                    duration: q.duration,
                    dataTransferBytes: 200,
                })),
            },
            after: {
                queryCount: optimizedQueries.length,
                totalDurationMs: optimizedDuration,
                totalDataTransferBytes: estimatedDataTransferOptimized,
                queries: optimizedQueries.map(q => ({
                    sql: q.sql,
                    duration: q.estimatedDuration,
                    dataTransferBytes: q.estimatedRows * 50,
                })),
            },
        };
    }
    isIdLookupQuery(query) {
        if (query.operationType !== 'SELECT')
            return false;
        const whereClauses = query.whereClauses;
        if (whereClauses.length === 0)
            return false;
        const idColumns = ['id', 'user_id', 'userId', 'post_id', 'postId', 'comment_id', 'commentId', 'author_id', 'authorId'];
        for (const clause of whereClauses) {
            const columnLower = clause.column.toLowerCase();
            const isIdColumn = idColumns.some(id => columnLower === id.toLowerCase() || columnLower.endsWith('_id'));
            if (isIdColumn && clause.operator === '=') {
                return true;
            }
        }
        return false;
    }
    createOptimizedQuery(table, queries) {
        const allIds = new Set();
        for (const query of queries) {
            for (const clause of query.whereClauses) {
                if (clause.value !== null && clause.value !== undefined) {
                    allIds.add(clause.value);
                }
            }
        }
        const idArray = Array.from(allIds);
        const sampleQuery = queries[0];
        const selectFields = sampleQuery.selectFields.includes('*')
            ? '*'
            : sampleQuery.selectFields.join(', ');
        const sql = `SELECT ${selectFields} FROM ${table} WHERE id IN (${idArray.map(() => '?').join(', ')})`;
        const batchSize = this.options.batchSize || 100;
        const batchesNeeded = Math.ceil(idArray.length / batchSize);
        const estimatedDuration = (sampleQuery.duration * 0.3) * batchesNeeded + (idArray.length * 0.01);
        const estimatedRows = idArray.length;
        return {
            sql,
            normalizedSql: sql,
            parameters: idArray,
            estimatedDuration,
            estimatedRows,
            explanation: `将 ${queries.length} 个单独查询合并为 ${batchesNeeded} 个批量查询，使用 WHERE IN 一次性获取 ${idArray.length} 条记录。`,
        };
    }
}
exports.PreloadSimulator = PreloadSimulator;
function simulatePreload(requestGroup, issues, options, tableStructures, repositoryMethods) {
    const simulator = new PreloadSimulator(options, tableStructures, repositoryMethods);
    return simulator.simulate(requestGroup, issues);
}
//# sourceMappingURL=preload-simulator.js.map