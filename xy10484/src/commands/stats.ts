import { Command } from 'commander';
import { loadStore } from '../utils/store';
import { ABNORMAL_TYPE_LABELS, ISSUE_TYPE_LABELS } from '../core/analyzer';

export function registerStatsCommand(program: Command): void {
  program
    .command('stats')
    .description('查看数据统计')
    .action(() => {
      const store = loadStore();
      
      console.log('\n========================================');
      console.log('物流签收异常 CLI - 数据统计');
      console.log('========================================\n');
      
      console.log('【基础数据');
      console.log(`  订单数量: ${store.orders.length}`);
      console.log(`  签收记录: ${store.signRecords.length}`);
      console.log(`  拒收记录: ${store.refuseRecords.length}`);
      console.log(`  赔付记录: ${store.claimRecords.length}`);
      console.log('');
      
      const pendingAbnormals = store.abnormals.filter((a) => !a.reviewed).length;
      const reviewedAbnormals = store.abnormals.filter((a) => a.reviewed).length;
      
      console.log('【异常统计');
      console.log(`  异常总数: ${store.abnormals.length}`);
      console.log(`  待处理: ${pendingAbnormals}`);
      console.log(`  已复核: ${reviewedAbnormals}`);
      
      const abnormalByType: Record<string, number> = {};
      for (const abnormal of store.abnormals) {
        const label = ABNORMAL_TYPE_LABELS[abnormal.type];
        abnormalByType[label] = (abnormalByType[label] || 0) + 1;
      }
      
      for (const [type, count] of Object.entries(abnormalByType)) {
        console.log(`    ${type}: ${count} 条`);
      }
      console.log('');
      
      console.log('【问题统计】');
      console.log(`  问题总数: ${store.issues.length}`);
      
      const issueByType: Record<string, number> = {};
      for (const issue of store.issues) {
        const label = ISSUE_TYPE_LABELS[issue.type];
        issueByType[label] = (issueByType[label] || 0) + 1;
      }
      
      for (const [type, count] of Object.entries(issueByType)) {
        console.log(`    ${type}: ${count} 条`);
      }
      console.log('');
      
      console.log('【已处理批次');
      if (store.processedBatches.length === 0) {
        console.log('  暂无');
      } else {
        for (const batch of store.processedBatches) {
          console.log(`  - ${batch}`);
        }
      }
      console.log('');
    });
}
