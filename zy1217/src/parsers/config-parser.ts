import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import * as csv from 'csv-parser';
import { DBProfile, SchemaSQL, SQLTraceEntry, WriteBatch, ShardingPlan, TableDefinition, IndexDefinition, ColumnDefinition } from '../types';

export class ConfigParser {
  private baseDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
  }

  async parseDBProfile(filePath?: string): Promise<DBProfile> {
    const fullPath = filePath || path.join(this.baseDir, 'db-profile.yaml');
    const content = await this.readFile(fullPath);
    return yaml.parse(content) as DBProfile;
  }

  async parseSchemaSQL(filePath?: string): Promise<SchemaSQL> {
    const fullPath = filePath || path.join(this.baseDir, 'schema.sql');
    const content = await this.readFile(fullPath);
    return this.parseSQLSchema(content);
  }

  private parseSQLSchema(sqlContent: string): SchemaSQL {
    const tables: TableDefinition[] = [];
    const indexes: IndexDefinition[] = [];

    const statements = sqlContent.split(';').filter(s => s.trim().length > 0);

    for (const statement of statements) {
      const trimmed = statement.trim();

      if (trimmed.toUpperCase().startsWith('CREATE TABLE')) {
        tables.push(this.parseCreateTable(trimmed));
      } else if (trimmed.toUpperCase().startsWith('CREATE INDEX')) {
        indexes.push(this.parseCreateIndex(trimmed));
      } else if (trimmed.toUpperCase().startsWith('CREATE UNIQUE INDEX')) {
        indexes.push(this.parseCreateIndex(trimmed, 'UNIQUE'));
      }
    }

    return { tables, indexes, constraints: [] };
  }

  private parseCreateTable(statement: string): TableDefinition {
    const match = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*)\)/i);
    if (!match) {
      return { name: 'unknown', columns: [] };
    }

    const tableName = match[1];
    const columnsStr = match[2];
    const columns: ColumnDefinition[] = [];
    const primaryKey: string[] = [];

    const columnDefs = columnsStr.split(',').map(c => c.trim());

    for (const colDef of columnDefs) {
      if (colDef.toUpperCase().includes('PRIMARY KEY')) {
        const pkMatch = colDef.match(/PRIMARY\s+KEY\s*\(([\s\S]*)\)/i);
        if (pkMatch) {
          primaryKey.push(...pkMatch[1].split(',').map(s => s.trim()));
        }
      } else {
        const colParts = colDef.split(/\s+/);
        if (colParts.length >= 2) {
          const name = colParts[0].replace(/["`]/g, '');
          const type = colParts[1];
          const nullable = !colDef.toUpperCase().includes('NOT NULL');
          
          columns.push({ name, type, nullable });
        }
      }
    }

    const table: TableDefinition = { name: tableName, columns };
    if (primaryKey.length > 0) {
      table.primaryKey = primaryKey;
    }

    return table;
  }

  private parseCreateIndex(statement: string, defaultType: IndexDefinition['type'] = 'INDEX'): IndexDefinition {
    const uniqueMatch = statement.match(/CREATE\s+UNIQUE\s+INDEX/i);
    const indexType = uniqueMatch ? 'UNIQUE' : defaultType;

    const match = statement.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(\w+)\s+ON\s+(\w+)\s*\(([\s\S]*)\)/i);
    
    if (!match) {
      return { name: 'unknown', table: 'unknown', columns: [], type: indexType };
    }

    return {
      name: match[1],
      table: match[2],
      columns: match[3].split(',').map(s => s.trim()),
      type: indexType
    };
  }

  async parseSQLTrace(filePath?: string): Promise<SQLTraceEntry[]> {
    const fullPath = filePath || path.join(this.baseDir, 'sql-trace.jsonl');
    const content = await this.readFile(fullPath);
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    return lines.map((line, index) => {
      try {
        return JSON.parse(line) as SQLTraceEntry;
      } catch (e) {
        throw new Error(`Failed to parse line ${index + 1}: ${line.substring(0, 100)}...`);
      }
    });
  }

  async parseWriteBatches(filePath?: string): Promise<WriteBatch[]> {
    const fullPath = filePath || path.join(this.baseDir, 'write-batches.csv');
    
    return new Promise((resolve, reject) => {
      const batches: WriteBatch[] = [];
      
      fs.createReadStream(fullPath)
        .pipe(csv())
        .on('data', (row: any) => {
          batches.push({
            batchId: row.batchId || row.batch_id || '',
            timestamp: parseInt(row.timestamp) || Date.now(),
            table: row.table || '',
            operation: (row.operation as 'INSERT' | 'UPDATE' | 'DELETE') || 'INSERT',
            rowCount: parseInt(row.rowCount) || parseInt(row.row_count) || 1,
            values: row.values ? JSON.parse(row.values) : [],
            shardKey: row.shardKey || row.shard_key,
            shardId: row.shardId !== undefined ? parseInt(row.shardId) : (row.shard_id !== undefined ? parseInt(row.shard_id) : undefined)
          });
        })
        .on('end', () => resolve(batches))
        .on('error', reject);
    });
  }

  async parseShardingPlan(filePath?: string): Promise<ShardingPlan> {
    const fullPath = filePath || path.join(this.baseDir, 'sharding-plan.yaml');
    const content = await this.readFile(fullPath);
    return yaml.parse(content) as ShardingPlan;
  }

  private async readFile(filePath: string): Promise<string> {
    try {
      return await fs.promises.readFile(filePath, 'utf-8');
    } catch (e) {
      throw new Error(`Failed to read file: ${filePath}. Error: ${e}`);
    }
  }
}
