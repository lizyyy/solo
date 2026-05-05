"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldTrimmingSimulator = void 0;
exports.simulateFieldTrimming = simulateFieldTrimming;
const models_1 = require("../models");
const id_generator_1 = require("../utils/id-generator");
class FieldTrimmingSimulator {
    constructor(options = {}, tableStructures, repositoryMethods) {
        this.options = { ...models_1.DEFAULT_SIMULATION_OPTIONS, ...options };
        this.tableStructures = tableStructures;
        this.repositoryMethods = repositoryMethods;
    }
    simulate(requestGroup, issues) {
        if (!this.options.simulateFieldTrimming)
            return null;
        const unusedFieldsIssues = issues.filter(i => i.type === 'UNUSED_FIELDS');
        if (unusedFieldsIssues.length === 0)
            return null;
        const allQueries = [];
        for (const issue of unusedFieldsIssues) {
            allQueries.push(...issue.queries);
        }
        if (allQueries.length === 0)
            return null;
        const optimizedQueries = [];
        let totalOriginalDuration = 0;
        let totalOriginalDataTransfer = 0;
        for (const query of allQueries) {
            const usesStar = query.selectFields.includes('*');
            const fieldCount = usesStar ? this.estimateTotalFields(query) : query.selectFields.length;
            const estimatedRows = query.rowsAffected || 10;
            totalOriginalDuration += query.duration;
            totalOriginalDataTransfer += fieldCount * estimatedRows * 50;
            const optimizedQuery = this.createOptimizedQuery(query);
            optimizedQueries.push(optimizedQuery);
        }
        const optimizedDuration = optimizedQueries.reduce((sum, q) => sum + q.estimatedDuration, 0);
        const optimizedDataTransfer = optimizedQueries.reduce((sum, q) => sum + q.estimatedRows * 50 * 3, 0);
        return {
            id: (0, id_generator_1.generateId)(),
            type: 'FIELD_TRIMMING',
            title: '使用字段裁剪优化数据传输',
            description: `检测到 ${allQueries.length} 个查询使用了 SELECT * 或选择了过多字段。通过只选择实际需要的字段，可以显著减少数据传输量。`,
            targetIssues: unusedFieldsIssues.map(i => i.id),
            originalQueries: allQueries,
            optimizedQueries,
            impact: {
                queryCountChange: 0,
                queryCountChangePercent: 0,
                durationChangeMs: -(totalOriginalDuration - optimizedDuration),
                durationChangePercent: Math.round((1 - optimizedDuration / totalOriginalDuration) * 100),
                dataTransferChangeBytes: -(totalOriginalDataTransfer - optimizedDataTransfer),
                dataTransferChangePercent: Math.round((1 - optimizedDataTransfer / totalOriginalDataTransfer) * 100),
            },
            before: {
                queryCount: allQueries.length,
                totalDurationMs: totalOriginalDuration,
                totalDataTransferBytes: totalOriginalDataTransfer,
                queries: allQueries.map(q => ({
                    sql: q.sql,
                    duration: q.duration,
                    dataTransferBytes: this.estimateDataTransfer(q),
                })),
            },
            after: {
                queryCount: optimizedQueries.length,
                totalDurationMs: optimizedDuration,
                totalDataTransferBytes: optimizedDataTransfer,
                queries: optimizedQueries.map(q => ({
                    sql: q.sql,
                    duration: q.estimatedDuration,
                    dataTransferBytes: q.estimatedRows * 50 * 3,
                })),
            },
        };
    }
    estimateTotalFields(query) {
        if (this.tableStructures && query.tableName) {
            const table = this.tableStructures.find(t => t.tableName === query.tableName);
            if (table) {
                return table.columns.length;
            }
        }
        return 20;
    }
    estimateDataTransfer(query) {
        const usesStar = query.selectFields.includes('*');
        const fieldCount = usesStar ? this.estimateTotalFields(query) : query.selectFields.length;
        const estimatedRows = query.rowsAffected || 10;
        return fieldCount * estimatedRows * 50;
    }
    createOptimizedQuery(query) {
        const table = query.tableName || 'table';
        const estimatedRows = query.rowsAffected || 10;
        const essentialFields = this.getEssentialFields(query);
        const selectFields = essentialFields.join(', ');
        const sql = `SELECT ${selectFields} FROM ${table}${this.buildWhereClause(query)}`;
        const originalFieldCount = query.selectFields.includes('*')
            ? this.estimateTotalFields(query)
            : query.selectFields.length;
        const optimizedFieldCount = essentialFields.length;
        const reductionRatio = optimizedFieldCount / originalFieldCount;
        const estimatedDuration = query.duration * (0.3 + reductionRatio * 0.5);
        return {
            sql,
            normalizedSql: sql,
            parameters: query.parameters,
            estimatedDuration,
            estimatedRows,
            explanation: `将 ${originalFieldCount} 个字段减少到 ${optimizedFieldCount} 个关键字段，预计减少 ${Math.round((1 - reductionRatio) * 100)}% 的数据传输量。`,
        };
    }
    getEssentialFields(query) {
        const essentialFields = [];
        for (const clause of query.whereClauses) {
            if (!essentialFields.includes(clause.column)) {
                essentialFields.push(clause.column);
            }
        }
        if (query.orderBy) {
            for (const order of query.orderBy) {
                if (!essentialFields.includes(order.column)) {
                    essentialFields.push(order.column);
                }
            }
        }
        if (query.groupBy) {
            for (const group of query.groupBy) {
                if (!essentialFields.includes(group)) {
                    essentialFields.push(group);
                }
            }
        }
        if (!essentialFields.includes('id') && !this.hasIdInWhere(query)) {
            essentialFields.unshift('id');
        }
        if (!query.selectFields.includes('*') && query.selectFields.length > 0) {
            for (const field of query.selectFields.slice(0, 5)) {
                if (!essentialFields.includes(field) && field !== '*') {
                    essentialFields.push(field);
                }
            }
        }
        return essentialFields;
    }
    hasIdInWhere(query) {
        return query.whereClauses.some(c => c.column.toLowerCase() === 'id' ||
            c.column.toLowerCase().endsWith('_id'));
    }
    buildWhereClause(query) {
        if (query.whereClauses.length === 0)
            return '';
        const conditions = query.whereClauses.map(c => `${c.column} ${c.operator} ?`).join(' AND ');
        return ` WHERE ${conditions}`;
    }
}
exports.FieldTrimmingSimulator = FieldTrimmingSimulator;
function simulateFieldTrimming(requestGroup, issues, options, tableStructures, repositoryMethods) {
    const simulator = new FieldTrimmingSimulator(options, tableStructures, repositoryMethods);
    return simulator.simulate(requestGroup, issues);
}
//# sourceMappingURL=field-trimming-simulator.js.map