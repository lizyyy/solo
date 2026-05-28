export function toCamelCase<T = any>(obj: Record<string, any>): T {
  if (!obj || typeof obj !== 'object') {
    return obj as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCase(item)) as unknown as T;
  }
  
  const result: Record<string, any> = {};
  
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = toCamelCase(obj[key]);
  }
  
  return result as T;
}

export function toSnakeCase(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => toSnakeCase(item));
  }
  
  const result: Record<string, any> = {};
  
  for (const key of Object.keys(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    result[snakeKey] = toSnakeCase(obj[key]);
  }
  
  return result;
}

export function buildWhereClause(filters?: Record<string, any>): {
  clause: string;
  params: Record<string, any>;
} {
  if (!filters || Object.keys(filters).length === 0) {
    return { clause: '', params: {} };
  }
  
  const conditions: string[] = [];
  const params: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) {
      continue;
    }
    
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    
    if (typeof value === 'string' && value.includes('%')) {
      conditions.push(`${snakeKey} LIKE @${key}`);
    } else if (Array.isArray(value)) {
      const placeholders = value.map((_, i) => `@${key}_${i}`).join(', ');
      conditions.push(`${snakeKey} IN (${placeholders})`);
      value.forEach((v, i) => {
        params[`${key}_${i}`] = v;
      });
      continue;
    } else {
      conditions.push(`${snakeKey} = @${key}`);
    }
    
    params[key] = value;
  }
  
  const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return { clause, params };
}

export function buildSelectAllSql(tableName: string, whereClause: string, orderBy = 'created_at DESC'): string {
  return `SELECT * FROM ${tableName} ${whereClause} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`;
}

export function buildCountSql(tableName: string, whereClause: string): string {
  return `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`;
}

export function buildUpdateSql(
  tableName: string,
  fields: string[],
  idField = 'id'
): string {
  const setClauses = fields.map(field => {
    const snakeField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
    return `${snakeField} = COALESCE(@${field}, ${snakeField})`;
  });
  setClauses.push('updated_at = @updatedAt');
  
  return `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE ${idField} = @id`;
}

export function buildInsertSql(
  tableName: string,
  fields: string[]
): string {
  const snakeFields = fields.map(field => field.replace(/([A-Z])/g, '_$1').toLowerCase());
  const placeholders = fields.map(field => `@${field}`);
  
  return `INSERT INTO ${tableName} (${snakeFields.join(', ')}) VALUES (${placeholders.join(', ')})`;
}
