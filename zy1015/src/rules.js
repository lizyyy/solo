function checkAllRules(migrationsData, executionResults, schemaChanges) {
  const issues = [];

  issues.push(...checkDestructiveOperations(migrationsData));
  issues.push(...checkUnsafeDML(migrationsData));
  issues.push(...checkDuplicateIndexes(migrationsData));
  issues.push(...checkExecutionErrors(executionResults));

  return issues;
}

function checkDestructiveOperations(migrationsData) {
  const issues = [];
  const { orderedFiles } = migrationsData;

  if (!orderedFiles) return issues;

  const destructivePatterns = [
    {
      name: 'DROP COLUMN',
      pattern: /\bALTER\s+TABLE\s+["`']?([a-zA-Z_][a-zA-Z0-9_]*)["`']?\s+DROP\s+(?:COLUMN\s+)?["`']?([a-zA-Z_][a-zA-Z0-9_]*)["`']?/i,
      severity: 'high',
      message: '检测到 DROP COLUMN 操作',
      suggestion: 'DROP COLUMN 会永久删除列数据。请确认这是预期行为，考虑先将列标记为废弃而非立即删除。'
    },
    {
      name: 'DROP TABLE',
      pattern: /\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["`']?([a-zA-Z_][a-zA-Z0-9_]*)["`']?/i,
      severity: 'critical',
      message: '检测到 DROP TABLE 操作',
      suggestion: 'DROP TABLE 会永久删除表和数据。请确认这是预期行为，考虑使用重命名或软删除替代。'
    },
    {
      name: 'DROP INDEX',
      pattern: /\bDROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?["`']?([a-zA-Z_][a-zA-Z0-9_]*)["`']?/i,
      severity: 'low',
      message: '检测到 DROP INDEX 操作',
      suggestion: '删除索引可能影响查询性能。请确认该索引不再需要。'
    },
    {
      name: 'TRUNCATE',
      pattern: /\bTRUNCATE\s+(?:TABLE\s+)?["`']?([a-zA-Z_][a-zA-Z0-9_]*)["`']?/i,
      severity: 'critical',
      message: '检测到 TRUNCATE 操作',
      suggestion: 'TRUNCATE 会清空表中所有数据。SQLite 不支持 TRUNCATE，但此语句在其他数据库中非常危险。'
    }
  ];

  for (const migration of orderedFiles) {
    for (const stmt of migration.statements) {
      for (const rule of destructivePatterns) {
        const match = stmt.match(rule.pattern);
        if (match) {
          const tableName = match[1] || 'unknown';
          const columnName = match[2] || '';
          
          issues.push({
            type: 'destructive_operation',
            severity: rule.severity,
            migration: migration.filename,
            statement: truncateStatement(stmt),
            operation: rule.name,
            table: tableName,
            column: columnName || undefined,
            message: `${rule.message}（表: ${tableName}${columnName ? ', 列: ' + columnName : ''}）`,
            suggestion: rule.suggestion
          });
        }
      }
    }
  }

  return issues;
}

function checkUnsafeDML(migrationsData) {
  const issues = [];
  const { orderedFiles } = migrationsData;

  if (!orderedFiles) return issues;

  const dmlPatterns = [
    {
      name: 'DELETE',
      pattern: /^\s*(?:WITH\s+[\s\S]*?\s+)?DELETE\s+(?:FROM\s+)?["`']?([a-zA-Z_][a-zA-Z0-9_]*)["`']?/i,
      severity: 'critical',
      message: '检测到 DELETE 语句',
      suggestion: 'DELETE 语句可能删除数据。请确保有 WHERE 子句限制删除范围。'
    },
    {
      name: 'UPDATE',
      pattern: /^\s*(?:WITH\s+[\s\S]*?\s+)?UPDATE\s+["`']?([a-zA-Z_][a-zA-Z0-9_]*)["`']?/i,
      severity: 'high',
      message: '检测到 UPDATE 语句',
      suggestion: 'UPDATE 语句可能修改数据。请确保有 WHERE 子句限制更新范围。'
    }
  ];

  for (const migration of orderedFiles) {
    for (const stmt of migration.statements) {
      for (const rule of dmlPatterns) {
        const match = stmt.match(rule.pattern);
        if (match) {
          const tableName = match[1] || 'unknown';
          
          const hasWhere = /\bWHERE\b/i.test(stmt);
          const hasLimit = /\bLIMIT\s+\d+/i.test(stmt);
          
          if (!hasWhere) {
            issues.push({
              type: 'unsafe_dml',
              severity: rule.severity,
              migration: migration.filename,
              statement: truncateStatement(stmt),
              operation: rule.name,
              table: tableName,
              message: `${rule.message} 缺少 WHERE 子句！（表: ${tableName}）`,
              suggestion: `此 ${rule.name} 语句没有 WHERE 子句，会影响表中所有行！${rule.suggestion}`
            });
          } else {
            issues.push({
              type: 'dml_operation',
              severity: 'info',
              migration: migration.filename,
              statement: truncateStatement(stmt),
              operation: rule.name,
              table: tableName,
              message: `检测到 ${rule.name} 操作（表: ${tableName}）`,
              suggestion: hasLimit 
                ? `已检测到 WHERE 子句${hasLimit ? '和 LIMIT' : ''}，但请仔细检查条件是否正确。`
                : '已检测到 WHERE 子句，但请仔细检查条件是否正确，建议添加 LIMIT 限制影响行数。'
            });
          }
        }
      }
    }
  }

  return issues;
}

function checkDuplicateIndexes(migrationsData) {
  const issues = [];
  const { orderedFiles } = migrationsData;

  if (!orderedFiles) return issues;

  const allIndexes = [];

  const createIndexPattern = /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["`']?([a-zA-Z_][a-zA-Z0-9_]*)["`']?\s+ON\s+["`']?([a-zA-Z_][a-zA-Z0-9_]*)["`']?\s*\(([^)]+)\)/i;

  for (const migration of orderedFiles) {
    for (const stmt of migration.statements) {
      const match = stmt.match(createIndexPattern);
      if (match) {
        const indexName = match[1];
        const tableName = match[2];
        const columns = match[3].split(',').map(c => c.trim().toLowerCase()).sort().join(', ');

        const existing = allIndexes.find(i => 
          i.tableName.toLowerCase() === tableName.toLowerCase() && 
          i.columns === columns
        );

        if (existing) {
          issues.push({
            type: 'duplicate_index',
            severity: 'warning',
            migration: migration.filename,
            statement: truncateStatement(stmt),
            indexName: indexName,
            tableName: tableName,
            columns: columns,
            existingIndex: existing.indexName,
            existingMigration: existing.migration,
            message: `检测到疑似重复索引 "${indexName}" 在表 "${tableName}" 上，列: (${columns})`,
            suggestion: `此索引与迁移 "${existing.migration}" 中的 "${existing.indexName}" 索引覆盖相同列。请确认是否需要，重复索引会增加写入开销。`
          });
        }

        const sameName = allIndexes.find(i => 
          i.indexName.toLowerCase() === indexName.toLowerCase()
        );

        if (sameName) {
          issues.push({
            type: 'duplicate_index_name',
            severity: 'error',
            migration: migration.filename,
            statement: truncateStatement(stmt),
            indexName: indexName,
            existingMigration: sameName.migration,
            message: `索引名 "${indexName}" 重复定义`,
            suggestion: `索引名必须唯一。此名称已在迁移 "${sameName.migration}" 中使用，请重命名。`
          });
        }

        allIndexes.push({
          indexName,
          tableName,
          columns,
          migration: migration.filename,
          statement: stmt
        });
      }
    }
  }

  return issues;
}

function checkExecutionErrors(executionResults) {
  const issues = [];

  if (!executionResults || !executionResults.results) return issues;

  for (const result of executionResults.results) {
    if (result.skipped) {
      issues.push({
        type: 'migration_skipped',
        severity: 'warning',
        migration: result.migration,
        message: `迁移 "${result.migration}" 被跳过`,
        suggestion: result.reason || '由于之前的错误被跳过'
      });
      continue;
    }

    if (!result.success) {
      for (const stmtResult of result.statements) {
        if (!stmtResult.success) {
          issues.push({
            type: 'execution_error',
            severity: 'error',
            migration: result.migration,
            statement: truncateStatement(stmtResult.statement),
            error: stmtResult.error,
            message: `迁移 "${result.migration}" 执行失败`,
            suggestion: `SQL 错误: ${stmtResult.error}。请检查语法和依赖关系。`
          });
        }
      }
    }
  }

  return issues;
}

function truncateStatement(stmt, maxLength = 200) {
  if (!stmt) return '';
  const cleaned = stmt.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength - 3) + '...';
}

function groupIssuesBySeverity(issues) {
  const groups = {
    critical: [],
    error: [],
    high: [],
    warning: [],
    low: [],
    info: []
  };

  for (const issue of issues) {
    const severity = issue.severity || 'info';
    if (groups[severity]) {
      groups[severity].push(issue);
    } else {
      groups.info.push(issue);
    }
  }

  return groups;
}

function getSeverityOrder() {
  return ['critical', 'error', 'high', 'warning', 'low', 'info'];
}

function getSeverityLabel(severity) {
  const labels = {
    critical: '严重',
    error: '错误',
    high: '高风险',
    warning: '警告',
    low: '低风险',
    info: '信息'
  };
  return labels[severity] || severity;
}

module.exports = {
  checkAllRules,
  checkDestructiveOperations,
  checkUnsafeDML,
  checkDuplicateIndexes,
  checkExecutionErrors,
  groupIssuesBySeverity,
  getSeverityOrder,
  getSeverityLabel
};
