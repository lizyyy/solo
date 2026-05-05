import * as fs from 'fs';
import { TableSchema, TableColumn, TableIndex } from './types';

export class SchemaParser {
  private schemaPath: string;

  constructor(schemaPath: string) {
    this.schemaPath = schemaPath;
  }

  parse(): TableSchema[] {
    if (!fs.existsSync(this.schemaPath)) {
      throw new Error(`Schema 文件不存在: ${this.schemaPath}`);
    }

    const content = fs.readFileSync(this.schemaPath, 'utf-8');
    const statements = this.splitStatements(content);
    const tables: Map<string, TableSchema> = new Map();
    const indexes: TableIndex[] = [];

    for (const stmt of statements) {
      const trimmedStmt = stmt.trim();
      
      if (this.isCreateTableStatement(trimmedStmt)) {
        const table = this.parseCreateTable(trimmedStmt);
        tables.set(table.name, table);
      } else if (this.isCreateIndexStatement(trimmedStmt)) {
        const index = this.parseCreateIndex(trimmedStmt);
        if (index) {
          indexes.push(index);
        }
      }
    }

    for (const index of indexes) {
      const table = tables.get(index.table);
      if (table) {
        const existingIndex = table.indexes.find(i => i.name === index.name);
        if (!existingIndex) {
          table.indexes.push(index);
        }
      }
    }

    return Array.from(tables.values());
  }

  private splitStatements(content: string): string[] {
    const statements: string[] = [];
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
        inString = true;
        stringChar = char;
        current += char;
      } else if (char === ';') {
        const trimmed = current.trim();
        if (trimmed) {
          statements.push(trimmed);
        }
        current = '';
      } else if (char === '-' && content[i + 1] === '-') {
        while (i < content.length && content[i] !== '\n') {
          i++;
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      statements.push(current.trim());
    }

    return statements;
  }

  private isCreateTableStatement(stmt: string): boolean {
    const upper = stmt.toUpperCase();
    return upper.startsWith('CREATE TABLE') || upper.startsWith('CREATE VIRTUAL TABLE');
  }

  private isCreateIndexStatement(stmt: string): boolean {
    const upper = stmt.toUpperCase();
    return upper.startsWith('CREATE INDEX') || upper.startsWith('CREATE UNIQUE INDEX');
  }

  private parseCreateTable(stmt: string): TableSchema {
    const upper = stmt.toUpperCase();
    const ifNotExists = upper.includes('IF NOT EXISTS');
    const temp = upper.includes('TEMPORARY') || upper.includes('TEMP');

    let nameMatch: RegExpMatchArray | null;
    
    if (temp) {
      nameMatch = stmt.match(/CREATE\s+(TEMPORARY|TEMP)\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?["'\[]?([^\s"(]+)["'\]]?/i);
    } else {
      nameMatch = stmt.match(/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?["'\[]?([^\s"(]+)["'\]]?/i);
    }

    if (!nameMatch) {
      throw new Error(`无法解析表名: ${stmt.substring(0, 100)}`);
    }

    const tableName = nameMatch[2].replace(/^["'\[]|["'\]]$/g, '');
    const columnsStart = stmt.indexOf('(');
    const columnsEnd = this.findMatchingParen(stmt, columnsStart);

    if (columnsStart === -1 || columnsEnd === -1) {
      throw new Error(`无法解析表定义: ${tableName}`);
    }

    const columnsContent = stmt.substring(columnsStart + 1, columnsEnd);
    const { columns, primaryKeys } = this.parseColumns(columnsContent, tableName);
    const indexes = this.extractTableConstraints(columnsContent, tableName);

    for (const pkColumn of primaryKeys) {
      const col = columns.find(c => c.name === pkColumn);
      if (col) {
        col.isPrimaryKey = true;
      }
      const existingIndex = indexes.find(i => i.isPrimary && i.columns.length === 1 && i.columns[0] === pkColumn);
      if (!existingIndex) {
        indexes.push({
          name: `${tableName}_pk`,
          table: tableName,
          columns: [pkColumn],
          isUnique: true,
          isPrimary: true,
        });
      }
    }

    return {
      name: tableName,
      columns,
      indexes,
      createStatement: stmt,
    };
  }

  private parseColumns(content: string, tableName: string): { columns: TableColumn[]; primaryKeys: string[] } {
    const columns: TableColumn[] = [];
    const primaryKeys: string[] = [];
    const parts = this.splitColumnDefinitions(content);

    for (const part of parts) {
      const trimmed = part.trim();
      const upper = trimmed.toUpperCase();

      if (upper.startsWith('PRIMARY KEY')) {
        const pkMatch = trimmed.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
          const keys = pkMatch[1].split(',').map(k => k.trim().replace(/^["']|["']$/g, ''));
          primaryKeys.push(...keys);
        }
        continue;
      }

      if (upper.startsWith('CONSTRAINT') || 
          upper.startsWith('UNIQUE') || 
          upper.startsWith('FOREIGN KEY') ||
          upper.startsWith('CHECK')) {
        continue;
      }

      const column = this.parseColumn(trimmed, tableName);
      if (column) {
        columns.push(column);
        if (column.isPrimaryKey) {
          primaryKeys.push(column.name);
        }
      }
    }

    return { columns, primaryKeys };
  }

  private splitColumnDefinitions(content: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;
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
        inString = true;
        stringChar = char;
        current += char;
      } else if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        const trimmed = current.trim();
        if (trimmed) {
          parts.push(trimmed);
        }
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  private parseColumn(part: string, tableName: string): TableColumn | null {
    const trimmed = part.trim();
    if (!trimmed) return null;

    const words = trimmed.split(/\s+/);
    const name = words[0].replace(/^["'\[]|["'\]]$/g, '');

    let type = 'TEXT';
    let nullable = true;
    let isPrimaryKey = false;
    let isAutoIncrement = false;
    let defaultValue: string | undefined;

    for (let i = 1; i < words.length; i++) {
      const word = words[i].toUpperCase();

      if (['INTEGER', 'INT', 'BIGINT', 'SMALLINT', 'TINYINT'].includes(word)) {
        type = 'INTEGER';
      } else if (['TEXT', 'VARCHAR', 'CHAR', 'CLOB'].includes(word)) {
        type = 'TEXT';
      } else if (['REAL', 'FLOAT', 'DOUBLE'].includes(word)) {
        type = 'REAL';
      } else if (['BLOB'].includes(word)) {
        type = 'BLOB';
      } else if (['BOOLEAN', 'BOOL'].includes(word)) {
        type = 'INTEGER';
      } else if (word === 'NOT') {
        if (words[i + 1]?.toUpperCase() === 'NULL') {
          nullable = false;
          i++;
        }
      } else if (word === 'NULL') {
        nullable = true;
      } else if (word === 'PRIMARY') {
        if (words[i + 1]?.toUpperCase() === 'KEY') {
          isPrimaryKey = true;
          i++;
        }
      } else if (word === 'AUTOINCREMENT') {
        isAutoIncrement = true;
      } else if (word === 'DEFAULT') {
        i++;
        let defaultParts: string[] = [];
        let inParen = 0;
        let inString = false;
        
        while (i < words.length) {
          const nextWord = words[i];
          defaultParts.push(nextWord);
          
          if (nextWord.includes('(')) inParen++;
          if (nextWord.includes(')')) inParen--;
          if (nextWord.startsWith("'") || nextWord.startsWith('"')) inString = true;
          if ((nextWord.endsWith("'") || nextWord.endsWith('"')) && !nextWord.endsWith("''") && !nextWord.endsWith('""')) inString = false;
          
          if (inParen === 0 && !inString) break;
          i++;
        }
        
        defaultValue = defaultParts.join(' ');
      }
    }

    return {
      name,
      type,
      nullable,
      default: defaultValue,
      isPrimaryKey,
      isAutoIncrement,
    };
  }

  private extractTableConstraints(content: string, tableName: string): TableIndex[] {
    const indexes: TableIndex[] = [];
    const uniqueMatches = content.match(/CONSTRAINT\s+(\w+)\s+UNIQUE\s*\(([^)]+)\)/gi);
    
    if (uniqueMatches) {
      for (const match of uniqueMatches) {
        const nameMatch = match.match(/CONSTRAINT\s+(\w+)/i);
        const columnsMatch = match.match(/UNIQUE\s*\(([^)]+)\)/i);
        
        if (nameMatch && columnsMatch) {
          indexes.push({
            name: nameMatch[1],
            table: tableName,
            columns: columnsMatch[1].split(',').map(c => c.trim().replace(/^["']|["']$/g, '')),
            isUnique: true,
            isPrimary: false,
          });
        }
      }
    }

    return indexes;
  }

  private parseCreateIndex(stmt: string): TableIndex | null {
    const upper = stmt.toUpperCase();
    const isUnique = upper.includes('UNIQUE');
    
    const nameMatch = stmt.match(/CREATE\s+(UNIQUE\s+)?INDEX\s+(IF\s+NOT\s+EXISTS\s+)?["'\[]?([^\s"(]+)["'\]]?/i);
    if (!nameMatch) return null;

    const indexName = nameMatch[3].replace(/^["'\[]|["'\]]$/g, '');
    
    const tableMatch = stmt.match(/ON\s+["'\[]?([^\s"(]+)["'\]]?/i);
    if (!tableMatch) return null;

    const tableName = tableMatch[1].replace(/^["'\[]|["'\]]$/g, '');
    
    const columnsMatch = stmt.match(/\(([^)]+)\)/);
    if (!columnsMatch) return null;

    const columns = columnsMatch[1].split(',').map(c => {
      const trimmed = c.trim();
      const namePart = trimmed.split(/\s+/)[0];
      return namePart.replace(/^["']|["']$/g, '');
    });

    return {
      name: indexName,
      table: tableName,
      columns,
      isUnique,
      isPrimary: false,
    };
  }

  private findMatchingParen(text: string, startIndex: number): number {
    if (text[startIndex] !== '(') return -1;

    let depth = 1;
    let inString = false;
    let stringChar = '';

    for (let i = startIndex + 1; i < text.length; i++) {
      const char = text[i];

      if (inString) {
        if (char === stringChar && text[i - 1] !== '\\') {
          inString = false;
        }
      } else if (char === "'" || char === '"') {
        inString = true;
        stringChar = char;
      } else if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth === 0) return i;
      }
    }

    return -1;
  }

  generateSampleSchema(outputPath?: string): string {
    const sampleSchema = `-- 示例用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    status INTEGER DEFAULT 1
);

-- 示例订单表
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    order_no TEXT NOT NULL UNIQUE,
    total_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
`;

    if (outputPath) {
      fs.writeFileSync(outputPath, sampleSchema, 'utf-8');
      console.log(`示例 Schema 已生成: ${outputPath}`);
    }

    return sampleSchema;
  }
}
