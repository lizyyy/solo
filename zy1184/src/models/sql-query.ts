export interface SqlQuery {
  id: string;
  requestId: string;
  timestamp: Date;
  sql: string;
  normalizedSql: string;
  parameters: any[];
  duration: number;
  rowsAffected?: number;
  error?: string;
  tableName?: string;
  operationType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER';
  joinTables: string[];
  whereClauses: WhereClause[];
  selectFields: string[];
  limit?: number;
  offset?: number;
  orderBy?: OrderByClause[];
  groupBy?: string[];
  repositoryMethod?: string;
  callStack?: string[];
}

export interface WhereClause {
  column: string;
  operator: string;
  value: any;
  isParameter: boolean;
}

export interface OrderByClause {
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface SqlQueryParseOptions {
  format?: 'json' | 'plain' | 'mysql' | 'postgresql';
  durationUnit?: 'ms' | 's' | 'us';
  normalizeSql?: boolean;
}
