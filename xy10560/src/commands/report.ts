import { DataStore } from '../store/store';
import { Reporter } from '../services/reporter';
import { ActionType } from '../types';

export interface ReportOptions {
  storePath?: string;
  history?: number;
  json?: boolean;
  operator: string;
}

export function reportCommand(options: ReportOptions): void {
  const store = new DataStore(options.storePath);

  if (!store.exists()) {
    console.error('❌ 错误: 数据存储不存在，请先运行 init 命令');
    process.exit(1);
  }

  const reporter = new Reporter(store);
  const startTime = new Date();

  const report = reporter.generateReport();

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(reporter.formatReport(report));
  }

  if (options.history && options.history > 0) {
    console.log('');
    console.log('📜 最近执行记录');
    console.log('='.repeat(60));
    
    const records = store.getExecutionRecords(options.history);
    
    if (records.length === 0) {
      console.log('   暂无执行记录');
    } else {
      for (const record of records) {
        const statusEmoji = record.status === 'success' ? '✅' : 
                           record.status === 'failed' ? '❌' : '⚠️';
        console.log(`   ${statusEmoji} [${new Date(record.startedAt).toLocaleString()}] ${record.action}`);
        console.log(`      目标: ${record.targetType}${record.targetId ? ' - ' + record.targetId.slice(0, 8) : ''}`);
        console.log(`      操作者: ${record.operator}`);
        
        if (record.details.errorMessage) {
          console.log(`      错误: ${record.details.errorMessage}`);
        }
        console.log('');
      }
    }
  }

  store.addExecutionRecord({
    action: 'system_check',
    targetType: 'system',
    status: 'success',
    startedAt: startTime.toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: new Date().getTime() - startTime.getTime(),
    operator: options.operator,
    details: {
      metadata: {
        immediateCount: report.immediate.length,
        thisWeekCount: report.thisWeek.length,
        needsCoordinationCount: report.needsCoordination.length,
        completedCount: report.completed.length
      }
    }
  });
}
