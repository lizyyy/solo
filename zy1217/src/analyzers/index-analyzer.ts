import { BaseAnalyzer } from './base-analyzer';
import { SchemaSQL, SQLTraceEntry, IndexUsageMetrics, IndexDefinition, TableDefinition } from '../types';

export class IndexAnalyzer extends BaseAnalyzer {
  private schema: SchemaSQL;
  private traceEntries: SQLTraceEntry[];

  constructor(schema: SchemaSQL, traceEntries: SQLTraceEntry[]) {
    super();
    this.schema = schema;
    this.traceEntries = traceEntries;
  }

  analyze(): IndexUsageMetrics {
    const usedIndexes = this.findUsedIndexes();
    const unusedIndexes = this.findUnusedIndexes(usedIndexes);
    const missingIndexes = this.findMissingIndexes();
    const duplicateIndexes = this.findDuplicateIndexes();
    const indexScanCount = this.analyzeIndexScans();

    if (unusedIndexes.length > 0) {
      this.addIssue(
        'index',
        'warning',
        '存在未使用的索引',
        `发现 ${unusedIndexes.length} 个未使用的索引，冗余索引会增加写入开销`,
        unusedIndexes.map(i => `${i.table}.${i.name}`),
        '未使用的索引会拖慢 INSERT/UPDATE/DELETE 操作'
      );
      this.addSuggestion(
        '删除未使用的索引',
        `建议删除以下未使用的索引: ${unusedIndexes.slice(0, 3).map(i => i.name).join(', ')} 等`,
        'medium',
        `执行: DROP INDEX ${unusedIndexes[0]?.name} ON ${unusedIndexes[0]?.table};`
      );
    }

    if (missingIndexes.length > 0) {
      this.addIssue(
        'index',
        'blocker',
        '缺失必要索引',
        `发现 ${missingIndexes.length} 个查询可能缺少合适的索引，可能导致全表扫描`,
        missingIndexes,
        '全表扫描会严重影响查询性能'
      );
      this.addSuggestion(
        '添加缺失的索引',
        '根据慢查询分析添加合适的索引',
        'high',
        '分析慢查询的 WHERE 条件，对过滤字段添加索引'
      );
    }

    if (duplicateIndexes.length > 0) {
      this.addIssue(
        'index',
        'warning',
        '存在重复或冗余索引',
        `发现 ${duplicateIndexes.length} 个重复/冗余索引`,
        duplicateIndexes,
        '重复索引只会增加维护开销'
      );
    }

    const fullTableScans = this.estimateFullTableScans();
    if (fullTableScans > 0) {
      this.addIssue(
        'index',
        'warning',
        '存在全表扫描',
        `估算发现约 ${fullTableScans} 次查询可能触发了全表扫描`,
        [],
        '全表扫描在大数据量时性能极差'
      );
    }

    return {
      usedIndexes: usedIndexes.map(i => i.name),
      unusedIndexes: unusedIndexes.map(i => i.name),
      missingIndexes,
      duplicateIndexes,
      indexScanCount
    };
  }

  private findUsedIndexes(): IndexDefinition[] {
    const usedIndexes: IndexDefinition[] = [];
    const indexUsageMap = new Map<string, IndexDefinition>();

    for (const index of this.schema.indexes) {
      const indexKey = `${index.table}.${index.columns.join(',')}`;
      
      for (const entry of this.traceEntries) {
        if (this.queryReferencesIndex(entry.sql, index)) {
          if (!indexUsageMap.has(indexKey)) {
            indexUsageMap.set(indexKey, index);
            usedIndexes.push(index);
          }
          break;
        }
      }
    }

    return usedIndexes;
  }

  private findUnusedIndexes(usedIndexes: IndexDefinition[]): IndexDefinition[] {
    const usedNames = new Set(usedIndexes.map(i => i.name));
    return this.schema.indexes.filter(i => !usedNames.has(i.name));
  }

  private findMissingIndexes(): string[] {
    const missingIndexes: string[] = [];
    const tablesWithIndexes = new Set(this.schema.indexes.map(i => i.table));
    const allTables = new Set(this.schema.tables.map(t => t.name));
    const tablesWithoutIndexes = [...allTables].filter(t => !tablesWithIndexes.has(t));

    if (tablesWithoutIndexes.length > 0) {
      for (const table of tablesWithoutIndexes) {
        const tableQueries = this.traceEntries.filter(e => 
          e.sql.toLowerCase().includes(table.toLowerCase())
        );
        if (tableQueries.length > 0) {
          missingIndexes.push(`表 ${table} 未定义任何索引`);
        }
      }
    }

    const whereClausePatterns = this.extractWhereClauses();
    for (const pattern of whereClausePatterns.slice(0, 5)) {
      if (!this.hasMatchingIndex(pattern)) {
        missingIndexes.push(`建议为 ${pattern} 添加索引`);
      }
    }

    return missingIndexes;
  }

  private findDuplicateIndexes(): string[] {
    const duplicates: string[] = [];
    const tableIndexMap = new Map<string, IndexDefinition[]>();

    for (const index of this.schema.indexes) {
      if (!tableIndexMap.has(index.table)) {
        tableIndexMap.set(index.table, []);
      }
      tableIndexMap.get(index.table)!.push(index);
    }

    for (const [table, indexes] of tableIndexMap) {
      for (let i = 0; i < indexes.length; i++) {
        for (let j = i + 1; j < indexes.length; j++) {
          const idx1 = indexes[i];
          const idx2 = indexes[j];
          
          if (this.isPrefixIndex(idx1.columns, idx2.columns)) {
            duplicates.push(
              `${table}.${idx1.name} 是 ${table}.${idx2.name} 的前缀索引，可能冗余`
            );
          }
        }
      }
    }

    return duplicates;
  }

  private analyzeIndexScans(): Record<string, number> {
    const scanCount: Record<string, number> = {};

    for (const index of this.schema.indexes) {
      let count = 0;
      for (const entry of this.traceEntries) {
        if (this.queryReferencesIndex(entry.sql, index)) {
          count++;
        }
      }
      if (count > 0) {
        scanCount[index.name] = count;
      }
    }

    return scanCount;
  }

  private queryReferencesIndex(sql: string, index: IndexDefinition): boolean {
    const sqlLower = sql.toLowerCase();
    const tableLower = index.table.toLowerCase();
    
    if (!sqlLower.includes(tableLower)) {
      return false;
    }

    for (const col of index.columns) {
      if (sqlLower.includes(col.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  private extractWhereClauses(): string[] {
    const patterns: string[] = [];
    const whereRegex = /WHERE\s+(.+?)(?:GROUP|ORDER|HAVING|LIMIT|$)/gi;
    
    for (const entry of this.traceEntries) {
      let match;
      while ((match = whereRegex.exec(entry.sql)) !== null) {
        const whereClause = match[1];
        const columnPatterns = whereClause.match(/(\w+)\s*[=<>]/g);
        if (columnPatterns) {
          patterns.push(...columnPatterns.map(p => p.replace(/\s*[=<>].*/, '')));
        }
      }
    }

    const freqMap = new Map<string, number>();
    for (const p of patterns) {
      freqMap.set(p, (freqMap.get(p) || 0) + 1);
    }

    return [...freqMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(e => e[0]);
  }

  private hasMatchingIndex(column: string): boolean {
    return this.schema.indexes.some(idx => 
      idx.columns.some(c => c.toLowerCase() === column.toLowerCase())
    );
  }

  private isPrefixIndex(cols1: string[], cols2: string[]): boolean {
    if (cols1.length > cols2.length) return false;
    for (let i = 0; i < cols1.length; i++) {
      if (cols1[i].toLowerCase() !== cols2[i].toLowerCase()) return false;
    }
    return true;
  }

  private estimateFullTableScans(): number {
    let fullScans = 0;
    
    for (const entry of this.traceEntries) {
      const sqlLower = entry.sql.toLowerCase();
      
      if (sqlLower.includes('select') && 
          !sqlLower.includes('where') && 
          !sqlLower.includes('limit')) {
        fullScans++;
      }
      
      if (sqlLower.includes('like') && sqlLower.includes('%')) {
        const likeIndex = sqlLower.indexOf('like');
        const beforeLike = sqlLower.substring(0, likeIndex);
        const afterLike = sqlLower.substring(likeIndex + 4);
        
        if (afterLike.trim().startsWith("'%") || afterLike.trim().startsWith('"%')) {
          fullScans++;
        }
      }
    }

    return fullScans;
  }
}
