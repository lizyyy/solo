import { SqlQuery, SqlQueryParseOptions } from '../models';
import { generateId } from '../utils/id-generator';
import { parseDate, durationToMs } from '../utils/date-utils';
import {
  normalizeSql,
  extractTableName,
  extractOperationType,
  extractJoinTables,
  extractSelectFields,
  extractWhereClauses,
  extractLimit,
  extractOffset,
  extractOrderBy,
  extractGroupBy,
} from '../utils/sql-normalizer';

export class SqlLogParser {
  private options: SqlQueryParseOptions;

  constructor(options: SqlQueryParseOptions = {}) {
    this.options = {
      format: 'plain',
      durationUnit: 'ms',
      normalizeSql: true,
      ...options,
    };
  }

  parse(content: string): SqlQuery[] {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    const queries: SqlQuery[] = [];

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

  private parseJsonFormat(content: string): SqlQuery[] {
    try {
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        return data.map(item => this.parseJsonItem(item));
      }
      return [this.parseJsonItem(data)];
    } catch {
      const lines = content.split(/\r?\n/).filter(line => line.trim());
      return lines.map(line => {
        try {
          return this.parseJsonItem(JSON.parse(line));
        } catch {
          return null;
        }
      }).filter((q): q is SqlQuery => q !== null);
    }
  }

  private parseJsonItem(item: any): SqlQuery {
    const sql = item.sql || item.query || item.statement || '';
    const normalizedSql = this.options.normalizeSql ? normalizeSql(sql) : sql;

    return {
      id: item.id || generateId(),
      requestId: item.requestId || item.request_id || item.traceId || '',
      timestamp: item.timestamp ? parseDate(item.timestamp) : new Date(),
      sql,
      normalizedSql,
      parameters: item.parameters || item.params || [],
      duration: item.duration 
        ? durationToMs(String(item.duration), this.options.durationUnit)
        : item.executionTime || item.time || 0,
      rowsAffected: item.rowsAffected || item.rowCount || item.rows,
      error: item.error,
      tableName: item.tableName || extractTableName(sql),
      operationType: item.operationType || extractOperationType(sql),
      joinTables: item.joinTables || extractJoinTables(sql),
      whereClauses: item.whereClauses || extractWhereClauses(sql),
      selectFields: item.selectFields || extractSelectFields(sql),
      limit: item.limit || extractLimit(sql),
      offset: item.offset || extractOffset(sql),
      orderBy: item.orderBy || extractOrderBy(sql),
      groupBy: item.groupBy || extractGroupBy(sql),
      repositoryMethod: item.repositoryMethod || item.method,
      callStack: item.callStack || item.stack,
    };
  }

  private parsePlainFormat(lines: string[]): SqlQuery[] {
    const queries: SqlQuery[] = [];
    let currentQuery: Partial<SqlQuery> | null = null;
    let sqlBuffer = '';

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (this.isQueryStart(trimmedLine)) {
        if (currentQuery && sqlBuffer) {
          const sql = sqlBuffer.trim();
          currentQuery.sql = sql;
          currentQuery.normalizedSql = this.options.normalizeSql ? normalizeSql(sql) : sql;
          currentQuery.tableName = currentQuery.tableName || extractTableName(sql);
          currentQuery.operationType = currentQuery.operationType || extractOperationType(sql);
          currentQuery.joinTables = currentQuery.joinTables || extractJoinTables(sql);
          currentQuery.whereClauses = currentQuery.whereClauses || extractWhereClauses(sql);
          currentQuery.selectFields = currentQuery.selectFields || extractSelectFields(sql);
          currentQuery.limit = currentQuery.limit || extractLimit(sql);
          currentQuery.offset = currentQuery.offset || extractOffset(sql);
          currentQuery.orderBy = currentQuery.orderBy || extractOrderBy(sql);
          currentQuery.groupBy = currentQuery.groupBy || extractGroupBy(sql);
          
          queries.push(this.buildQuery(currentQuery));
        }

        currentQuery = this.parseQueryHeader(trimmedLine);
        sqlBuffer = '';
      } else if (currentQuery) {
        sqlBuffer += ' ' + trimmedLine;
      }
    }

    if (currentQuery && sqlBuffer.trim()) {
      const sql = sqlBuffer.trim();
      currentQuery.sql = sql;
      currentQuery.normalizedSql = this.options.normalizeSql ? normalizeSql(sql) : sql;
      queries.push(this.buildQuery(currentQuery));
    }

    return queries;
  }

  private parseMySqlFormat(lines: string[]): SqlQuery[] {
    return this.parsePlainFormat(lines);
  }

  private parsePostgreSqlFormat(lines: string[]): SqlQuery[] {
    return this.parsePlainFormat(lines);
  }

  private isQueryStart(line: string): boolean {
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

  private parseQueryHeader(line: string): Partial<SqlQuery> {
    const query: Partial<SqlQuery> = {
      id: generateId(),
      parameters: [],
      joinTables: [],
      whereClauses: [],
      selectFields: [],
      operationType: 'OTHER',
    };

    const timestampMatch = line.match(/(\d{4}[-/]\d{2}[-/]\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)/);
    if (timestampMatch) {
      query.timestamp = parseDate(timestampMatch[1]);
    }

    const durationMatch = line.match(/(?:duration|time|executed)[^\d]*(\d+(?:\.\d+)?)\s*(ms|s|μs|us)/i);
    if (durationMatch) {
      const unit = durationMatch[2].toLowerCase() === 's' ? 's' : 
                   durationMatch[2].toLowerCase() === 'us' || durationMatch[2].toLowerCase() === 'μs' ? 'us' : 'ms';
      query.duration = durationToMs(durationMatch[1], unit);
    }

    const requestIdMatch = line.match(/(?:requestId|request_id|traceId|trace_id):\s*([a-zA-Z0-9_-]+)/i);
    if (requestIdMatch) {
      query.requestId = requestIdMatch[1];
    }

    return query;
  }

  private buildQuery(partial: Partial<SqlQuery>): SqlQuery {
    return {
      id: partial.id || generateId(),
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

export function parseSqlLog(content: string, options?: SqlQueryParseOptions): SqlQuery[] {
  const parser = new SqlLogParser(options);
  return parser.parse(content);
}
