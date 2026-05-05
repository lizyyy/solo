import { OrderByClause, WhereClause } from '../models';
export declare function normalizeSql(sql: string): string;
export declare function extractTableName(sql: string): string | undefined;
export declare function extractOperationType(sql: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER';
export declare function extractJoinTables(sql: string): string[];
export declare function extractSelectFields(sql: string): string[];
export declare function extractWhereClauses(sql: string): WhereClause[];
export declare function extractLimit(sql: string): number | undefined;
export declare function extractOffset(sql: string): number | undefined;
export declare function extractOrderBy(sql: string): OrderByClause[];
export declare function extractGroupBy(sql: string): string[];
//# sourceMappingURL=sql-normalizer.d.ts.map