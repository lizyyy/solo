import { DatabaseService } from '../src/core/DatabaseService';
import { Logger } from '../src/logging/Logger';
import { DEFAULT_DATABASE_CONFIG } from '../src/config/default';
import { ErrorReplayer, ReplayMode } from '../src/replay/ErrorReplayer';
import { ReportGenerator } from '../src/report/ReportGenerator';
import { mkdirSync, writeFileSync, existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const REPLAY_DATA_DIR = join(process.cwd(), 'replay-data');
const REPLAY_DB_PATH = join(REPLAY_DATA_DIR, 'replay.db');
const REPLAY_RECORDS_DIR = join(REPLAY_DATA_DIR, 'records');
const REPLAY_REPORTS_DIR = join(REPLAY_DATA_DIR, 'reports');

function ensureDirs() {
  mkdirSync(REPLAY_DATA_DIR, { recursive: true });
  mkdirSync(REPLAY_RECORDS_DIR, { recursive: true });
  mkdirSync(REPLAY_REPORTS_DIR, { recursive: true });
}

function cleanupOldDb() {
  const files = [REPLAY_DB_PATH, `${REPLAY_DB_PATH}-wal`, `${REPLAY_DB_PATH}-shm`];
  for (const file of files) {
    if (existsSync(file)) {
      try {
        unlinkSync(file);
      } catch {
        // ignore
      }
    }
  }
}

async function createTestErrorScenario(service: DatabaseService, logger: Logger) {
  console.log('\n=== 创建测试错误场景 ===');

  await service.run(`
    CREATE TABLE IF NOT EXISTS test_transfer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      balance REAL DEFAULT 0,
      version INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await service.run(`
    CREATE TABLE IF NOT EXISTS test_transfer_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_account TEXT,
      to_account TEXT,
      amount REAL,
      status TEXT DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await service.run(
    'INSERT INTO test_transfer (account_id, balance) VALUES (?, ?)',
    ['ACCOUNT_A', 1000.00]
  );
  await service.run(
    'INSERT INTO test_transfer (account_id, balance) VALUES (?, ?)',
    ['ACCOUNT_B', 500.00]
  );

  console.log('已创建测试表和初始数据');
  console.log('ACCOUNT_A: $1000.00');
  console.log('ACCOUNT_B: $500.00');

  logger.clearLogs();

  console.log('\n执行一系列操作以生成日志...');

  await service.get(
    'SELECT * FROM test_transfer WHERE account_id = ?',
    ['ACCOUNT_A']
  );

  await service.transaction(async (tx) => {
    tx.run(
      'UPDATE test_transfer SET balance = balance - ?, version = version + 1 WHERE account_id = ?',
      [100.00, 'ACCOUNT_A']
    );

    tx.run(
      'UPDATE test_transfer SET balance = balance + ?, version = version + 1 WHERE account_id = ?',
      [100.00, 'ACCOUNT_B']
    );

    tx.run(
      'INSERT INTO test_transfer_log (from_account, to_account, amount, status) VALUES (?, ?, ?, ?)',
      ['ACCOUNT_A', 'ACCOUNT_B', 100.00, 'SUCCESS']
    );
  });

  await service.all('SELECT * FROM test_transfer');

  try {
    await service.run(
      'INSERT INTO test_transfer (account_id, balance) VALUES (?, ?)',
      ['ACCOUNT_A', 2000.00]
    );
  } catch (error) {
    console.log('预期错误（唯一约束）已捕获');
  }

  const logs = logger.getAllLogs();
  const errors = logger.getErrorLogs();

  console.log(`\n生成的操作日志: ${logs.length} 条`);
  console.log(`生成的错误日志: ${errors.length} 条`);

  return { logs, errors };
}

async function main() {
  console.log('=== SQLite WAL 锁冲突错误回放系统 ===\n');

  ensureDirs();
  cleanupOldDb();

  const logger = new Logger({ level: 'DEBUG', enableConsole: true });
  const service = new DatabaseService({
    ...DEFAULT_DATABASE_CONFIG,
    dbPath: REPLAY_DB_PATH,
    maxPoolSize: 10,
  }, logger);

  const replayer = new ErrorReplayer(REPLAY_DB_PATH);
  const reportGenerator = new ReportGenerator();

  try {
    const { logs, errors } = await createTestErrorScenario(service, logger);

    console.log('\n=== 创建回放记录 ===');

    const dbState = service.getDatabaseStateSnapshot();

    let errorContext = undefined;
    if (errors.length > 0) {
      const lastError = errors[errors.length - 1];
      errorContext = {
        error: {
          message: lastError.error?.message || 'Unknown error',
          code: lastError.error?.code || 'UNKNOWN',
          stack: lastError.error?.stack,
          isLockError: lastError.error?.isLockError || false,
        },
        operationIndex: logs.findIndex(l => l.id === lastError.id),
        affectedConnections: [lastError.connectionId],
        timestamp: lastError.timestamp,
      };
    }

    const record = replayer.createRecord(
      logs,
      dbState,
      errorContext
    );

    const recordPath = join(REPLAY_RECORDS_DIR, `record-${record.id}.json`);
    writeFileSync(recordPath, JSON.stringify(record, null, 2), 'utf-8');
    console.log(`回放记录已保存: ${recordPath}`);

    console.log('\n=== 开始错误回放 ===');

    console.log('\n--- 模式 1: 顺序回放 (SEQUENTIAL) ---');
    logger.clearLogs();
    const sequentialResult = await replayer.replay(
      record.id,
      service,
      {
        mode: 'SEQUENTIAL',
        stopOnError: false,
      }
    );

    console.log(`回放状态: ${sequentialResult.status}`);
    console.log(`执行操作: ${sequentialResult.operationsExecuted}`);
    console.log(`失败操作: ${sequentialResult.operationsFailed}`);
    console.log(`总耗时: ${sequentialResult.totalDurationMs}ms`);
    if (sequentialResult.matchedOriginalError) {
      console.log('✅ 成功复现原始错误!');
    } else if (sequentialResult.errors.length > 0) {
      console.log('⚠️  回放过程中出现其他错误:');
      sequentialResult.errors.slice(0, 5).forEach((e, i) => {
        console.log(`  ${i + 1}. [${e.isLockError ? '锁冲突' : '其他'}] ${e.message}`);
      });
    }

    console.log('\n--- 模式 2: 并行回放 (PARALLEL) ---');
    cleanupOldDb();
    const service2 = new DatabaseService({
      ...DEFAULT_DATABASE_CONFIG,
      dbPath: REPLAY_DB_PATH,
      maxPoolSize: 10,
    }, new Logger({ level: 'ERROR', enableConsole: false }));

    await service2.run(`
      CREATE TABLE IF NOT EXISTS test_transfer (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL,
        balance REAL DEFAULT 0,
        version INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const parallelResult = await replayer.replay(
      record.id,
      service2,
      {
        mode: 'PARALLEL',
        stopOnError: false,
        maxParallelOperations: 5,
      }
    );

    console.log(`回放状态: ${parallelResult.status}`);
    console.log(`执行操作: ${parallelResult.operationsExecuted}`);
    console.log(`失败操作: ${parallelResult.operationsFailed}`);
    console.log(`总耗时: ${parallelResult.totalDurationMs}ms`);

    service2.close();

    console.log('\n--- 模式 3: 时间线精确回放 (TIMELINE) ---');
    cleanupOldDb();
    const service3 = new DatabaseService({
      ...DEFAULT_DATABASE_CONFIG,
      dbPath: REPLAY_DB_PATH,
      maxPoolSize: 10,
    }, new Logger({ level: 'ERROR', enableConsole: false }));

    await service3.run(`
      CREATE TABLE IF NOT EXISTS test_transfer (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL,
        balance REAL DEFAULT 0,
        version INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const timelineResult = await replayer.replay(
      record.id,
      service3,
      {
        mode: 'TIMELINE',
        stopOnError: false,
        timingAccuracy: 'APPROXIMATE',
      }
    );

    console.log(`回放状态: ${timelineResult.status}`);
    console.log(`执行操作: ${timelineResult.operationsExecuted}`);
    console.log(`失败操作: ${timelineResult.operationsFailed}`);
    console.log(`总耗时: ${timelineResult.totalDurationMs}ms`);

    service3.close();

    console.log('\n=== 生成回放报告 ===');

    const now = Date.now();
    const report = reportGenerator.generate({
      title: 'SQLite WAL 锁冲突错误回放报告',
      generatedAt: new Date().toISOString(),
      systemInfo: logger.getSystemInfo(),
      loggerStats: logger.getStatistics(),
      stressTestResult: {
        totalOperations: sequentialResult.operationsExecuted + sequentialResult.operationsFailed,
        successfulOperations: sequentialResult.operationsExecuted,
        failedOperations: sequentialResult.operationsFailed,
        lockErrors: sequentialResult.errors.filter(e => e.isLockError).length,
        avgLatencyMs: sequentialResult.totalDurationMs / Math.max(1, sequentialResult.operationsExecuted),
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        totalDurationMs: sequentialResult.totalDurationMs,
        operationsPerSecond: (sequentialResult.operationsExecuted + sequentialResult.operationsFailed) / (sequentialResult.totalDurationMs / 1000),
        errors: sequentialResult.errors.map(e => ({
          timestamp: now,
          message: e.message,
          isLockError: e.isLockError,
        })),
      },
      recentErrors: logger.getErrorLogs(),
    });

    const reportPath = join(REPLAY_REPORTS_DIR, `replay-report-${Date.now()}.md`);
    writeFileSync(reportPath, report, 'utf-8');
    console.log(`回放报告已生成: ${reportPath}`);

    console.log('\n=== 回放完成 ===');
    console.log('\n可用的回放记录:');
    replayer.getAllRecords().forEach(r => {
      console.log(`  - ${r.id} (${r.logEntries.length} 操作, ${r.errorContext ? '含错误' : '无错误'})`);
    });

  } finally {
    service.close();
    cleanupOldDb();
  }
}

main().catch(console.error);
