import logger from './utils/logger.js';

export class SchemaDiff {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
  }

  compare(beforeSnapshot, afterSnapshot) {
    const diff = {
      tables: {
        added: [],
        removed: [],
        modified: []
      },
      columns: {},
      indexes: {},
      foreignKeys: {},
      summary: {
        totalChanges: 0,
        tablesAdded: 0,
        tablesRemoved: 0,
        tablesModified: 0,
        riskyChanges: []
      }
    };

    const beforeTables = new Set(Object.keys(beforeSnapshot.tables || {}));
    const afterTables = new Set(Object.keys(afterSnapshot.tables || {}));

    for (const table of afterTables) {
      if (!beforeTables.has(table)) {
        diff.tables.added.push({
          name: table,
          definition: afterSnapshot.tables[table]
        });
      }
    }

    for (const table of beforeTables) {
      if (!afterTables.has(table)) {
        diff.tables.removed.push({
          name: table,
          definition: beforeSnapshot.tables[table]
        });
        diff.summary.riskyChanges.push({
          type: 'table_removed',
          severity: 'high',
          table,
          message: `表 "${table}" 被删除`
        });
      }
    }

    for (const table of beforeTables) {
      if (afterTables.has(table)) {
        const tableDiff = this.compareTable(
          table,
          beforeSnapshot.tables[table],
          afterSnapshot.tables[table]
        );

        if (tableDiff.hasChanges) {
          diff.tables.modified.push({
            name: table,
            changes: tableDiff
          });
          diff.columns[table] = tableDiff.columns;
          
          if (tableDiff.hasRiskyChanges) {
            diff.summary.riskyChanges.push(...tableDiff.riskyChanges);
          }
        }
      }
    }

    const indexDiff = this.compareIndexes(beforeSnapshot, afterSnapshot);
    diff.indexes = indexDiff;

    const fkDiff = this.compareForeignKeys(beforeSnapshot, afterSnapshot);
    diff.foreignKeys = fkDiff;

    diff.summary.tablesAdded = diff.tables.added.length;
    diff.summary.tablesRemoved = diff.tables.removed.length;
    diff.summary.tablesModified = diff.tables.modified.length;
    diff.summary.totalChanges = 
      diff.summary.tablesAdded + 
      diff.summary.tablesRemoved + 
      diff.summary.tablesModified;

    return diff;
  }

  compareTable(tableName, beforeTable, afterTable) {
    const result = {
      hasChanges: false,
      hasRiskyChanges: false,
      riskyChanges: [],
      columns: {
        added: [],
        removed: [],
        modified: [],
        reordered: false
      },
      rowCountChange: {
        before: beforeTable.rowCount,
        after: afterTable.rowCount,
        delta: afterTable.rowCount - beforeTable.rowCount
      }
    };

    const beforeColumns = new Map(beforeTable.columns.map(c => [c.name, c]));
    const afterColumns = new Map(afterTable.columns.map(c => [c.name, c]));

    const beforeColumnNames = beforeTable.columns.map(c => c.name);
    const afterColumnNames = afterTable.columns.map(c => c.name);

    const beforeOrder = beforeColumnNames.join(',');
    const afterOrder = afterColumnNames.join(',');
    if (beforeOrder !== afterOrder) {
      result.columns.reordered = true;
      result.hasChanges = true;
    }

    for (const [name, col] of afterColumns) {
      if (!beforeColumns.has(name)) {
        result.columns.added.push({
          name,
          definition: col
        });
        result.hasChanges = true;
      }
    }

    for (const [name, col] of beforeColumns) {
      if (!afterColumns.has(name)) {
        result.columns.removed.push({
          name,
          definition: col
        });
        result.hasChanges = true;
        result.hasRiskyChanges = true;
        result.riskyChanges.push({
          type: 'column_removed',
          severity: 'high',
          table: tableName,
          column: name,
          message: `表 "${tableName}" 的字段 "${name}" 被删除`
        });
      }
    }

    for (const [name, beforeCol] of beforeColumns) {
      if (afterColumns.has(name)) {
        const afterCol = afterColumns.get(name);
        const columnDiff = this.compareColumn(tableName, name, beforeCol, afterCol);
        
        if (columnDiff.hasChanges) {
          result.columns.modified.push(columnDiff);
          result.hasChanges = true;
          
          if (columnDiff.hasRiskyChanges) {
            result.hasRiskyChanges = true;
            result.riskyChanges.push(...columnDiff.riskyChanges);
          }
        }
      }
    }

    return result;
  }

  compareColumn(tableName, columnName, beforeCol, afterCol) {
    const result = {
      name: columnName,
      hasChanges: false,
      hasRiskyChanges: false,
      riskyChanges: [],
      changes: {}
    };

    if (beforeCol.type.toLowerCase() !== afterCol.type.toLowerCase()) {
      result.changes.type = {
        before: beforeCol.type,
        after: afterCol.type
      };
      result.hasChanges = true;
      result.hasRiskyChanges = true;
      result.riskyChanges.push({
        type: 'column_type_changed',
        severity: 'high',
        table: tableName,
        column: columnName,
        before: beforeCol.type,
        after: afterCol.type,
        message: `表 "${tableName}" 字段 "${columnName}" 类型从 "${beforeCol.type}" 变更为 "${afterCol.type}"`
      });
    }

    if (beforeCol.notnull !== afterCol.notnull) {
      result.changes.notnull = {
        before: beforeCol.notnull,
        after: afterCol.notnull
      };
      result.hasChanges = true;
      
      if (afterCol.notnull && !beforeCol.notnull) {
        result.hasRiskyChanges = true;
        result.riskyChanges.push({
          type: 'notnull_added',
          severity: 'medium',
          table: tableName,
          column: columnName,
          message: `表 "${tableName}" 字段 "${columnName}" 新增 NOT NULL 约束`
        });
      }
    }

    if (beforeCol.defaultValue !== afterCol.defaultValue) {
      result.changes.defaultValue = {
        before: beforeCol.defaultValue,
        after: afterCol.defaultValue
      };
      result.hasChanges = true;
      
      result.riskyChanges.push({
        type: 'default_changed',
        severity: 'low',
        table: tableName,
        column: columnName,
        before: beforeCol.defaultValue,
        after: afterCol.defaultValue,
        message: `表 "${tableName}" 字段 "${columnName}" 默认值从 "${beforeCol.defaultValue}" 变更为 "${afterCol.defaultValue}"`
      });
    }

    if (beforeCol.pk !== afterCol.pk) {
      result.changes.pk = {
        before: beforeCol.pk,
        after: afterCol.pk
      };
      result.hasChanges = true;
      result.hasRiskyChanges = true;
      result.riskyChanges.push({
        type: 'pk_changed',
        severity: 'high',
        table: tableName,
        column: columnName,
        message: `表 "${tableName}" 字段 "${columnName}" 主键属性变更`
      });
    }

    return result;
  }

  compareIndexes(beforeSnapshot, afterSnapshot) {
    const result = {
      added: [],
      removed: [],
      modified: []
    };

    const beforeTables = Object.keys(beforeSnapshot.indexes || {});
    const afterTables = Object.keys(afterSnapshot.indexes || {});
    const allTables = new Set([...beforeTables, ...afterTables]);

    for (const table of allTables) {
      const beforeIndexes = (beforeSnapshot.indexes?.[table] || []).map(i => ({ ...i, table }));
      const afterIndexes = (afterSnapshot.indexes?.[table] || []).map(i => ({ ...i, table }));

      const beforeIndexMap = new Map(beforeIndexes.map(i => [i.name, i]));
      const afterIndexMap = new Map(afterIndexes.map(i => [i.name, i]));

      for (const [name, idx] of afterIndexMap) {
        if (!beforeIndexMap.has(name)) {
          result.added.push(idx);
        } else {
          const beforeIdx = beforeIndexMap.get(name);
          if (JSON.stringify(beforeIdx) !== JSON.stringify(idx)) {
            result.modified.push({
              table,
              name,
              before: beforeIdx,
              after: idx
            });
          }
        }
      }

      for (const [name, idx] of beforeIndexMap) {
        if (!afterIndexMap.has(name)) {
          result.removed.push(idx);
        }
      }
    }

    return result;
  }

  compareForeignKeys(beforeSnapshot, afterSnapshot) {
    const result = {
      added: [],
      removed: [],
      modified: []
    };

    const beforeTables = Object.keys(beforeSnapshot.foreignKeys || {});
    const afterTables = Object.keys(afterSnapshot.foreignKeys || {});
    const allTables = new Set([...beforeTables, ...afterTables]);

    for (const table of allTables) {
      const beforeFKs = (beforeSnapshot.foreignKeys?.[table] || []).map(fk => ({ ...fk, fromTable: table }));
      const afterFKs = (afterSnapshot.foreignKeys?.[table] || []).map(fk => ({ ...fk, fromTable: table }));

      const beforeFKMap = new Map(beforeFKs.map(fk => [`${fk.table}_${fk.from}_${fk.to}`, fk]));
      const afterFKMap = new Map(afterFKs.map(fk => [`${fk.table}_${fk.from}_${fk.to}`, fk]));

      for (const [key, fk] of afterFKMap) {
        if (!beforeFKMap.has(key)) {
          result.added.push(fk);
        }
      }

      for (const [key, fk] of beforeFKMap) {
        if (!afterFKMap.has(key)) {
          result.removed.push(fk);
        }
      }
    }

    return result;
  }

  isRiskyChange(diff) {
    return diff.summary?.riskyChanges?.length > 0;
  }

  getRiskLevel(diff) {
    const riskyChanges = diff.summary?.riskyChanges || [];
    
    if (riskyChanges.length === 0) {
      return 'safe';
    }

    const hasHighRisk = riskyChanges.some(c => c.severity === 'high');
    const hasMediumRisk = riskyChanges.some(c => c.severity === 'medium');

    if (hasHighRisk) {
      return 'high';
    } else if (hasMediumRisk) {
      return 'medium';
    }

    return 'low';
  }
}

export default SchemaDiff;
