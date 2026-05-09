import { DatabaseService } from '../src/core/DatabaseService';
import { Logger } from '../src/logging/Logger';
import { DEFAULT_DATABASE_CONFIG } from '../src/config/default';
import { StressTestRunner } from '../src/stress/StressTestRunner';
import { join } from 'path';
import { mkdirSync } from 'fs';

const STRESS_DB_DIR = join(process.cwd(), 'stress-data');
const STRESS_DB_PATH = join(STRESS_DB_DIR, 'stress.db');

async function main() {
  console.log('=== SQLite WAL 锁冲突压测 ===\n');

  mkdirSync(STRESS_DB_DIR, { recursive: true });

  const logger = new Logger({ level: 'WARN', enableConsole: true });
  const service = new DatabaseService({
    ...DEFAULT_DATABASE_CONFIG,
    dbPath: STRESS_DB_PATH,
    maxPoolSize: 20,
  }, logger);

  const runner = new StressTestRunner(service);

  console.log('准备数据库架构...');
  await runner.setupSchema();

  console.log('插入种子数据...');
  await runner.insertSeedData(100);

  console.log('开始压测...\n');

  const configs = [
    {
      name: '低并发 - 读多写少',
      config: {
        concurrentConnections: 5,
        operationsPerConnection: 50,
        readWriteRatio: 0.9,
        transactionProbability: 0.1,
        minDelayMs: 0,
        maxDelayMs: 10,
      },
    },
    {
      name: '中等并发 - 均衡读写',
      config: {
        concurrentConnections: 10,
        operationsPerConnection: 100,
        readWriteRatio: 0.6,
        transactionProbability: 0.3,
        minDelayMs: 0,
        maxDelayMs: 20,
      },
    },
    {
      name: '高并发 - 写密集',
      config: {
        concurrentConnections: 20,
        operationsPerConnection: 100,
        readWriteRatio: 0.3,
        transactionProbability: 0.5,
        minDelayMs: 0,
        maxDelayMs: 5,
      },
    },
  ];

  const results: Array<{
    name: string;
    config: typeof configs[0]['config'];
    result: Awaited<ReturnType<StressTestRunner['run']>>;
  }> = [];

  for (const { name, config } of configs) {
    console.log(`\n--- ${name} ---`);
    console.log(`并发连接: ${config.concurrentConnections}`);
    console.log(`每连接操作数: ${config.operationsPerConnection}`);
    console.log(`读写比例: ${(config.readWriteRatio * 100).toFixed(0)}% 读 / ${((1 - config.readWriteRatio) * 100).toFixed(0)}% 写`);
    console.log(`事务概率: ${(config.transactionProbability * 100).toFixed(0)}%`);

    logger.clearLogs();

    const startTime = Date.now();
    const result = await runner.run(config);
    const duration = Date.now() - startTime;

    console.log(`\n结果:`);
    console.log(`  总操作: ${result.totalOperations}`);
    console.log(`  成功: ${result.successfulOperations}`);
    console.log(`  失败: ${result.failedOperations}`);
    console.log(`  锁冲突: ${result.lockErrors}`);
    console.log(`  成功率: ${((result.successfulOperations / result.totalOperations) * 100).toFixed(2)}%`);
    console.log(`  OPS: ${result.operationsPerSecond.toFixed(2)}`);
    console.log(`  平均延迟: ${result.avgLatencyMs.toFixed(2)} ms`);
    console.log(`  P95 延迟: ${result.p95LatencyMs.toFixed(2)} ms`);
    console.log(`  P99 延迟: ${result.p99LatencyMs.toFixed(2)} ms`);

    const stats = logger.getStatistics();
    console.log(`\n  重试次数: ${stats.retries}`);

    results.push({ name, config, result });
  }

  console.log('\n=== 汇总 ===');
  for (const { name, result } of results) {
    const successRate = ((result.successfulOperations / result.totalOperations) * 100).toFixed(2);
    console.log(`${name}: ${successRate}% 成功率, ${result.operationsPerSecond.toFixed(2)} OPS, ${result.lockErrors} 锁冲突`);
  }

  await runner.cleanup();
  service.close();

  console.log('\n压测完成!');
}

main().catch(console.error);
