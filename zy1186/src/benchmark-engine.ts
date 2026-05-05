import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { 
  TableSchema, 
  WorkloadRecord, 
  WriteConfig, 
  BenchmarkResult,
  StrategyType 
} from './types';

export interface BenchmarkConfig {
  transactionMode: 'single' | 'batch';
  batchSize: number;
  journalMode: 'DELETE' | 'WAL' | 'MEMORY' | 'OFF';
  connectionMode: 'reuse' | 'reopen';
  statementMode: 'direct' | 'prepared';
  indexMode: 'none' | 'normal' | 'extra';
}

const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  transactionMode: 'batch',
  batchSize: 1000,
  journalMode: 'WAL',
  connectionMode: 'reuse',
  statementMode: 'prepared',
  indexMode: 'normal',
};

export class BenchmarkEngine {
  private tables: TableSchema[];
  private records: WorkloadRecord[];
  private config: WriteConfig;
  private tempDir: string;

  constructor(
    tables: TableSchema[],
    records: WorkloadRecord[],
    config: WriteConfig
  ) {
    this.tables = tables;
    this.records = records;
    this.config = config;
    this.tempDir = this.createTempDirectory();
  }

  private createTempDirectory(): string {
    const tempDir = path.join(process.cwd(), '.temp-sqlite-opt');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
  }

  cleanup(): void {
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    }
  }

  async runAllStrategies(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const transactionMode of this.config.strategies.transactionModes) {
      const result = await this.runBenchmark('transaction', {
        ...DEFAULT_BENCHMARK_CONFIG,
        transactionMode,
      });
      results.push(result);
    }

    for (const batchSize of this.config.strategies.batchSizes) {
      const result = await this.runBenchmark('batch', {
        ...DEFAULT_BENCHMARK_CONFIG,
        batchSize,
      });
      results.push(result);
    }

    for (const journalMode of this.config.strategies.journalModes) {
      const result = await this.runBenchmark('journal', {
        ...DEFAULT_BENCHMARK_CONFIG,
        journalMode: journalMode as 'DELETE' | 'WAL' | 'MEMORY' | 'OFF',
      });
      results.push(result);
    }

    for (const connectionMode of this.config.strategies.connectionModes) {
      const result = await this.runBenchmark('connection', {
        ...DEFAULT_BENCHMARK_CONFIG,
        connectionMode,
      });
      results.push(result);
    }

    for (const statementMode of this.config.strategies.statementModes) {
      const result = await this.runBenchmark('statement', {
        ...DEFAULT_BENCHMARK_CONFIG,
        statementMode,
      });
      results.push(result);
    }

    if (this.config.indexAnalysis.enable) {
      if (this.config.indexAnalysis.testWithoutIndexes) {
        const result = await this.runBenchmark('index', {
          ...DEFAULT_BENCHMARK_CONFIG,
          indexMode: 'none',
        });
        results.push(result);
      }

      const normalResult = await this.runBenchmark('index', {
        ...DEFAULT_BENCHMARK_CONFIG,
        indexMode: 'normal',
      });
      results.push(normalResult);

      if (this.config.indexAnalysis.testWithExtraIndexes) {
        const extraResult = await this.runBenchmark('index', {
          ...DEFAULT_BENCHMARK_CONFIG,
          indexMode: 'extra',
        });
        results.push(extraResult);
      }
    }

    return results;
  }

  private async runBenchmark(
    strategyType: StrategyType,
    config: BenchmarkConfig
  ): Promise<BenchmarkResult> {
    const strategyName = this.getStrategyName(strategyType, config);

    console.log(`  运行基准测试: ${strategyName}...`);

    const times: number[] = [];

    for (let i = 0; i < this.config.benchmark.warmupRuns; i++) {
      await this.runSingleTest(config);
    }

    for (let i = 0; i < this.config.benchmark.testRuns; i++) {
      const time = await this.runSingleTest(config);
      times.push(time);
    }

    const avgTimeMs = times.reduce((a, b) => a + b, 0) / times.length;
    const totalRecords = this.records.length;
    const avgTimePerRecordMs = avgTimeMs / totalRecords;
    const recordsPerSecond = (totalRecords / avgTimeMs) * 1000;

    const dbPath = path.join(this.tempDir, `test-${Date.now()}.db`);
    let fileSizeAfter = 0;

    try {
      const db = this.createDatabase(dbPath, config);
      this.executeWorkload(db, config);
      if (fs.existsSync(dbPath)) {
        fileSizeAfter = fs.statSync(dbPath).size;
      }
      db.close();
    } catch (e) {
      // Ignore errors here
    } finally {
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
      const walPath = dbPath + '-wal';
      const shmPath = dbPath + '-shm';
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    }

    return {
      strategy: strategyName,
      strategyType,
      config: {
        transactionMode: config.transactionMode,
        batchSize: config.batchSize,
        journalMode: config.journalMode,
        connectionMode: config.connectionMode,
        statementMode: config.statementMode,
        indexMode: config.indexMode,
      },
      metrics: {
        totalTimeMs: avgTimeMs,
        avgTimePerRecordMs,
        recordsPerSecond,
        fileSizeAfter,
      },
    };
  }

  private getStrategyName(type: StrategyType, config: BenchmarkConfig): string {
    switch (type) {
      case 'transaction':
        return config.transactionMode === 'single' 
          ? '逐条提交 (每次插入独立事务)' 
          : '批量事务 (批量提交)';
      case 'batch':
        return `批量大小: ${config.batchSize}`;
      case 'journal':
        return `Journal 模式: ${config.journalMode}`;
      case 'connection':
        return config.connectionMode === 'reuse'
          ? '连接复用 (保持连接)'
          : '反复开连接 (每次操作重连)';
      case 'statement':
        return config.statementMode === 'prepared'
          ? '预编译语句'
          : '普通 SQL 语句';
      case 'index':
        if (config.indexMode === 'none') return '无索引';
        if (config.indexMode === 'extra') return '额外索引';
        return '正常索引';
      default:
        return '未知策略';
    }
  }

  private async runSingleTest(config: BenchmarkConfig): Promise<number> {
    const dbPath = path.join(this.tempDir, `test-${Date.now()}-${Math.random()}.db`);
    const startTime = process.hrtime();

    try {
      if (config.connectionMode === 'reuse') {
        const db = this.createDatabase(dbPath, config);
        this.executeWorkload(db, config);
        db.close();
      } else {
        this.executeWorkloadWithReopen(dbPath, config);
      }
    } catch (error) {
      console.error(`    测试执行错误: ${(error as Error).message}`);
      throw error;
    } finally {
      if (fs.existsSync(dbPath)) {
        try { fs.unlinkSync(dbPath); } catch (e) { /* ignore */ }
      }
      const walPath = dbPath + '-wal';
      const shmPath = dbPath + '-shm';
      if (fs.existsSync(walPath)) try { fs.unlinkSync(walPath); } catch (e) { /* ignore */ }
      if (fs.existsSync(shmPath)) try { fs.unlinkSync(shmPath); } catch (e) { /* ignore */ }
    }

    const endTime = process.hrtime(startTime);
    return endTime[0] * 1000 + endTime[1] / 1000000;
  }

  private createDatabase(dbPath: string, config: BenchmarkConfig): Database.Database {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    const db = new Database(dbPath);

    db.pragma(`journal_mode = ${config.journalMode}`);
    db.pragma('synchronous = NORMAL');
    db.pragma('temp_store = MEMORY');
    db.pragma('cache_size = 10000');
    db.pragma('locking_mode = NORMAL');

    this.createTables(db, config);

    return db;
  }

  private createTables(db: Database.Database, config: BenchmarkConfig): void {
    for (const table of this.tables) {
      db.exec(table.createStatement);

      if (config.indexMode !== 'none') {
        for (const index of table.indexes) {
          if (!index.isPrimary) {
            const unique = index.isUnique ? 'UNIQUE' : '';
            const indexStmt = `CREATE ${unique} INDEX IF NOT EXISTS ${index.name} ON ${table.name}(${index.columns.join(', ')})`;
            db.exec(indexStmt);
          }
        }
      }

      if (config.indexMode === 'extra' && this.config.indexAnalysis.extraIndexColumns.length > 0) {
        for (const column of this.config.indexAnalysis.extraIndexColumns) {
          const tableColumn = table.columns.find(c => c.name === column);
          if (tableColumn) {
            const indexName = `idx_extra_${table.name}_${column}`;
            const indexStmt = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${table.name}(${column})`;
            db.exec(indexStmt);
          }
        }
      }
    }
  }

  private executeWorkload(db: Database.Database, config: BenchmarkConfig): void {
    const preparedStatements = new Map<string, Database.Statement>();

    if (config.transactionMode === 'batch') {
      this.executeInBatches(db, config, preparedStatements);
    } else {
      this.executeSingleTransactions(db, config, preparedStatements);
    }
  }

  private executeInBatches(
    db: Database.Database,
    config: BenchmarkConfig,
    preparedStatements: Map<string, Database.Statement>
  ): void {
    const transaction = db.transaction((records: WorkloadRecord[]) => {
      for (const record of records) {
        this.executeRecord(db, record, config, preparedStatements);
      }
    });

    for (let i = 0; i < this.records.length; i += config.batchSize) {
      const batch = this.records.slice(i, i + config.batchSize);
      transaction(batch);
    }
  }

  private executeSingleTransactions(
    db: Database.Database,
    config: BenchmarkConfig,
    preparedStatements: Map<string, Database.Statement>
  ): void {
    for (const record of this.records) {
      const transaction = db.transaction(() => {
        this.executeRecord(db, record, config, preparedStatements);
      });
      transaction();
    }
  }

  private executeWorkloadWithReopen(dbPath: string, config: BenchmarkConfig): void {
    for (let i = 0; i < this.records.length; i++) {
      const db = new Database(dbPath);
      
      try {
        if (config.transactionMode === 'single') {
          const transaction = db.transaction(() => {
            this.executeRecordDirect(db, this.records[i]);
          });
          transaction();
        } else {
          this.executeRecordDirect(db, this.records[i]);
        }
      } finally {
        db.close();
      }
    }
  }

  private executeRecord(
    db: Database.Database,
    record: WorkloadRecord,
    config: BenchmarkConfig,
    preparedStatements: Map<string, Database.Statement>
  ): void {
    if (config.statementMode === 'prepared') {
      this.executeRecordPrepared(db, record, preparedStatements);
    } else {
      this.executeRecordDirect(db, record);
    }
  }

  private executeRecordPrepared(
    db: Database.Database,
    record: WorkloadRecord,
    preparedStatements: Map<string, Database.Statement>
  ): void {
    const cacheKey = `${record.operation}:${record.table}`;
    let stmt = preparedStatements.get(cacheKey);

    if (!stmt) {
      const sql = this.buildSQL(record);
      stmt = db.prepare(sql);
      preparedStatements.set(cacheKey, stmt);
    }

    const params = this.buildParams(record);
    stmt.run(params);
  }

  private executeRecordDirect(
    db: Database.Database,
    record: WorkloadRecord
  ): void {
    const sql = this.buildSQL(record);
    const params = this.buildParams(record);
    db.exec(sql.replace(/\?/g, (match) => {
      const param = params.shift();
      if (param === null || param === undefined) return 'NULL';
      if (typeof param === 'string') return `'${param.replace(/'/g, "''")}'`;
      return String(param);
    }));
  }

  private buildSQL(record: WorkloadRecord): string {
    const columns = Object.keys(record.data);

    switch (record.operation) {
      case 'INSERT':
        const placeholders = columns.map(() => '?').join(', ');
        return `INSERT INTO ${record.table} (${columns.join(', ')}) VALUES (${placeholders})`;

      case 'UPSERT':
        const updateParts = columns.map(c => `${c} = excluded.${c}`).join(', ');
        return `INSERT INTO ${record.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')}) ON CONFLICT DO UPDATE SET ${updateParts}`;

      case 'UPDATE':
        if (!record.where) {
          throw new Error('UPDATE 操作需要 WHERE 条件');
        }
        const setParts = columns.map(c => `${c} = ?`).join(', ');
        const whereParts = Object.keys(record.where).map(k => `${k} = ?`).join(' AND ');
        return `UPDATE ${record.table} SET ${setParts} WHERE ${whereParts}`;

      case 'DELETE':
        if (!record.where) {
          throw new Error('DELETE 操作需要 WHERE 条件');
        }
        const delWhereParts = Object.keys(record.where).map(k => `${k} = ?`).join(' AND ');
        return `DELETE FROM ${record.table} WHERE ${delWhereParts}`;

      default:
        throw new Error(`不支持的操作类型: ${record.operation}`);
    }
  }

  private buildParams(record: WorkloadRecord): any[] {
    const params: any[] = [];

    for (const value of Object.values(record.data)) {
      params.push(value);
    }

    if (record.where) {
      for (const value of Object.values(record.where)) {
        params.push(value);
      }
    }

    return params;
  }
}
