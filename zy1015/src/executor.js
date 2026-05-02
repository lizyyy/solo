const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let SqlJs = null;

async function initSqlJsModule() {
  if (!SqlJs) {
    SqlJs = await initSqlJs();
  }
  return SqlJs;
}

async function createTemporaryDatabase() {
  const SQL = await initSqlJsModule();
  const db = new SQL.Database();

  return {
    db,
    dbPath: ':memory:',
    tempDir: null,
    cleanup: () => {
      db.close();
    }
  };
}

function executeSchema(db, schemaStatements) {
  const results = [];

  for (const stmt of schemaStatements) {
    try {
      db.run(stmt);
      results.push({
        success: true,
        statement: stmt,
        error: null
      });
    } catch (e) {
      results.push({
        success: false,
        statement: stmt,
        error: e.message
      });
    }
  }

  return {
    success: results.every(r => r.success),
    results
  };
}

function executeMigrations(db, orderedMigrations, stopOnError = true) {
  const executionResults = [];
  let hasFailed = false;

  for (const migration of orderedMigrations) {
    if (hasFailed && stopOnError) {
      executionResults.push({
        migration: migration.filename,
        skipped: true,
        reason: '之前的迁移执行失败'
      });
      continue;
    }

    const migrationResult = {
      migration: migration.filename,
      statements: [],
      success: true
    };

    for (const stmt of migration.statements) {
      try {
        db.run(stmt);
        migrationResult.statements.push({
          success: true,
          statement: stmt,
          error: null
        });
      } catch (e) {
        migrationResult.statements.push({
          success: false,
          statement: stmt,
          error: e.message
        });
        migrationResult.success = false;
        hasFailed = true;

        if (stopOnError) {
          break;
        }
      }
    }

    executionResults.push(migrationResult);
  }

  return {
    success: executionResults.every(r => r.success || r.skipped),
    results: executionResults
  };
}

function getDatabaseSchema(db) {
  const tablesResult = db.exec(`
    SELECT name, sql 
    FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);

  const tables = tablesResult.length > 0 ? 
    tablesResult[0].values.map(row => ({ 
      name: row[0], 
      sql: row[1] 
    })) : [];

  const tableInfo = {};
  for (const table of tables) {
    const columnsResult = db.exec(`PRAGMA table_info(${table.name})`);
    const columns = columnsResult.length > 0 ? 
      columnsResult[0].values.map(row => ({
        cid: row[0],
        name: row[1],
        type: row[2],
        notnull: row[3] !== 0,
        dfltValue: row[4],
        pk: row[5] !== 0
      })) : [];

    const indexesResult = db.exec(`
      SELECT name, sql 
      FROM sqlite_master 
      WHERE type='index' AND tbl_name = ? AND name NOT LIKE 'sqlite_%'
    `.replace('?', `'${table.name}'`));
    
    const indexes = indexesResult.length > 0 ? 
      indexesResult[0].values.map(row => ({
        name: row[0],
        sql: row[1]
      })) : [];

    const foreignKeysResult = db.exec(`PRAGMA foreign_key_list(${table.name})`);
    const foreignKeys = foreignKeysResult.length > 0 ? 
      foreignKeysResult[0].values.map(row => ({
        id: row[0],
        seq: row[1],
        table: row[2],
        from: row[3],
        to: row[4],
        onUpdate: row[5],
        onDelete: row[6]
      })) : [];

    tableInfo[table.name] = {
      name: table.name,
      sql: table.sql,
      columns,
      indexes,
      foreignKeys
    };
  }

  return {
    tables: tableInfo,
    tableNames: Object.keys(tableInfo).sort()
  };
}

function compareSchemas(before, after) {
  const changes = {
    addedTables: [],
    removedTables: [],
    modifiedTables: {},
    unchangedTables: []
  };

  const beforeTables = before.tableNames || [];
  const afterTables = after.tableNames || [];

  for (const table of afterTables) {
    if (!beforeTables.includes(table)) {
      changes.addedTables.push(table);
    }
  }

  for (const table of beforeTables) {
    if (!afterTables.includes(table)) {
      changes.removedTables.push(table);
    }
  }

  for (const table of afterTables) {
    if (!beforeTables.includes(table)) continue;

    const beforeInfo = before.tables[table];
    const afterInfo = after.tables[table];

    const tableChanges = compareTableInfo(beforeInfo, afterInfo);

    if (tableChanges.hasChanges) {
      changes.modifiedTables[table] = tableChanges;
    } else {
      changes.unchangedTables.push(table);
    }
  }

  changes.hasChanges = 
    changes.addedTables.length > 0 || 
    changes.removedTables.length > 0 || 
    Object.keys(changes.modifiedTables).length > 0;

  return changes;
}

function compareTableInfo(before, after) {
  const changes = {
    hasChanges: false,
    addedColumns: [],
    removedColumns: [],
    modifiedColumns: {},
    addedIndexes: [],
    removedIndexes: [],
    modifiedIndexes: {}
  };

  const beforeCols = before.columns.map(c => c.name);
  const afterCols = after.columns.map(c => c.name);

  for (const col of afterCols) {
    if (!beforeCols.includes(col)) {
      const colInfo = after.columns.find(c => c.name === col);
      changes.addedColumns.push(colInfo);
    }
  }

  for (const col of beforeCols) {
    if (!afterCols.includes(col)) {
      const colInfo = before.columns.find(c => c.name === col);
      changes.removedColumns.push(colInfo);
    }
  }

  for (const col of afterCols) {
    if (!beforeCols.includes(col)) continue;

    const beforeCol = before.columns.find(c => c.name === col);
    const afterCol = after.columns.find(c => c.name === col);

    const colChanges = compareColumnInfo(beforeCol, afterCol);
    if (colChanges.hasChanges) {
      changes.modifiedColumns[col] = colChanges;
    }
  }

  const beforeIdxNames = before.indexes.map(i => i.name);
  const afterIdxNames = after.indexes.map(i => i.name);

  for (const idx of afterIdxNames) {
    if (!beforeIdxNames.includes(idx)) {
      const idxInfo = after.indexes.find(i => i.name === idx);
      changes.addedIndexes.push(idxInfo);
    }
  }

  for (const idx of beforeIdxNames) {
    if (!afterIdxNames.includes(idx)) {
      const idxInfo = before.indexes.find(i => i.name === idx);
      changes.removedIndexes.push(idxInfo);
    }
  }

  for (const idx of afterIdxNames) {
    if (!beforeIdxNames.includes(idx)) continue;

    const beforeIdx = before.indexes.find(i => i.name === idx);
    const afterIdx = after.indexes.find(i => i.name === idx);

    if (beforeIdx.sql !== afterIdx.sql) {
      changes.modifiedIndexes[idx] = {
        before: beforeIdx.sql,
        after: afterIdx.sql
      };
    }
  }

  changes.hasChanges = 
    changes.addedColumns.length > 0 || 
    changes.removedColumns.length > 0 || 
    Object.keys(changes.modifiedColumns).length > 0 ||
    changes.addedIndexes.length > 0 || 
    changes.removedIndexes.length > 0 || 
    Object.keys(changes.modifiedIndexes).length > 0;

  return changes;
}

function compareColumnInfo(before, after) {
  const changes = { hasChanges: false, changes: [] };

  if (before.type !== after.type) {
    changes.changes.push({
      property: 'type',
      before: before.type,
      after: after.type
    });
  }

  if (before.notnull !== after.notnull) {
    changes.changes.push({
      property: 'notnull',
      before: before.notnull,
      after: after.notnull
    });
  }

  if (before.dfltValue !== after.dfltValue) {
    changes.changes.push({
      property: 'dfltValue',
      before: before.dfltValue,
      after: after.dfltValue
    });
  }

  if (before.pk !== after.pk) {
    changes.changes.push({
      property: 'pk',
      before: before.pk,
      after: after.pk
    });
  }

  changes.hasChanges = changes.changes.length > 0;
  return changes;
}

module.exports = {
  createTemporaryDatabase,
  executeSchema,
  executeMigrations,
  getDatabaseSchema,
  compareSchemas
};
