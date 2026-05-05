"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlLogParser = void 0;
exports.parseSqlLog = parseSqlLog;
const id_generator_1 = require("../utils/id-generator");
const date_utils_1 = require("../utils/date-utils");
const sql_normalizer_1 = require("../utils/sql-normalizer");
class SqlLogParser {
    constructor(options = {}) {
        this.options = {
            format: 'plain',
            durationUnit: 'ms',
            normalizeSql: true,
            ...options,
        };
    }
    parse(content) {
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        const queries = [];
        switch (this.options.format) {
            case 'json':
                return this.parseJsonFormat(content);
            case 'mysql':
                return this.parseMySqlFormat(lines);
            case 'postgresql':
                return this.parsePostgreSqlFormat(lines);
            case 'plain':
            default:
                return this.parsePlainFormat(lines);
        }
    }
    parseJsonFormat(content) {
        try {
            const data = JSON.parse(content);
            if (Array.isArray(data)) {
                return data.map(item => this.parseJsonItem(item));
            }
            return [this.parseJsonItem(data)];
        }
        catch {
            const lines = content.split(/\r?\n/).filter(line => line.trim());
            return lines.map(line => {
                try {
                    return this.parseJsonItem(JSON.parse(line));
                }
                catch {
                    return null;
                }
            }).filter((q) => q !== null);
        }
    }
    parseJsonItem(item) {
        const sql = item.sql || item.query || item.statement || '';
        const normalizedSql = this.options.normalizeSql ? (0, sql_normalizer_1.normalizeSql)(sql) : sql;
        return {
            id: item.id || (0, id_generator_1.generateId)(),
            requestId: item.requestId || item.request_id || item.traceId || '',
            timestamp: item.timestamp ? (0, date_utils_1.parseDate)(item.timestamp) : new Date(),
            sql,
            normalizedSql,
            parameters: item.parameters || item.params || [],
            duration: item.duration
                ? (0, date_utils_1.durationToMs)(String(item.duration), this.options.durationUnit)
                : item.executionTime || item.time || 0,
            rowsAffected: item.rowsAffected || item.rowCount || item.rows,
            error: item.error,
            tableName: item.tableName || (0, sql_normalizer_1.extractTableName)(sql),
            operationType: item.operationType || (0, sql_normalizer_1.extractOperationType)(sql),
            joinTables: item.joinTables || (0, sql_normalizer_1.extractJoinTables)(sql),
            whereClauses: item.whereClauses || (0, sql_normalizer_1.extractWhereClauses)(sql),
            selectFields: item.selectFields || (0, sql_normalizer_1.extractSelectFields)(sql),
            limit: item.limit || (0, sql_normalizer_1.extractLimit)(sql),
            offset: item.offset || (0, sql_normalizer_1.extractOffset)(sql),
            orderBy: item.orderBy || (0, sql_normalizer_1.extractOrderBy)(sql),
            groupBy: item.groupBy || (0, sql_normalizer_1.extractGroupBy)(sql),
            repositoryMethod: item.repositoryMethod || item.method,
            callStack: item.callStack || item.stack,
        };
    }
    parsePlainFormat(lines) {
        const queries = [];
        let currentQuery = null;
        let sqlBuffer = '';
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (this.isQueryStart(trimmedLine)) {
                if (currentQuery && sqlBuffer) {
                    const sql = sqlBuffer.trim();
                    currentQuery.sql = sql;
                    currentQuery.normalizedSql = this.options.normalizeSql ? (0, sql_normalizer_1.normalizeSql)(sql) : sql;
                    currentQuery.tableName = currentQuery.tableName || (0, sql_normalizer_1.extractTableName)(sql);
                    currentQuery.operationType = currentQuery.operationType || (0, sql_normalizer_1.extractOperationType)(sql);
                    currentQuery.joinTables = currentQuery.joinTables || (0, sql_normalizer_1.extractJoinTables)(sql);
                    currentQuery.whereClauses = currentQuery.whereClauses || (0, sql_normalizer_1.extractWhereClauses)(sql);
                    currentQuery.selectFields = currentQuery.selectFields || (0, sql_normalizer_1.extractSelectFields)(sql);
                    currentQuery.limit = currentQuery.limit || (0, sql_normalizer_1.extractLimit)(sql);
                    currentQuery.offset = currentQuery.offset || (0, sql_normalizer_1.extractOffset)(sql);
                    currentQuery.orderBy = currentQuery.orderBy || (0, sql_normalizer_1.extractOrderBy)(sql);
                    currentQuery.groupBy = currentQuery.groupBy || (0, sql_normalizer_1.extractGroupBy)(sql);
                    queries.push(this.buildQuery(currentQuery));
                }
                currentQuery = this.parseQueryHeader(trimmedLine);
                sqlBuffer = '';
            }
            else if (currentQuery) {
                sqlBuffer += ' ' + trimmedLine;
            }
        }
        if (currentQuery && sqlBuffer.trim()) {
            const sql = sqlBuffer.trim();
            currentQuery.sql = sql;
            currentQuery.normalizedSql = this.options.normalizeSql ? (0, sql_normalizer_1.normalizeSql)(sql) : sql;
            queries.push(this.buildQuery(currentQuery));
        }
        return queries;
    }
    parseMySqlFormat(lines) {
        return this.parsePlainFormat(lines);
    }
    parsePostgreSqlFormat(lines) {
        return this.parsePlainFormat(lines);
    }
    isQueryStart(line) {
        const patterns = [
            /^SELECT\s+/i,
            /^INSERT\s+/i,
            /^UPDATE\s+/i,
            /^DELETE\s+/i,
            /^\d{4}[-/]\d{2}[-/]\d{2}/,
            /^\[\d{4}[-/]\d{2}[-/]\d{2}/,
            /^--\s*Query:/i,
        ];
        return patterns.some(p => p.test(line));
    }
    parseQueryHeader(line) {
        const query = {
            id: (0, id_generator_1.generateId)(),
            parameters: [],
            joinTables: [],
            whereClauses: [],
            selectFields: [],
            operationType: 'OTHER',
        };
        const timestampMatch = line.match(/(\d{4}[-/]\d{2}[-/]\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)/);
        if (timestampMatch) {
            query.timestamp = (0, date_utils_1.parseDate)(timestampMatch[1]);
        }
        const durationMatch = line.match(/(?:duration|time|executed)[^\d]*(\d+(?:\.\d+)?)\s*(ms|s|μs|us)/i);
        if (durationMatch) {
            const unit = durationMatch[2].toLowerCase() === 's' ? 's' :
                durationMatch[2].toLowerCase() === 'us' || durationMatch[2].toLowerCase() === 'μs' ? 'us' : 'ms';
            query.duration = (0, date_utils_1.durationToMs)(durationMatch[1], unit);
        }
        const requestIdMatch = line.match(/(?:requestId|request_id|traceId|trace_id):\s*([a-zA-Z0-9_-]+)/i);
        if (requestIdMatch) {
            query.requestId = requestIdMatch[1];
        }
        return query;
    }
    buildQuery(partial) {
        return {
            id: partial.id || (0, id_generator_1.generateId)(),
            requestId: partial.requestId || '',
            timestamp: partial.timestamp || new Date(),
            sql: partial.sql || '',
            normalizedSql: partial.normalizedSql || partial.sql || '',
            parameters: partial.parameters || [],
            duration: partial.duration || 0,
            rowsAffected: partial.rowsAffected,
            error: partial.error,
            tableName: partial.tableName,
            operationType: partial.operationType || 'OTHER',
            joinTables: partial.joinTables || [],
            whereClauses: partial.whereClauses || [],
            selectFields: partial.selectFields || [],
            limit: partial.limit,
            offset: partial.offset,
            orderBy: partial.orderBy,
            groupBy: partial.groupBy,
            repositoryMethod: partial.repositoryMethod,
            callStack: partial.callStack,
        };
    }
}
exports.SqlLogParser = SqlLogParser;
function parseSqlLog(content, options) {
    const parser = new SqlLogParser(options);
    return parser.parse(content);
}
//# sourceMappingURL=sql-log-parser.js.map