"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeQueries = analyzeQueries;
exports.getUnusedFields = getUnusedFields;
const query_scanner_1 = require("./query-scanner");
const schema_parser_1 = require("./schema-parser");
function analyzeQueries(queries, schema, initialErrors = []) {
    const fieldUsageAccumulator = {};
    const errors = [...initialErrors];
    const clientStats = {};
    let successfulQueries = 0;
    const schemaFields = (0, schema_parser_1.getAllSchemaFields)(schema);
    for (const querySample of queries) {
        try {
            const { fields, clientTag } = (0, query_scanner_1.extractFieldsFromQuery)(querySample.query, querySample.clientTag);
            clientStats[clientTag] = (clientStats[clientTag] || 0) + 1;
            for (const fullPath of fields) {
                if (!fieldUsageAccumulator[fullPath]) {
                    fieldUsageAccumulator[fullPath] = {
                        count: 0,
                        clients: {}
                    };
                }
                fieldUsageAccumulator[fullPath].count++;
                fieldUsageAccumulator[fullPath].clients[clientTag] =
                    (fieldUsageAccumulator[fullPath].clients[clientTag] || 0) + 1;
            }
            successfulQueries++;
        }
        catch (error) {
            errors.push({
                message: `解析查询失败: ${error.message}`,
                source: querySample.source,
                lineNumber: querySample.lineNumber,
                query: querySample.query
            });
        }
    }
    const fieldUsage = Object.entries(fieldUsageAccumulator)
        .map(([fullPath, data]) => {
        const parts = fullPath.split('.');
        const fieldName = parts.pop() || '';
        const typeName = parts.join('.');
        return {
            fieldName,
            typeName,
            fullPath,
            count: data.count,
            clients: data.clients
        };
    })
        .sort((a, b) => b.count - a.count);
    return {
        fieldUsage,
        totalQueries: queries.length,
        successfulQueries,
        failedQueries: errors.length,
        errors,
        clientStats
    };
}
function getUnusedFields(result, schema) {
    const schemaFields = (0, schema_parser_1.getAllSchemaFields)(schema);
    const usedFields = new Set(result.fieldUsage.map(f => f.fullPath));
    const unusedFields = [];
    for (const field of schemaFields) {
        if (!usedFields.has(field)) {
            unusedFields.push(field);
        }
    }
    return unusedFields.sort();
}
