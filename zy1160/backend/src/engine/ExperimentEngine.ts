import {
  ExperimentConfig,
  ExperimentResult,
  QueryResult,
  IndexComparison,
  OperationResult,
  KeyType,
  ValueType,
  BPlusTreeVisualization,
  HashVisualization,
  TableData,
} from '../types';
import { BPlusTreeIndex, HashIndex } from '../indexes';

export class ExperimentEngine {
  private config: ExperimentConfig;
  private bplusIndex: BPlusTreeIndex;
  private hashIndex: HashIndex;
  private tableData: TableData;

  constructor(config: ExperimentConfig) {
    this.config = config;
    this.bplusIndex = new BPlusTreeIndex(config.bplusOrder);
    this.hashIndex = new HashIndex(config.hashInitialBuckets, config.hashLoadFactor);
    this.tableData = { rows: [], rowCount: 0 };
  }

  private generateKey(row: ValueType, indexColumns: string[]): KeyType {
    if (indexColumns.length === 1) {
      return row[indexColumns[0]] as KeyType;
    }
    return indexColumns.map(col => String(row[col])).join('_');
  }

  generateSeedData(): void {
    const { seed, dataSize, tables, indexes } = this.config;
    const seededRandom = this.createSeededRandom(seed);

    if (tables.length === 0 || indexes.length === 0) {
      return;
    }

    const table = tables[0];
    const index = indexes.find(i => i.table === table.name) || indexes[0];

    const names = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑九', '王十'];
    const departments = ['技术部', '市场部', '财务部', '人事部', '运营部', '产品部'];
    const cities = ['北京', '上海', '广州', '深圳', '杭州', '南京', '武汉', '成都'];

    this.tableData.rows = [];

    for (let i = 0; i < dataSize; i++) {
      const row: ValueType = {
        id: i + 1,
        name: names[Math.floor(seededRandom() * names.length)],
        age: 20 + Math.floor(seededRandom() * 40),
        department: departments[Math.floor(seededRandom() * departments.length)],
        salary: 5000 + Math.floor(seededRandom() * 25000),
        city: cities[Math.floor(seededRandom() * cities.length)],
        joinDate: `202${Math.floor(seededRandom() * 4)}-${String(Math.floor(seededRandom() * 12) + 1).padStart(2, '0')}-${String(Math.floor(seededRandom() * 28) + 1).padStart(2, '0')}`,
        isActive: seededRandom() > 0.2,
      };

      this.tableData.rows.push(row);

      const key = this.generateKey(row, index.columns);
      this.bplusIndex.insert(key, { ...row });
      this.hashIndex.insert(key, { ...row });
    }

    this.tableData.rowCount = this.tableData.rows.length;
  }

  private createSeededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  runQuery(queryId: string): QueryResult {
    const query = this.config.queries.find(q => q.id === queryId);
    if (!query) {
      throw new Error(`Query not found: ${queryId}`);
    }

    let bplusResult: OperationResult;
    let hashResult: OperationResult;

    switch (query.type) {
      case 'equality':
        bplusResult = this.runEqualityQuery(this.bplusIndex, query);
        hashResult = this.runEqualityQuery(this.hashIndex, query);
        break;
      case 'range':
        bplusResult = this.runRangeQuery(this.bplusIndex, query);
        hashResult = this.runRangeQuery(this.hashIndex, query);
        break;
      case 'prefix':
        bplusResult = this.runPrefixQuery(this.bplusIndex, query);
        hashResult = this.runPrefixQuery(this.hashIndex, query);
        break;
      case 'insert':
        bplusResult = this.runInsertQuery(this.bplusIndex, query);
        hashResult = this.runInsertQuery(this.hashIndex, query);
        break;
      case 'delete':
        bplusResult = this.runDeleteQuery(this.bplusIndex, query);
        hashResult = this.runDeleteQuery(this.hashIndex, query);
        break;
      default:
        throw new Error(`Unsupported query type: ${query.type}`);
    }

    const winner = this.determineWinner(bplusResult.stats, hashResult.stats);

    return {
      queryId,
      queryName: query.name,
      queryType: query.type,
      bplusResult,
      hashResult,
      winner,
    };
  }

  private runEqualityQuery(index: BPlusTreeIndex | HashIndex, query: any): OperationResult {
    const condition = query.conditions[0];
    return index.search(condition.value as KeyType);
  }

  private runRangeQuery(index: BPlusTreeIndex | HashIndex, query: any): OperationResult {
    const startCondition = query.conditions.find((c: any) => c.operator === '>=' || c.operator === '>');
    const endCondition = query.conditions.find((c: any) => c.operator === '<=' || c.operator === '<');
    
    const startKey = startCondition?.value as KeyType ?? 0;
    const endKey = endCondition?.value as KeyType ?? Number.MAX_SAFE_INTEGER;
    
    return index.rangeSearch(startKey, endKey);
  }

  private runPrefixQuery(index: BPlusTreeIndex | HashIndex, query: any): OperationResult {
    const condition = query.conditions[0];
    const value = String(condition.value);
    const prefix = value.replace('%', '');
    return index.prefixSearch(prefix);
  }

  private runInsertQuery(index: BPlusTreeIndex | HashIndex, query: any): OperationResult {
    const values = query.values || {};
    const key = values['id'] as KeyType ?? Date.now();
    return index.insert(key, values);
  }

  private runDeleteQuery(index: BPlusTreeIndex | HashIndex, query: any): OperationResult {
    const condition = query.conditions[0];
    return index.delete(condition.value as KeyType);
  }

  private determineWinner(bplusStats: any, hashStats: any): 'bplus' | 'hash' | 'tie' {
    const bplusScore = bplusStats.estimatedTime;
    const hashScore = hashStats.estimatedTime;

    if (bplusScore < hashScore) return 'bplus';
    if (hashScore < bplusScore) return 'hash';
    return 'tie';
  }

  runAllQueries(): ExperimentResult {
    const queryResults: QueryResult[] = [];

    for (const query of this.config.queries) {
      const result = this.runQuery(query.id);
      queryResults.push(result);
    }

    const comparison = this.generateComparison(queryResults);

    return {
      id: `result_${Date.now()}`,
      experimentId: this.config.id,
      timestamp: Date.now(),
      queryResults,
      comparison,
    };
  }

  private generateComparison(queryResults: QueryResult[]): IndexComparison {
    let bplusTotalAccesses = 0;
    let bplusTotalTime = 0;
    let bplusWins = 0;
    let hashTotalAccesses = 0;
    let hashTotalTime = 0;
    let hashWins = 0;

    for (const result of queryResults) {
      bplusTotalAccesses += result.bplusResult.stats.pageAccesses;
      bplusTotalTime += result.bplusResult.stats.estimatedTime;
      hashTotalAccesses += result.hashResult.stats.pageAccesses;
      hashTotalTime += result.hashResult.stats.estimatedTime;

      if (result.winner === 'bplus') bplusWins++;
      else if (result.winner === 'hash') hashWins++;
    }

    const overallWinner = bplusTotalTime < hashTotalTime ? 'bplus' : 
                          hashTotalTime < bplusTotalTime ? 'hash' : 'tie';

    return {
      bplus: {
        totalPageAccesses: bplusTotalAccesses,
        totalTime: bplusTotalTime,
        queriesWon: bplusWins,
        strengths: [
          '支持范围查询和前缀查询',
          '支持 ORDER BY 排序',
          '数据有序，适合批量操作',
          '索引列支持部分匹配',
        ],
        weaknesses: [
          '等值查询比哈希索引慢',
          '插入删除可能触发页分裂',
          '树高增加时查询路径变长',
        ],
        bestScenarios: [
          '范围查询 (BETWEEN, >, <)',
          '前缀匹配查询 (LIKE "prefix%")',
          '需要排序的查询 (ORDER BY)',
          '频繁的范围扫描操作',
        ],
      },
      hash: {
        totalPageAccesses: hashTotalAccesses,
        totalTime: hashTotalTime,
        queriesWon: hashWins,
        strengths: [
          '等值查询 O(1) 时间复杂度',
          '单值查找效率极高',
          '无树高概念，查询稳定',
        ],
        weaknesses: [
          '不支持范围查询',
          '不支持前缀匹配',
          '哈希冲突导致性能下降',
          '扩容时需要重哈希',
          '无法用于 ORDER BY',
        ],
        bestScenarios: [
          '主键等值查询',
          '唯一键查找',
          '频繁的单值 INSERT/DELETE',
          '缓存场景的键值查找',
        ],
      },
      overallWinner,
      recommendations: this.generateRecommendations(queryResults, overallWinner),
    };
  }

  private generateRecommendations(queryResults: QueryResult[], overallWinner: string): string[] {
    const recommendations: string[] = [];
    const hasRangeQueries = queryResults.some(r => r.queryType === 'range' || r.queryType === 'prefix');
    const hasEqualityOnly = queryResults.every(r => r.queryType === 'equality' || r.queryType === 'insert' || r.queryType === 'delete');

    if (overallWinner === 'bplus') {
      recommendations.push('B+ 树索引在本次实验中表现更佳，推荐使用 B+ 树索引');
    } else if (overallWinner === 'hash') {
      recommendations.push('哈希索引在本次实验中表现更佳，推荐使用哈希索引');
    }

    if (hasRangeQueries) {
      recommendations.push('存在范围查询或前缀查询，必须使用 B+ 树索引（哈希索引不支持范围查询）');
    }

    if (hasEqualityOnly && !hasRangeQueries) {
      recommendations.push('查询全部为等值查询，哈希索引可能是更好的选择');
    }

    const bplusConflicts = queryResults.reduce((sum, r) => sum + r.bplusResult.stats.bucketConflicts, 0);
    const hashConflicts = queryResults.reduce((sum, r) => sum + r.hashResult.stats.bucketConflicts, 0);

    if (hashConflicts > bplusConflicts * 2) {
      recommendations.push('哈希索引冲突次数较高，考虑增加哈希桶数量或调整负载因子');
    }

    return recommendations;
  }

  getBPlusVisualization(): BPlusTreeVisualization {
    return this.bplusIndex.getVisualization();
  }

  getHashVisualization(): HashVisualization {
    return this.hashIndex.getVisualization();
  }

  getTableData(): TableData {
    return this.tableData;
  }

  getIndexStats(): { bplus: any; hash: any } {
    return {
      bplus: this.bplusIndex.getStats(),
      hash: this.hashIndex.getStats(),
    };
  }
}
