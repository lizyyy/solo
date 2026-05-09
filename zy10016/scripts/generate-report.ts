import { DatabaseService } from '../src/core/DatabaseService';
import { Logger } from '../src/logging/Logger';
import { DEFAULT_DATABASE_CONFIG } from '../src/config/default';
import { CacheManager } from '../src/cache/CacheManager';
import { StateManager } from '../src/state/StateManager';
import { ReportGenerator } from '../src/report/ReportGenerator';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const REPORTS_DIR = join(process.cwd(), 'reports');

async function main() {
  console.log('=== 生成系统报告 ===\n');

  mkdirSync(REPORTS_DIR, { recursive: true });

  const logger = new Logger({ level: 'INFO', enableConsole: false });
  const service = new DatabaseService({
    ...DEFAULT_DATABASE_CONFIG,
    dbPath: join(process.cwd(), 'data', 'report.db'),
  }, logger);
  const cache = new CacheManager();
  const stateManager = new StateManager();

  console.log('执行一些测试操作以生成数据...');

  await service.run(`
    CREATE TABLE IF NOT EXISTS report_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (let i = 0; i < 10; i++) {
    await service.run(
      'INSERT INTO report_users (name, email) VALUES (?, ?)',
      [`User ${i + 1}`, `report_user_${i + 1}@test.com`]
    );
  }

  await service.get('SELECT * FROM report_users LIMIT 5');
  await service.all('SELECT * FROM report_users');

  cache.set('users:list', [{ id: 1, name: 'User 1' }], { dependencyKeys: ['users'] });
  cache.set('users:count', 10, { dependencyKeys: ['users'] });
  cache.get('users:list');
  cache.get('users:count');
  cache.get('users:missing');

  stateManager.registerResource({
    id: 'conn-1',
    type: 'CONNECTION',
    status: 'IDLE',
    lockType: 'NONE',
    holdingConnections: [],
    waitingConnections: [],
  });

  stateManager.transition('conn-1', 'READ');
  stateManager.transition('conn-1', 'COMMIT');

  console.log('生成报告...');

  const reportGenerator = new ReportGenerator();
  const report = reportGenerator.generate({
    title: 'SQLite WAL 锁冲突处理系统状态报告',
    generatedAt: new Date().toISOString(),
    systemInfo: logger.getSystemInfo(),
    loggerStats: logger.getStatistics(),
    cacheStats: cache.getStatistics(),
    conflictsReport: stateManager.getConflictsReport(),
    recentErrors: logger.getErrorLogs().slice(-10),
    recentLogs: logger.getAllLogs().slice(-20),
  });

  const reportPath = join(REPORTS_DIR, `system-report-${Date.now()}.md`);
  writeFileSync(reportPath, report, 'utf-8');

  console.log(`报告已生成: ${reportPath}`);

  service.close();
  cache.close();
}

main().catch(console.error);
