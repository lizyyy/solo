const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

class HealthChecker {
  static async getDatabaseState(dbPath) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath);
      const state = {
        tables: [],
        indices: [],
        foreign_keys_enabled: false,
        table_details: {}
      };
      
      db.get('PRAGMA foreign_keys;', (err, row) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }
        state.foreign_keys_enabled = row && row.foreign_keys === 1;
      });
      
      db.all(`
        SELECT name, type FROM sqlite_master 
        WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `, (err, tables) => {
        if (err) {
          db.close();
          reject(err);
          return;
        }
        
        state.tables = tables.filter(t => t.type === 'table').map(t => t.name);
        
        let tablesProcessed = 0;
        if (tables.length === 0) {
          db.close();
          resolve(state);
          return;
        }
        
        tables.filter(t => t.type === 'table').forEach(table => {
          db.all(`PRAGMA table_info(${table.name})`, (err, columns) => {
            if (err) {
              console.error(`Error getting table info for ${table.name}:`, err);
            }
            
            state.table_details[table.name] = {
              columns: columns || [],
              row_count: 0
            };
            
            db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, countResult) => {
              if (!err && countResult) {
                state.table_details[table.name].row_count = countResult.count;
              }
              
              db.all(`PRAGMA foreign_key_list(${table.name})`, (err, fks) => {
                if (!err && fks) {
                  state.table_details[table.name].foreign_keys = fks;
                }
                
                db.all(`PRAGMA index_list(${table.name})`, (err, indices) => {
                  if (!err && indices) {
                    state.table_details[table.name].indices = indices;
                  }
                  
                  tablesProcessed++;
                  if (tablesProcessed >= state.tables.length) {
                    db.close();
                    resolve(state);
                  }
                });
              });
            });
          });
        });
      });
    });
  }

  static async checkForeignKeys(dbPath) {
    const issues = [];
    
    const state = await this.getDatabaseState(dbPath);
    
    if (!state.foreign_keys_enabled) {
      issues.push({
        severity: 'high',
        type: 'foreign_keys_disabled',
        message: 'Foreign key constraints are not enabled',
        detail: 'Use PRAGMA foreign_keys = ON; to enable foreign key constraints',
        suggestion: 'Always execute PRAGMA foreign_keys = ON; at the start of database connections'
      });
    }
    
    for (const tableName of state.tables) {
      const table = state.table_details[tableName];
      
      if (table.foreign_keys && table.foreign_keys.length > 0) {
        for (const fk of table.foreign_keys) {
          const fkColumn = table.columns.find(c => c.cid === fk.id);
          const fkColumnInfo = table.columns.find(c => c.name === fk.from);
          
          if (fkColumnInfo && !fkColumnInfo.notnull) {
            issues.push({
              severity: 'medium',
              type: 'nullable_foreign_key',
              table: tableName,
              column: fk.from,
              references_table: fk.table,
              references_column: fk.to,
              message: `Foreign key column ${tableName}.${fk.from} is nullable`,
              detail: 'Nullable foreign keys can lead to orphan relationships',
              suggestion: 'Consider adding NOT NULL constraint if the relationship is required'
            });
          }
          
          const hasIndex = table.indices && table.indices.some(idx => {
            const idxColumns = idx.columns || [];
            return idx.origin === 'c' || idx.name.toLowerCase().includes('fk');
          });
        }
      }
    }
    
    const db = new sqlite3.Database(dbPath);
    const fkViolations = await new Promise((resolve) => {
      db.all('PRAGMA foreign_key_check;', (err, rows) => {
        db.close();
        if (err) resolve([]);
        else resolve(rows || []);
      });
    });
    
    for (const violation of fkViolations) {
      issues.push({
        severity: 'critical',
        type: 'foreign_key_violation',
        table: violation.table,
        rowid: violation.rowid,
        message: `Foreign key violation in table ${violation.table}`,
        detail: `Row ${violation.rowid} references non-existent row in ${violation.parent}`,
        suggestion: 'Fix or remove the violating row before applying migrations'
      });
    }
    
    return {
      valid: issues.every(i => i.severity !== 'critical' && i.severity !== 'high'),
      issues
    };
  }

  static async checkIndices(dbPath) {
    const state = await this.getDatabaseState(dbPath);
    const issues = [];
    
    for (const tableName of state.tables) {
      const table = state.table_details[tableName];
      
      const primaryKeys = table.columns.filter(c => c.pk > 0);
      if (primaryKeys.length === 0 && !table.indices?.some(i => i.unique)) {
        issues.push({
          severity: 'medium',
          type: 'no_primary_key',
          table: tableName,
          message: `Table ${tableName} has no primary key`,
          detail: 'Tables without primary keys can be inefficient to query',
          suggestion: 'Add a primary key to the table'
        });
      }
      
      if (table.foreign_keys) {
        for (const fk of table.foreign_keys) {
          const hasIndex = table.indices?.some(idx => {
            return idx.name.toLowerCase().includes(fk.from.toLowerCase()) ||
                   idx.name.toLowerCase().includes('fk');
          });
          
          if (!hasIndex && table.row_count > 100) {
            issues.push({
              severity: 'low',
              type: 'missing_fk_index',
              table: tableName,
              column: fk.from,
              references_table: fk.table,
              message: `Foreign key column ${tableName}.${fk.from} may benefit from an index`,
              detail: `Table has ${table.row_count} rows, joins could be slow`,
              suggestion: `Consider creating an index on ${tableName}(${fk.from})`
            });
          }
        }
      }
      
      const uniqueIndices = table.indices?.filter(i => i.unique) || [];
      const uniqueColumns = uniqueIndices.map(idx => idx.name);
    }
    
    return {
      valid: true,
      issues
    };
  }

  static async checkConstraints(dbPath, beforeState = null) {
    const state = await this.getDatabaseState(dbPath);
    const issues = [];
    
    for (const tableName of state.tables) {
      const table = state.table_details[tableName];
      const beforeTable = beforeState?.table_details?.[tableName];
      
      for (const column of table.columns) {
        const beforeColumn = beforeTable?.columns?.find(c => c.name === column.name);
        
        if (column.notnull && !beforeColumn?.notnull) {
          if (table.row_count > 0) {
            const db = new sqlite3.Database(dbPath);
            const nullCount = await new Promise((resolve) => {
              db.get(
                `SELECT COUNT(*) as count FROM ${tableName} WHERE ${column.name} IS NULL`,
                (err, row) => {
                  db.close();
                  resolve(err ? 0 : row?.count || 0);
                }
              );
            });
            
            if (nullCount > 0) {
              issues.push({
                severity: 'critical',
                type: 'not_null_violation',
                table: tableName,
                column: column.name,
                null_count: nullCount,
                message: `Adding NOT NULL constraint to ${tableName}.${column.name} would fail`,
                detail: `${nullCount} rows have NULL values in this column`,
                suggestion: 'Provide a default value or update NULL values before adding NOT NULL'
              });
            }
          }
        }
        
        if (column.dflt_value && !beforeColumn?.dflt_value) {
          if (table.row_count > 0) {
            issues.push({
              severity: 'medium',
              type: 'default_value_added',
              table: tableName,
              column: column.name,
              default_value: column.dflt_value,
              message: `Default value ${column.dflt_value} added to ${tableName}.${column.name}`,
              detail: 'Existing rows will not be updated with the default value in SQLite',
              suggestion: 'Consider updating existing rows if necessary'
            });
          }
        }
      }
    }
    
    return {
      valid: issues.every(i => i.severity !== 'critical'),
      issues
    };
  }

  static async checkDataCompatibility(dbPath, beforeState) {
    if (!beforeState) {
      return { valid: true, issues: [] };
    }
    
    const afterState = await this.getDatabaseState(dbPath);
    const issues = [];
    
    for (const tableName of afterState.tables) {
      const afterTable = afterState.table_details[tableName];
      const beforeTable = beforeState.table_details[tableName];
      
      if (!beforeTable) continue;
      
      for (const afterCol of afterTable.columns) {
        const beforeCol = beforeTable.columns.find(c => c.name === afterCol.name);
        
        if (afterCol.notnull && beforeCol && !beforeCol.notnull) {
          const db = new sqlite3.Database(dbPath);
          const nullCount = await new Promise((resolve) => {
            db.get(
              `SELECT COUNT(*) as count FROM ${tableName} WHERE ${afterCol.name} IS NULL`,
              (err, row) => {
                db.close();
                resolve(err ? 0 : row?.count || 0);
              }
            );
          });
          
          if (nullCount > 0) {
            const sampleData = await this.getSampleData(dbPath, tableName, afterCol.name, nullCount);
            issues.push({
              severity: 'high',
              type: 'not_null_data_conflict',
              table: tableName,
              column: afterCol.name,
              null_count: nullCount,
              sample_rows: sampleData,
              message: `${nullCount} rows have NULL in ${tableName}.${afterCol.name}`,
              detail: 'These rows violate the new NOT NULL constraint',
              suggestion: 'Provide default values or fix the data'
            });
          }
        }
      }
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }

  static async getSampleData(dbPath, tableName, columnName, count) {
    const db = new sqlite3.Database(dbPath);
    
    return new Promise((resolve) => {
      db.all(
        `SELECT rowid, ${columnName} FROM ${tableName} WHERE ${columnName} IS NULL LIMIT 5`,
        (err, rows) => {
          db.close();
          if (err) resolve([]);
          else resolve(rows || []);
        }
      );
    });
  }

  static async checkAll(dbPath, beforeState = null) {
    const warnings = [];
    
    const fkCheck = await this.checkForeignKeys(dbPath);
    warnings.push(...fkCheck.issues);
    
    const idxCheck = await this.checkIndices(dbPath);
    warnings.push(...idxCheck.issues);
    
    const constCheck = await this.checkConstraints(dbPath, beforeState);
    warnings.push(...constCheck.issues);
    
    const criticalIssues = warnings.filter(i => i.severity === 'critical');
    const highIssues = warnings.filter(i => i.severity === 'high');
    
    return {
      valid: criticalIssues.length === 0 && highIssues.length === 0,
      critical_count: criticalIssues.length,
      high_count: highIssues.length,
      medium_count: warnings.filter(i => i.severity === 'medium').length,
      low_count: warnings.filter(i => i.severity === 'low').length,
      warnings
    };
  }

  static analyzeMigrationChanges(beforeState, afterState) {
    const changes = {
      tables_added: [],
      tables_removed: [],
      tables_modified: [],
      columns_added: [],
      columns_removed: [],
      columns_modified: [],
      indices_added: [],
      indices_removed: [],
      foreign_keys_added: [],
      foreign_keys_removed: []
    };
    
    const beforeTables = new Set(beforeState.tables);
    const afterTables = new Set(afterState.tables);
    
    changes.tables_added = afterState.tables.filter(t => !beforeTables.has(t));
    changes.tables_removed = beforeState.tables.filter(t => !afterTables.has(t));
    
    for (const tableName of afterState.tables) {
      if (!beforeTables.has(tableName)) continue;
      
      const beforeTable = beforeState.table_details[tableName];
      const afterTable = afterState.table_details[tableName];
      
      const beforeCols = new Set(beforeTable.columns.map(c => c.name));
      const afterCols = new Set(afterTable.columns.map(c => c.name));
      
      const newCols = afterTable.columns.filter(c => !beforeCols.has(c.name));
      const removedCols = beforeTable.columns.filter(c => !afterCols.has(c.name));
      
      if (newCols.length > 0 || removedCols.length > 0) {
        changes.tables_modified.push(tableName);
        
        for (const col of newCols) {
          changes.columns_added.push({
            table: tableName,
            column: col.name,
            type: col.type,
            not_null: col.notnull,
            default: col.dflt_value
          });
        }
        
        for (const col of removedCols) {
          changes.columns_removed.push({
            table: tableName,
            column: col.name
          });
        }
      }
    }
    
    return changes;
  }
}

module.exports = HealthChecker;
