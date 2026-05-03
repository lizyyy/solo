const fs = require('fs');
const path = require('path');

class SQLParser {
  constructor() {
    this.sqlTypes = {
      ALTER_TABLE: 'ALTER TABLE',
      CREATE_INDEX: 'CREATE INDEX',
      CREATE_INDEX_CONCURRENTLY: 'CREATE INDEX CONCURRENTLY',
      DROP_INDEX: 'DROP INDEX',
      UPDATE: 'UPDATE',
      DELETE: 'DELETE',
      INSERT: 'INSERT',
      SELECT: 'SELECT',
      CREATE_TABLE: 'CREATE TABLE',
      DROP_TABLE: 'DROP TABLE',
      TRUNCATE: 'TRUNCATE',
      ALTER_INDEX: 'ALTER INDEX',
      COMMENT: 'COMMENT',
      BEGIN: 'BEGIN',
      COMMIT: 'COMMIT',
      ROLLBACK: 'ROLLBACK',
      SET: 'SET',
      UNKNOWN: 'UNKNOWN'
    };
  }

  getMigrationFiles(dir) {
    const files = fs.readdirSync(dir)
      .filter(file => file.endsWith('.sql'))
      .map(file => path.join(dir, file))
      .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
    return files;
  }

  parseFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parse(content, filePath);
  }

  parse(content, filePath = 'unknown') {
    const statements = this.splitStatements(content);
    const result = {
      file: filePath,
      statements: [],
      transactions: [],
      warnings: []
    };

    let currentTransaction = null;
    let transactionDepth = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const parsedStmt = this.parseStatement(stmt, i + 1);
      
      // 处理事务块
      if (parsedStmt.type === this.sqlTypes.BEGIN) {
        transactionDepth++;
        if (!currentTransaction) {
          currentTransaction = {
            startLine: parsedStmt.line,
            statements: [],
            hasDDL: false,
            hasDML: false,
            hasConcurrently: false
          };
        }
        currentTransaction.statements.push(parsedStmt);
      } else if (parsedStmt.type === this.sqlTypes.COMMIT || parsedStmt.type === this.sqlTypes.ROLLBACK) {
        transactionDepth--;
        if (currentTransaction) {
          currentTransaction.statements.push(parsedStmt);
          
          // 检查边界情况：事务块中混合 DDL 和 DML
          if (currentTransaction.hasDDL && currentTransaction.hasDML) {
            result.warnings.push({
              type: 'TRANSACTION_MIXED_DDL_DML',
              line: currentTransaction.startLine,
              message: '事务块中混合了 DDL 和 DML 操作，可能导致长时间锁表'
            });
          }
          
          // 检查边界情况：事务块中使用 CONCURRENTLY
          if (currentTransaction.hasConcurrently) {
            result.warnings.push({
              type: 'CONCURRENTLY_IN_TRANSACTION',
              line: currentTransaction.startLine,
              message: 'CONCURRENTLY 操作不应该在显式事务块中执行，这会导致错误'
            });
          }
          
          result.transactions.push(currentTransaction);
          if (transactionDepth === 0) {
            currentTransaction = null;
          }
        }
      } else {
        // 记录到当前事务（如果有的话）
        if (currentTransaction) {
          currentTransaction.statements.push(parsedStmt);
          
          // 检查是否是 DDL 或 DML
          if (this.isDDL(parsedStmt.type)) {
            currentTransaction.hasDDL = true;
          }
          if (this.isDML(parsedStmt.type)) {
            currentTransaction.hasDML = true;
          }
          if (parsedStmt.type === this.sqlTypes.CREATE_INDEX_CONCURRENTLY) {
            currentTransaction.hasConcurrently = true;
          }
        }
        
        result.statements.push(parsedStmt);
      }
      
      // 检查边界情况：CONCURRENTLY 位置错误
      if (parsedStmt.type === this.sqlTypes.CREATE_INDEX && 
          !parsedStmt.concurrently && 
          parsedStmt.raw.toUpperCase().includes('CONCURRENTLY')) {
        result.warnings.push({
          type: 'CONCURRENTLY_POSITION_ERROR',
          line: parsedStmt.line,
          message: 'CONCURRENTLY 关键字位置可能不正确，应该紧跟在 CREATE INDEX 之后'
        });
      }
    }

    return result;
  }

  splitStatements(content) {
    // 移除注释
    content = content.replace(/--.*$/gm, '');
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // 按分号分割，但要处理字符串中的分号
    const statements = [];
    let current = '';
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      
      if (inString) {
        current += char;
        if (char === stringChar && content[i - 1] !== '\\') {
          inString = false;
        }
      } else if (char === "'" || char === '"') {
        current += char;
        inString = true;
        stringChar = char;
      } else if (char === ';') {
        const stmt = current.trim();
        if (stmt) {
          statements.push(stmt);
        }
        current = '';
      } else {
        current += char;
      }
    }
    
    // 处理最后一个语句
    const lastStmt = current.trim();
    if (lastStmt) {
      statements.push(lastStmt);
    }
    
    return statements;
  }

  parseStatement(stmt, line) {
    const upperStmt = stmt.toUpperCase().trim();
    const result = {
      raw: stmt,
      line: line,
      type: this.sqlTypes.UNKNOWN,
      table: null,
      index: null,
      concurrently: false,
      operation: null,
      columns: [],
      lockLevel: null
    };

    // 检测语句类型
    if (upperStmt.startsWith('BEGIN')) {
      result.type = this.sqlTypes.BEGIN;
    } else if (upperStmt.startsWith('COMMIT')) {
      result.type = this.sqlTypes.COMMIT;
    } else if (upperStmt.startsWith('ROLLBACK')) {
      result.type = this.sqlTypes.ROLLBACK;
    } else if (upperStmt.startsWith('SET ')) {
      result.type = this.sqlTypes.SET;
    } else if (upperStmt.startsWith('CREATE INDEX CONCURRENTLY')) {
      result.type = this.sqlTypes.CREATE_INDEX_CONCURRENTLY;
      result.concurrently = true;
      result.operation = 'CREATE_INDEX_CONCURRENTLY';
      this.parseCreateIndex(stmt, result);
    } else if (upperStmt.startsWith('CREATE INDEX')) {
      result.type = this.sqlTypes.CREATE_INDEX;
      result.operation = 'CREATE_INDEX';
      this.parseCreateIndex(stmt, result);
    } else if (upperStmt.startsWith('DROP INDEX')) {
      result.type = this.sqlTypes.DROP_INDEX;
      result.operation = 'DROP_INDEX';
      this.parseDropIndex(stmt, result);
    } else if (upperStmt.startsWith('ALTER INDEX')) {
      result.type = this.sqlTypes.ALTER_INDEX;
      result.operation = 'ALTER_INDEX';
      this.parseAlterIndex(stmt, result);
    } else if (upperStmt.startsWith('ALTER TABLE')) {
      result.type = this.sqlTypes.ALTER_TABLE;
      this.parseAlterTable(stmt, result);
    } else if (upperStmt.startsWith('UPDATE')) {
      result.type = this.sqlTypes.UPDATE;
      result.operation = 'UPDATE';
      this.parseUpdate(stmt, result);
    } else if (upperStmt.startsWith('DELETE')) {
      result.type = this.sqlTypes.DELETE;
      result.operation = 'DELETE';
      this.parseDelete(stmt, result);
    } else if (upperStmt.startsWith('INSERT')) {
      result.type = this.sqlTypes.INSERT;
      result.operation = 'INSERT';
      this.parseInsert(stmt, result);
    } else if (upperStmt.startsWith('CREATE TABLE')) {
      result.type = this.sqlTypes.CREATE_TABLE;
      result.operation = 'CREATE_TABLE';
      this.parseCreateTable(stmt, result);
    } else if (upperStmt.startsWith('DROP TABLE')) {
      result.type = this.sqlTypes.DROP_TABLE;
      result.operation = 'DROP_TABLE';
      this.parseDropTable(stmt, result);
    } else if (upperStmt.startsWith('TRUNCATE')) {
      result.type = this.sqlTypes.TRUNCATE;
      result.operation = 'TRUNCATE';
      this.parseTruncate(stmt, result);
    } else if (upperStmt.startsWith('COMMENT')) {
      result.type = this.sqlTypes.COMMENT;
      result.operation = 'COMMENT';
    } else if (upperStmt.startsWith('SELECT')) {
      result.type = this.sqlTypes.SELECT;
      result.operation = 'SELECT';
    }

    return result;
  }

  parseCreateIndex(stmt, result) {
    // 匹配模式: CREATE [UNIQUE] INDEX [CONCURRENTLY] [IF NOT EXISTS] index_name ON table_name ...
    const patterns = [
      /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+(\w+(?:\.\w+)?)/i,
      /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+ONLY\s+(\w+(?:\.\w+)?)/i
    ];

    for (const pattern of patterns) {
      const match = stmt.match(pattern);
      if (match) {
        result.index = match[1];
        result.table = this.stripSchema(match[2]);
        break;
      }
    }
  }

  parseDropIndex(stmt, result) {
    // 匹配模式: DROP INDEX [CONCURRENTLY] [IF EXISTS] index_name
    const pattern = /DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?(\w+(?:\.\w+)?)/i;
    const match = stmt.match(pattern);
    if (match) {
      result.index = this.stripSchema(match[1]);
      result.concurrently = stmt.toUpperCase().includes('CONCURRENTLY');
    }
  }

  parseAlterIndex(stmt, result) {
    // 匹配模式: ALTER INDEX index_name ...
    const pattern = /ALTER\s+INDEX\s+(?:IF\s+EXISTS\s+)?(\w+(?:\.\w+)?)/i;
    const match = stmt.match(pattern);
    if (match) {
      result.index = this.stripSchema(match[1]);
    }
  }

  parseAlterTable(stmt, result) {
    // 匹配模式: ALTER TABLE [ONLY] table_name ...
    const patterns = [
      /ALTER\s+TABLE\s+ONLY\s+(\w+(?:\.\w+)?)/i,
      /ALTER\s+TABLE\s+(\w+(?:\.\w+)?)/i
    ];

    for (const pattern of patterns) {
      const match = stmt.match(pattern);
      if (match) {
        result.table = this.stripSchema(match[1]);
        break;
      }
    }

    // 检测具体的 ALTER 操作类型
    const upperStmt = stmt.toUpperCase();
    if (upperStmt.includes('ADD COLUMN')) {
      result.operation = 'ADD_COLUMN';
    } else if (upperStmt.includes('DROP COLUMN')) {
      result.operation = 'DROP_COLUMN';
    } else if (upperStmt.includes('ALTER COLUMN') && upperStmt.includes('TYPE')) {
      result.operation = 'ALTER_COLUMN_TYPE';
    } else if (upperStmt.includes('ALTER COLUMN') && upperStmt.includes('SET NOT NULL')) {
      result.operation = 'SET_NOT_NULL';
    } else if (upperStmt.includes('ALTER COLUMN') && upperStmt.includes('DROP NOT NULL')) {
      result.operation = 'DROP_NOT_NULL';
    } else if (upperStmt.includes('ALTER COLUMN') && upperStmt.includes('SET DEFAULT')) {
      result.operation = 'SET_DEFAULT';
    } else if (upperStmt.includes('ALTER COLUMN') && upperStmt.includes('DROP DEFAULT')) {
      result.operation = 'DROP_DEFAULT';
    } else if (upperStmt.includes('ADD CONSTRAINT')) {
      result.operation = 'ADD_CONSTRAINT';
      if (upperStmt.includes('FOREIGN KEY')) {
        result.operation = 'ADD_FOREIGN_KEY';
      } else if (upperStmt.includes('PRIMARY KEY')) {
        result.operation = 'ADD_PRIMARY_KEY';
      } else if (upperStmt.includes('UNIQUE')) {
        result.operation = 'ADD_UNIQUE_CONSTRAINT';
      }
    } else if (upperStmt.includes('DROP CONSTRAINT')) {
      result.operation = 'DROP_CONSTRAINT';
    } else if (upperStmt.includes('RENAME TO')) {
      result.operation = 'RENAME_TABLE';
    } else if (upperStmt.includes('RENAME COLUMN')) {
      result.operation = 'RENAME_COLUMN';
    } else {
      result.operation = 'ALTER_TABLE_OTHER';
    }
  }

  parseUpdate(stmt, result) {
    // 匹配模式: UPDATE [ONLY] table_name SET ...
    const patterns = [
      /UPDATE\s+ONLY\s+(\w+(?:\.\w+)?)/i,
      /UPDATE\s+(\w+(?:\.\w+)?)/i
    ];

    for (const pattern of patterns) {
      const match = stmt.match(pattern);
      if (match) {
        result.table = this.stripSchema(match[1]);
        break;
      }
    }

    // 检查是否有 WHERE 条件
    result.hasWhere = stmt.toUpperCase().includes('WHERE');
  }

  parseDelete(stmt, result) {
    // 匹配模式: DELETE FROM [ONLY] table_name ...
    const patterns = [
      /DELETE\s+FROM\s+ONLY\s+(\w+(?:\.\w+)?)/i,
      /DELETE\s+FROM\s+(\w+(?:\.\w+)?)/i
    ];

    for (const pattern of patterns) {
      const match = stmt.match(pattern);
      if (match) {
        result.table = this.stripSchema(match[1]);
        break;
      }
    }

    // 检查是否有 WHERE 条件
    result.hasWhere = stmt.toUpperCase().includes('WHERE');
  }

  parseInsert(stmt, result) {
    // 匹配模式: INSERT INTO table_name ...
    const pattern = /INSERT\s+INTO\s+(\w+(?:\.\w+)?)/i;
    const match = stmt.match(pattern);
    if (match) {
      result.table = this.stripSchema(match[1]);
    }
  }

  parseCreateTable(stmt, result) {
    // 匹配模式: CREATE TABLE [IF NOT EXISTS] table_name ...
    const pattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+(?:\.\w+)?)/i;
    const match = stmt.match(pattern);
    if (match) {
      result.table = this.stripSchema(match[1]);
    }
  }

  parseDropTable(stmt, result) {
    // 匹配模式: DROP TABLE [IF EXISTS] table_name ...
    const pattern = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+(?:\.\w+)?)/i;
    const match = stmt.match(pattern);
    if (match) {
      result.table = this.stripSchema(match[1]);
    }
  }

  parseTruncate(stmt, result) {
    // 匹配模式: TRUNCATE [TABLE] table_name ...
    const pattern = /TRUNCATE\s+(?:TABLE\s+)?(\w+(?:\.\w+)?)/i;
    const match = stmt.match(pattern);
    if (match) {
      result.table = this.stripSchema(match[1]);
    }
  }

  stripSchema(name) {
    const parts = name.split('.');
    return parts.length > 1 ? parts[1] : parts[0];
  }

  isDDL(type) {
    const ddlTypes = [
      this.sqlTypes.ALTER_TABLE,
      this.sqlTypes.CREATE_INDEX,
      this.sqlTypes.CREATE_INDEX_CONCURRENTLY,
      this.sqlTypes.DROP_INDEX,
      this.sqlTypes.ALTER_INDEX,
      this.sqlTypes.CREATE_TABLE,
      this.sqlTypes.DROP_TABLE,
      this.sqlTypes.TRUNCATE
    ];
    return ddlTypes.includes(type);
  }

  isDML(type) {
    const dmlTypes = [
      this.sqlTypes.UPDATE,
      this.sqlTypes.DELETE,
      this.sqlTypes.INSERT,
      this.sqlTypes.SELECT
    ];
    return dmlTypes.includes(type);
  }
}

module.exports = SQLParser;