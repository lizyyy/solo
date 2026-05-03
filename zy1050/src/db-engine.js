import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import logger from './utils/logger.js';

export class DbEngine {
  constructor(options = {}) {
    this.inMemory = options.inMemory !== false;
    this.tempDir = options.tempDir || os.tmpdir();
    this.dbPath = null;
    this.db = null;
    this.verbose = options.verbose || false;
  }

  init() {
    if (this.inMemory) {
      logger.debug('创建内存数据库');
      this.db = new Database(':memory:');
    } else {
      this.dbPath = path.join(this.tempDir, `migration_check_${Date.now()}.db`);
      logger.debug(`创建临时数据库: ${this.dbPath}`);
      this.db = new Database(this.dbPath);
    }

    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    return this;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.debug('数据库连接已关闭');
    }

    if (this.dbPath && fs.existsSync(this.dbPath)) {
      try {
        fs.unlinkSync(this.dbPath);
        const walPath = this.dbPath + '-wal';
        const shmPath = this.dbPath + '-shm';
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
        logger.debug(`临时数据库文件已删除: ${this.dbPath}`);
      } catch (e) {
        logger.warn(`清理临时数据库文件失败: ${e.message}`);
      }
    }
  }

  execute(sql, params = []) {
    try {
      logger.debug(`执行SQL: ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`);
      return this.db.exec(sql);
    } catch (error) {
      throw new Error(`SQL执行失败: ${error.message}\nSQL: ${sql}`);
    }
  }

  query(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      return params.length > 0 ? stmt.all(params) : stmt.all();
    } catch (error) {
      throw new Error(`SQL查询失败: ${error.message}\nSQL: ${sql}`);
    }
  }

  executeMigration(version, sqlContent, migrationName) {
    const result = {
      success: false,
      version,
      name: migrationName,
      error: null,
      executionTime: 0
    };

    const startTime = Date.now();

    try {
      const statements = this.splitStatements(sqlContent);
      
      for (const stmt of statements) {
        const cleanStmt = this.removeSqlComments(stmt);
        const trimmedStmt = cleanStmt.trim();
        if (trimmedStmt) {
          this.execute(trimmedStmt);
        }
      }

      result.success = true;
      result.executionTime = Date.now() - startTime;
      logger.success(`迁移 v${version} 执行成功 (${result.executionTime}ms)`);
    } catch (error) {
      result.error = {
        message: error.message,
        sql: sqlContent
      };
      result.executionTime = Date.now() - startTime;
      logger.error(`迁移 v${version} 执行失败: ${error.message}`);
    }

    return result;
  }

  removeSqlComments(sql) {
    let result = sql;
    
    result = result.replace(/--.*$/gm, '');
    
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    
    return result;
  }

  executeRollback(version, sqlContent, rollbackName) {
    return this.executeMigration(version, sqlContent, rollbackName);
  }

  splitStatements(sqlContent) {
    const statements = [];
    let current = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < sqlContent.length; i++) {
      const char = sqlContent[i];

      if ((char === "'" || char === '"') && (i === 0 || sqlContent[i - 1] !== '\\')) {
        if (inString && char === stringChar) {
          inString = false;
          stringChar = '';
        } else if (!inString) {
          inString = true;
          stringChar = char;
        }
      }

      if (char === ';' && !inString) {
        if (current.trim()) {
          statements.push(current.trim());
        }
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      statements.push(current.trim());
    }

    return statements;
  }

  getSchemaSnapshot() {
    const snapshot = {
      tables: {},
      indexes: {},
      foreignKeys: {},
      views: {},
      triggers: {}
    };

    const tables = this.query(`
      SELECT name, sql 
      FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    for (const table of tables) {
      const tableInfo = this.query(`PRAGMA table_info("${table.name}")`);
      const indexList = this.query(`PRAGMA index_list("${table.name}")`);
      const foreignKeyList = this.query(`PRAGMA foreign_key_list("${table.name}")`);

      snapshot.tables[table.name] = {
        name: table.name,
        sql: table.sql,
        columns: tableInfo.map(col => ({
          cid: col.cid,
          name: col.name,
          type: col.type,
          notnull: col.notnull === 1,
          defaultValue: col.dflt_value,
          pk: col.pk
        })),
        rowCount: this.query(`SELECT COUNT(*) as count FROM "${table.name}"`)[0].count
      };

      snapshot.indexes[table.name] = [];
      for (const idx of indexList) {
        const indexInfo = this.query(`PRAGMA index_info("${idx.name}")`);
        snapshot.indexes[table.name].push({
          name: idx.name,
          unique: idx.unique === 1,
          columns: indexInfo.map(i => i.name)
        });
      }

      snapshot.foreignKeys[table.name] = foreignKeyList.map(fk => ({
        id: fk.id,
        seq: fk.seq,
        table: fk.table,
        from: fk.from,
        to: fk.to,
        onUpdate: fk.on_update,
        onDelete: fk.on_delete,
        match: fk.match
      }));
    }

    return snapshot;
  }

  getTableDataSnapshot(tables = null) {
    const snapshot = {};

    if (!tables) {
      const tableList = this.query(`
        SELECT name 
        FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);
      tables = tableList.map(t => t.name);
    }

    for (const table of tables) {
      try {
        const rows = this.query(`SELECT * FROM "${table}"`);
        snapshot[table] = {
          rowCount: rows.length,
          sampleData: rows.slice(0, 100)
        };
      } catch (error) {
        snapshot[table] = {
          rowCount: 0,
          sampleData: [],
          error: error.message
        };
      }
    }

    return snapshot;
  }

  beginTransaction() {
    this.execute('BEGIN TRANSACTION');
  }

  commit() {
    this.execute('COMMIT');
  }

  rollback() {
    this.execute('ROLLBACK');
  }
}

export default DbEngine;
