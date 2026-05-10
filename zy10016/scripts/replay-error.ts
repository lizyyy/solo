import { DatabaseService } from '../src/core/DatabaseService';
import { Logger } from '../src/logging/Logger';
import { DEFAULT_DATABASE_CONFIG } from '../src/config/default';
import { ErrorReplayer } from '../src/replay/ErrorReplayer';
import { ReportGenerator } from '../src/report/ReportGenerator';
import { DatabaseConnection } from '../src/core/DatabaseConnection';
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const REPLAY_DATA_DIR = join(process.cwd(), 'replay-data');
const REPLAY_DB_PATH = join(REPLAY_DATA_DIR, 'replay.db');
const REPLAY_RECORDS_DIR = join(REPLAY_DATA_DIR, 'records');
const REPLAY_REPORTS_DIR = join(REPLAY_DATA_DIR, 'reports');

function ensureDirs() {
  mkdirSync(REPLAY_DATA_DIR, { recursive: true });
  mkdirSync(REPLAY_RECORDS_DIR, { recursive: true });
  mkdirSync(REPLAY_REPORTS_DIR, { recursive: true });
}

function cleanupOldDb(dbPath = REPLAY_DB_PATH) {
  const files = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
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

async function createConcurrentLockConflictScenario(
  service: DatabaseService,
  logger: Logger,
  concurrentCount: number = 8
): Promise<{ logs: any[]; errors: any[]; lockErrorsCount: number }> {
  console.log('\n=== 创建并发锁冲突场景 ===');

  await service.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT UNIQUE NOT NULL,
      balance REAL DEFAULT 0,
      version INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await service.run(`
    CREATE TABLE IF NOT EXISTS transfer_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transfer_id TEXT UNIQUE NOT NULL,
      from_account TEXT,
      to_account TEXT,
      amount REAL,
      status TEXT DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await service.run(
    'INSERT INTO accounts (account_id, balance) VALUES (?, ?)',
    ['ACC_001', 10000.00]
  );
  await service.run(
    'INSERT INTO accounts (account_id, balance) VALUES (?, ?)',
    ['ACC_002', 5000.00]
  );
  await service.run(
    'INSERT INTO accounts (account_id, balance) VALUES (?, ?)',
    ['ACC_003', 2000.00]
  );

  console.log('已创建测试表和初始账户:');
  console.log('  ACC_001: $10,000.00');
  console.log('  ACC_002: $5,000.00');
  console.log('  ACC_003: $2,000.00');

  logger.clearLogs();

  console.log(`\n开始模拟 ${concurrentCount} 个并发事务同时竞争账户资源...`);

  const concurrentOperations: Promise<{ success: boolean; transferId: string; error?: string }>[] = [];
  const allTransferIds = new Set<string>();

  for (let i = 0; i < concurrentCount; i++) {
    const fromAccount = i % 3 === 0 ? 'ACC_001' : i % 3 === 1 ? 'ACC_002' : 'ACC_003';
    const toAccount = fromAccount === 'ACC_001' ? 'ACC_002' : fromAccount === 'ACC_002' ? 'ACC_003' : 'ACC_001';
    const amount = Math.floor(Math.random() * 500) + 100;
    const transferId = `TX_${uuidv4().slice(0, 8)}`;
    allTransferIds.add(transferId);

    concurrentOperations.push(
      (async () => {
        try {
          await service.transaction(async (tx) => {
            const account = tx.get<{ balance: number; version: number }>(
              'SELECT balance, version FROM accounts WHERE account_id = ?',
              [fromAccount]
            );

            if (!account || account.balance < amount) {
              throw new Error('余额不足');
            }

            tx.run(
              'UPDATE accounts SET balance = balance - ?, version = version + 1 WHERE account_id = ? AND version = ?',
              [amount, fromAccount, account.version]
            );

            tx.run(
              'UPDATE accounts SET balance = balance + ?, version = version + 1 WHERE account_id = ?',
              [amount, toAccount]
            );

            tx.run(
              'INSERT INTO transfer_logs (transfer_id, from_account, to_account, amount, status) VALUES (?, ?, ?, ?, ?)',
              [transferId, fromAccount, toAccount, amount, 'SUCCESS']
            );
          });
          return { success: true, transferId };
        } catch (error) {
          const err = error as { message?: string; code?: string };
          return { success: false, transferId, error: err.message || 'Unknown error' };
        }
      })()
    );
  }

  const results = await Promise.all(concurrentOperations);

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n并发操作结果:`);
  console.log(`  成功: ${successful}`);
  console.log(`  失败: ${failed}`);

  const logs = logger.getAllLogs();
  const errors = logger.getErrorLogs();
  const lockErrors = logger.getLockErrors();

  console.log(`\n日志统计:`);
  console.log(`  总操作日志: ${logs.length} 条`);
  console.log(`  错误日志: ${errors.length} 条`);
  console.log(`  锁冲突错误: ${lockErrors.length} 条`);

  if (lockErrors.length > 0) {
    console.log('\n✅ 成功产生了锁冲突错误!');
    lockErrors.slice(0, 3).forEach((err, i) => {
      console.log(`  ${i + 1}. [${err.error?.code || 'LOCK_ERROR'}] ${err.error?.message?.substring(0, 80)}`);
    });
  }

  const finalLogs = logger.getAllLogs();
  const finalErrors = logger.getErrorLogs();
  const finalLockErrors = logger.getLockErrors();

  console.log(`\n最终错误统计:`);
  console.log(`  总操作: ${finalLogs.length}`);
  console.log(`  错误: ${finalErrors.length}`);
  console.log(`  锁冲突: ${finalLockErrors.length}`);

  return { logs: finalLogs, errors: finalErrors, lockErrorsCount: finalLockErrors.length };
}

async function simulateManualLockConflict(
  baseDbPath: string,
  logger: Logger
): Promise<{ logs: any[]; errors: any[]; dbState: any }> {
  console.log('\n=== 模拟锁冲突（手动方式）===');
  
  const conflictDbPath = join(REPLAY_DATA_DIR, 'conflict-simulation.db');
  cleanupOldDb(conflictDbPath);

  const config = {
    ...DEFAULT_DATABASE_CONFIG,
    dbPath: conflictDbPath,
    busyTimeout: 100,
    maxPoolSize: 20,
  };

  const service1 = new DatabaseService(config, logger);
  const service2 = new DatabaseService(config, logger);

  await service1.run(`
    CREATE TABLE critical_resource (
      id INTEGER PRIMARY KEY,
      resource_name TEXT UNIQUE NOT NULL,
      counter INTEGER DEFAULT 0
    )
  `);

  await service1.run(
    'INSERT INTO critical_resource (resource_name, counter) VALUES (?, ?)',
    ['shared_resource', 0]
  );

  console.log('已创建共享资源表');

  logger.clearLogs();

  let lockErrorDetected = false;

  const slowOperation = service1.transaction(async (tx) => {
    tx.run('UPDATE critical_resource SET counter = counter + 1 WHERE resource_name = ?', ['shared_resource']);
    
    await new Promise(r => setTimeout(r, 200));
    
    tx.run('UPDATE critical_resource SET counter = counter + 1 WHERE resource_name = ?', ['shared_resource']);
  }).catch(err => {
    console.log('事务1出错:', err.message);
    if (err.message?.includes('locked') || err.code?.includes('BUSY')) {
      lockErrorDetected = true;
    }
  });

  await new Promise(r => setTimeout(r, 50));

  const fastOperation = service2.transaction(async (tx) => {
    tx.run('UPDATE critical_resource SET counter = counter + 100 WHERE resource_name = ?', ['shared_resource']);
  }).catch(err => {
    console.log('事务2出错:', err.message);
    if (err.message?.includes('locked') || err.code?.includes('BUSY') || err.code?.includes('LOCKED')) {
      lockErrorDetected = true;
    }
  });

  await Promise.all([slowOperation, fastOperation]).catch(() => {});

  if (lockErrorDetected) {
    console.log('\n✅ 手动模拟锁冲突成功!');
  }

  service1.close();
  service2.close();

  const logs = logger.getAllLogs();
  const errors = logger.getErrorLogs();

  return { logs, errors, dbState: { journalMode: 'WAL', busyTimeout: 100 } };
}

async function main() {
  console.log('=== SQLite WAL 锁冲突错误回放系统 ===\n');
  console.log('目标：模拟并复现 database is locked 类问题\n');

  ensureDirs();
  cleanupOldDb();

  const logger = new Logger({ level: 'INFO', enableConsole: true });
  
  const mainService = new DatabaseService({
    ...DEFAULT_DATABASE_CONFIG,
    dbPath: REPLAY_DB_PATH,
    maxPoolSize: 10,
  }, logger);

  const replayer = new ErrorReplayer(REPLAY_DB_PATH);
  const reportGenerator = new ReportGenerator();

  try {
    const { logs, errors, lockErrorsCount } = await createConcurrentLockConflictScenario(
      mainService,
      logger,
      12
    );

    const dbState = mainService.getDatabaseStateSnapshot();

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

    console.log('\n=== 创建回放记录 ===');

    const record = replayer.createRecord(
      logs,
      dbState,
      errorContext
    );

    const recordPath = join(REPLAY_RECORDS_DIR, `record-${record.id}.json`);
    writeFileSync(recordPath, JSON.stringify(record, null, 2), 'utf-8');
    console.log(`回放记录已保存: ${recordPath}`);
    console.log(`记录包含: ${record.logEntries.length} 个操作, ${record.errorContext ? '含错误上下文' : '无错误上下文'}`);

    console.log('\n=== 开始错误回放 ===');

    cleanupOldDb();
    
    const replayService = new DatabaseService({
      ...DEFAULT_DATABASE_CONFIG,
      dbPath: REPLAY_DB_PATH,
      maxPoolSize: 10,
    }, new Logger({ level: 'ERROR', enableConsole: false }));

    await replayService.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT UNIQUE NOT NULL,
        balance REAL DEFAULT 0,
        version INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await replayService.run(`
      CREATE TABLE IF NOT EXISTS transfer_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_id TEXT UNIQUE NOT NULL,
        from_account TEXT,
        to_account TEXT,
        amount REAL,
        status TEXT DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await replayService.run(
      'INSERT INTO accounts (account_id, balance) VALUES (?, ?)',
      ['ACC_001', 10000.00]
    );
    await replayService.run(
      'INSERT INTO accounts (account_id, balance) VALUES (?, ?)',
      ['ACC_002', 5000.00]
    );
    await replayService.run(
      'INSERT INTO accounts (account_id, balance) VALUES (?, ?)',
      ['ACC_003', 2000.00]
    );

    console.log('\n--- 模式 1: 顺序回放 (SEQUENTIAL) ---');
    const sequentialResult = await replayer.replay(
      record.id,
      replayService,
      {
        mode: 'SEQUENTIAL',
        stopOnError: false,
        regenerateUniqueValues: true,
      }
    );

    console.log(`回放状态: ${sequentialResult.status}`);
    console.log(`执行操作: ${sequentialResult.operationsExecuted}`);
    console.log(`失败操作: ${sequentialResult.operationsFailed}`);
    console.log(`锁冲突错误: ${sequentialResult.errors.filter(e => e.isLockError).length}`);
    console.log(`总耗时: ${sequentialResult.totalDurationMs}ms`);

    if (sequentialResult.matchedOriginalError) {
      console.log('✅ 成功复现原始错误!');
    } else if (sequentialResult.errors.length > 0) {
      console.log('⚠️  回放过程中出现错误:');
      sequentialResult.errors.slice(0, 5).forEach((e, i) => {
        console.log(`  ${i + 1}. [${e.isLockError ? '🔒 锁冲突' : '❌ 其他'}] ${e.message?.substring(0, 100)}`);
      });
    }

    console.log('\n--- 模式 2: 并行回放 (PARALLEL) [更易触发锁冲突] ---');
    replayService.close();
    cleanupOldDb();
    
    const parallelService = new DatabaseService({
      ...DEFAULT_DATABASE_CONFIG,
      dbPath: REPLAY_DB_PATH,
      maxPoolSize: 10,
    }, new Logger({ level: 'ERROR', enableConsole: false }));

    await parallelService.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT UNIQUE NOT NULL,
        balance REAL DEFAULT 0,
        version INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await parallelService.run(`
      CREATE TABLE IF NOT EXISTS transfer_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_id TEXT UNIQUE NOT NULL,
        from_account TEXT,
        to_account TEXT,
        amount REAL,
        status TEXT DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await parallelService.run(
      'INSERT INTO accounts (account_id, balance) VALUES (?, ?)',
      ['ACC_001', 10000.00]
    );
    await parallelService.run(
      'INSERT INTO accounts (account_id, balance) VALUES (?, ?)',
      ['ACC_002', 5000.00]
    );
    await parallelService.run(
      'INSERT INTO accounts (account_id, balance) VALUES (?, ?)',
      ['ACC_003', 2000.00]
    );

    const parallelResult = await replayer.replay(
      record.id,
      parallelService,
      {
        mode: 'PARALLEL',
        stopOnError: false,
        maxParallelOperations: 6,
        regenerateUniqueValues: true,
      }
    );

    console.log(`回放状态: ${parallelResult.status}`);
    console.log(`执行操作: ${parallelResult.operationsExecuted}`);
    console.log(`失败操作: ${parallelResult.operationsFailed}`);
    console.log(`锁冲突错误: ${parallelResult.errors.filter(e => e.isLockError).length}`);
    console.log(`总耗时: ${parallelResult.totalDurationMs}ms`);

    parallelService.close();

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
      console.log(`  - ${r.id.slice(0, 12)}... (${r.logEntries.length} 操作, ${r.errorContext ? '含错误上下文' : '无错误上下文'})`);
    });

    console.log('\n=== 结果汇总 ===');
    const finalLockErrors = logger.getLockErrors();
    if (finalLockErrors.length > 0 || lockErrorsCount > 0) {
      console.log('✅ 成功产生并捕获锁冲突错误!');
      console.log(`   原始锁冲突: ${lockErrorsCount} 个`);
      console.log(`   回放产生错误: ${sequentialResult.errors.length} 个`);
      console.log('\n系统已具备复现 database is locked 问题的能力。');
    } else {
      console.log('⚠️  本次运行未产生明显锁冲突');
      console.log('   锁冲突的产生依赖于特定的并发时序。');
      console.log('   你可以多次运行此脚本或增加并发数来触发锁冲突。');
    }

  } finally {
    mainService.close();
    cleanupOldDb();
  }
}

main().catch(console.error);
