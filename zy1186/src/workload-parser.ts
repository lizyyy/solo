import * as fs from 'fs';
import * as readline from 'readline';
import { WorkloadRecord, TableSchema } from './types';

export class WorkloadParser {
  private workloadPath: string;
  private tables: Map<string, TableSchema>;

  constructor(workloadPath: string, tables: TableSchema[] = []) {
    this.workloadPath = workloadPath;
    this.tables = new Map(tables.map(t => [t.name, t]));
  }

  async parse(limit?: number): Promise<WorkloadRecord[]> {
    if (!fs.existsSync(this.workloadPath)) {
      throw new Error(`Workload 文件不存在: ${this.workloadPath}`);
    }

    const records: WorkloadRecord[] = [];
    const errors: string[] = [];
    let lineNumber = 0;

    const fileStream = fs.createReadStream(this.workloadPath, 'utf-8');
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      lineNumber++;
      const trimmedLine = line.trim();
      
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      try {
        const record = this.parseLine(trimmedLine, lineNumber);
        records.push(record);

        if (limit && records.length >= limit) {
          break;
        }
      } catch (error) {
        errors.push(`第 ${lineNumber} 行: ${(error as Error).message}`);
      }
    }

    if (errors.length > 0) {
      console.warn(`警告: 解析过程中发现 ${errors.length} 个错误`);
      if (errors.length <= 10) {
        errors.forEach(err => console.warn(`  - ${err}`));
      } else {
        console.warn(`  - 显示前 10 个错误，共 ${errors.length} 个`);
        errors.slice(0, 10).forEach(err => console.warn(`  - ${err}`));
      }
    }

    if (records.length === 0) {
      throw new Error('未能解析任何有效记录');
    }

    return records;
  }

  private parseLine(line: string, lineNumber: number): WorkloadRecord {
    let json: any;
    
    try {
      json = JSON.parse(line);
    } catch (error) {
      throw new Error(`JSON 解析失败: ${(error as Error).message}`);
    }

    const operation = this.parseOperation(json.operation);
    const table = this.parseTable(json.table);
    const data = this.parseData(json.data, table);
    const where = json.where ? this.parseWhere(json.where, table) : undefined;

    const record: WorkloadRecord = {
      operation,
      table,
      data,
      where,
    };

    this.validateRecord(record, lineNumber);

    return record;
  }

  private parseOperation(op: any): 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT' {
    if (!op) {
      return 'INSERT';
    }

    const upper = String(op).toUpperCase();
    if (['INSERT', 'UPDATE', 'DELETE', 'UPSERT'].includes(upper)) {
      return upper as 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
    }

    throw new Error(`无效的操作类型: ${op}。有效值: INSERT, UPDATE, DELETE, UPSERT`);
  }

  private parseTable(table: any): string {
    if (!table || typeof table !== 'string') {
      throw new Error(`表名必须是字符串: ${JSON.stringify(table)}`);
    }
    return table.trim();
  }

  private parseData(data: any, table: string): Record<string, any> {
    if (!data || typeof data !== 'object') {
      throw new Error(`数据必须是对象: ${JSON.stringify(data)}`);
    }

    const tableSchema = this.tables.get(table);
    if (tableSchema) {
      for (const [key, value] of Object.entries(data)) {
        const column = tableSchema.columns.find(c => c.name === key);
        if (column) {
          data[key] = this.coerceValue(value, column.type);
        }
      }
    }

    return data;
  }

  private parseWhere(where: any, table: string): Record<string, any> {
    if (!where || typeof where !== 'object') {
      throw new Error(`WHERE 条件必须是对象: ${JSON.stringify(where)}`);
    }
    return where;
  }

  private coerceValue(value: any, type: string): any {
    if (value === null || value === undefined) {
      return null;
    }

    const upperType = type.toUpperCase();

    if (upperType === 'INTEGER' || upperType === 'INT') {
      if (typeof value === 'number') {
        return Math.trunc(value);
      }
      if (typeof value === 'string') {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
      if (typeof value === 'boolean') {
        return value ? 1 : 0;
      }
    }

    if (upperType === 'REAL' || upperType === 'FLOAT' || upperType === 'DOUBLE') {
      if (typeof value === 'number') {
        return value;
      }
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    }

    if (upperType === 'TEXT' || upperType === 'VARCHAR' || upperType === 'CHAR') {
      if (typeof value === 'string') {
        return value;
      }
      return String(value);
    }

    if (upperType === 'BLOB') {
      if (Buffer.isBuffer(value)) {
        return value;
      }
      if (typeof value === 'string') {
        return Buffer.from(value, 'base64');
      }
    }

    return value;
  }

  private validateRecord(record: WorkloadRecord, lineNumber: number): void {
    const tableSchema = this.tables.get(record.table);
    if (!tableSchema) {
      return;
    }

    if (record.operation === 'INSERT' || record.operation === 'UPSERT') {
      for (const column of tableSchema.columns) {
        if (!column.nullable && 
            !column.isPrimaryKey && 
            !column.isAutoIncrement &&
            column.default === undefined &&
            record.data[column.name] === undefined) {
          throw new Error(
            `表 ${record.table} 的列 ${column.name} 不可为空且没有默认值，` +
            `但记录中未提供该字段的值 (第 ${lineNumber} 行)`
          );
        }
      }
    }

    if (record.operation === 'UPDATE' || record.operation === 'DELETE') {
      if (!record.where) {
        throw new Error(
          `${record.operation} 操作需要提供 WHERE 条件 (第 ${lineNumber} 行)`
        );
      }
    }
  }

  generateSampleWorkload(outputPath?: string, recordCount: number = 100): string {
    const records: string[] = [];

    for (let i = 1; i <= recordCount; i++) {
      const userRecord: WorkloadRecord = {
        operation: 'INSERT',
        table: 'users',
        data: {
          username: `user_${i}`,
          email: `user${i}@example.com`,
          status: i % 2 === 0 ? 1 : 0,
        },
      };
      records.push(JSON.stringify(userRecord));

      if (i % 3 === 0) {
        const orderRecord: WorkloadRecord = {
          operation: 'INSERT',
          table: 'orders',
          data: {
            user_id: i,
            order_no: `ORD-${String(i).padStart(6, '0')}`,
            total_amount: Math.round(Math.random() * 10000) / 100,
            status: ['pending', 'paid', 'shipped', 'delivered'][Math.floor(Math.random() * 4)],
          },
        };
        records.push(JSON.stringify(orderRecord));
      }
    }

    const content = records.join('\n');

    if (outputPath) {
      fs.writeFileSync(outputPath, content, 'utf-8');
      console.log(`示例 Workload 已生成: ${outputPath} (${records.length} 条记录)`);
    }

    return content;
  }

  static getSampleWorkloadStructure(): string {
    return `# Workload JSONL 格式说明
# 每行一个 JSON 对象，表示一条写入操作记录
# 
# 字段说明：
#   - operation: 操作类型 (INSERT | UPDATE | DELETE | UPSERT)，默认为 INSERT
#   - table: 目标表名 (必填)
#   - data: 数据对象，键为列名，值为数据 (INSERT/UPSERT 必填)
#   - where: 条件对象，用于 UPDATE/DELETE 操作
#
# 示例：

{"operation":"INSERT","table":"users","data":{"username":"john","email":"john@example.com"}}
{"operation":"INSERT","table":"orders","data":{"user_id":1,"order_no":"ORD-000001","total_amount":99.99}}
{"operation":"UPDATE","table":"users","data":{"status":1},"where":{"id":1}}
`;
  }
}
