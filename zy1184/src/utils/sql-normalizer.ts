import { OrderByClause, WhereClause } from '../models';

export function normalizeSql(sql: string): string {
  let normalized = sql.trim();
  
  normalized = normalized.replace(/\s+/g, ' ');
  
  normalized = normalized.replace(/\s*([(),=<>+\-*/])\s*/g, '$1');
  
  normalized = replaceNumericParameters(normalized);
  
  normalized = replaceStringParameters(normalized);
  
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

function replaceNumericParameters(sql: string): string {
  return sql.replace(/\b\d+(\.\d+)?\b/g, '?');
}

function replaceStringParameters(sql: string): string {
  let result = sql;
  result = result.replace(/'[^']*'/g, '?');
  result = result.replace(/"[^"]*"/g, '?');
  return result;
}

export function extractTableName(sql: string): string | undefined {
  const patterns = [
    /FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/i,
    /UPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)/i,
    /INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/i,
    /DELETE\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/i,
  ];
  
  for (const pattern of patterns) {
    const match = sql.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return undefined;
}

export function extractOperationType(sql: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER' {
  const upperSql = sql.toUpperCase().trim();
  
  if (upperSql.startsWith('SELECT')) return 'SELECT';
  if (upperSql.startsWith('INSERT')) return 'INSERT';
  if (upperSql.startsWith('UPDATE')) return 'UPDATE';
  if (upperSql.startsWith('DELETE')) return 'DELETE';
  
  return 'OTHER';
}

export function extractJoinTables(sql: string): string[] {
  const joinPatterns = [
    /JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /INNER\s+JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /LEFT\s+JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /RIGHT\s+JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /FULL\s+JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
  ];
  
  const tables = new Set<string>();
  
  for (const pattern of joinPatterns) {
    let match;
    const regex = new RegExp(pattern.source, 'gi');
    while ((match = regex.exec(sql)) !== null) {
      if (match[1]) {
        tables.add(match[1]);
      }
    }
  }
  
  return Array.from(tables);
}

export function extractSelectFields(sql: string): string[] {
  const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/i);
  if (!selectMatch) return ['*'];
  
  const fieldsPart = selectMatch[1].trim();
  
  if (fieldsPart === '*' || fieldsPart.includes('*')) {
    return ['*'];
  }
  
  const fields = fieldsPart.split(/\s*,\s*/);
  return fields.map(f => {
    const clean = f.trim();
    const aliasMatch = clean.match(/^(.*?)(?:\s+AS\s+|\s+)(\w+)$/i);
    if (aliasMatch) {
      return aliasMatch[1].trim();
    }
    return clean;
  });
}

export function extractWhereClauses(sql: string): WhereClause[] {
  const clauses: WhereClause[] = [];
  
  const whereMatch = sql.match(/WHERE\s+(.*?)(?:\s+(?:ORDER|GROUP|LIMIT|OFFSET|HAVING)\s+|$)/i);
  if (!whereMatch) return clauses;
  
  const wherePart = whereMatch[1].trim();
  
  const conditions = wherePart.split(/\s+(?:AND|OR)\s+/i);
  
  for (const condition of conditions) {
    const eqMatch = condition.match(/^([a-zA-Z_][a-zA-Z0-9_.]*)\s*([<>=!]+)\s*(.+)$/i);
    if (eqMatch) {
      const value = eqMatch[3].trim();
      const isParameter = value === '?' || 
                          value.startsWith('@') || 
                          value.startsWith(':') ||
                          (value.startsWith("'") && value.endsWith("'")) ||
                          (!isNaN(Number(value)));
      
      clauses.push({
        column: eqMatch[1],
        operator: eqMatch[2],
        value: parseValue(value),
        isParameter,
      });
    }
  }
  
  return clauses;
}

function parseValue(value: string): any {
  const trimmed = value.trim();
  
  if (trimmed === '?') return null;
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  if (!isNaN(Number(trimmed))) {
    return Number(trimmed);
  }
  
  return trimmed;
}

export function extractLimit(sql: string): number | undefined {
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) {
    return parseInt(limitMatch[1], 10);
  }
  return undefined;
}

export function extractOffset(sql: string): number | undefined {
  const offsetMatch = sql.match(/OFFSET\s+(\d+)/i);
  if (offsetMatch) {
    return parseInt(offsetMatch[1], 10);
  }
  return undefined;
}

export function extractOrderBy(sql: string): OrderByClause[] {
  const clauses: OrderByClause[] = [];
  
  const orderByMatch = sql.match(/ORDER\s+BY\s+(.*?)(?:\s+(?:LIMIT|OFFSET)\s+|$)/i);
  if (!orderByMatch) return clauses;
  
  const orderPart = orderByMatch[1].trim();
  const orderItems = orderPart.split(/\s*,\s*/);
  
  for (const item of orderItems) {
    const parts = item.trim().split(/\s+/);
    const column = parts[0];
    const direction = parts[1]?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    clauses.push({ column, direction });
  }
  
  return clauses;
}

export function extractGroupBy(sql: string): string[] {
  const groupByMatch = sql.match(/GROUP\s+BY\s+(.*?)(?:\s+(?:HAVING|ORDER|LIMIT|OFFSET)\s+|$)/i);
  if (!groupByMatch) return [];
  
  return groupByMatch[1].trim().split(/\s*,\s*/);
}
