import { Command } from 'commander';
import path from 'path';
import {
  parseOrders, parseSignRecords, parseRefuseRecords, parseClaimRecords } from '../utils/parser';
import {
  importOrders as importOrdersToStore,
  importSignRecords as importSignRecordsToStore,
  importRefuseRecords as importRefuseRecordsToStore,
  importClaimRecords as importClaimRecordsToStore,
  runAnalysis
} from '../core/importer';
import { ensureStore } from '../utils/store';

export function registerImportCommand(program: Command): void {
  program
    .command('import')
    .description('导入数据文件')
    .option('-o, --orders <file>', '订单数据文件 (JSON/CSV)')
    .option('-s, --sign-records <file>', '签收记录文件 (JSON/CSV)')
    .option('-r, --refuse-records <file>', '拒收记录文件 (JSON/CSV)')
    .option('-c, --claim-records <file>', '赔付记录文件 (JSON/CSV)')
    .option('--no-analyze', '导入后不运行异常分析')
    .action(async (options) => {
      ensureStore();
      
      let ordersImported = 0;
      let signRecordsImported = 0;
      let refuseRecordsImported = 0;
      let claimRecordsImported = 0;
      let duplicateBatches: string[] = [];
      
      if (options.orders) {
        const orders = parseOrders(path.resolve(options.orders));
        ordersImported = importOrdersToStore(orders);
        console.log(`导入订单: ${ordersImported} 条`);
      }
      
      if (options.signRecords) {
        const records = parseSignRecords(path.resolve(options.signRecords));
        const result = importSignRecordsToStore(records);
        signRecordsImported = result.imported;
        duplicateBatches = result.duplicateBatches;
        console.log(`导入签收记录: ${signRecordsImported} 条`);
        if (duplicateBatches.length > 0) {
          console.log(`跳过重复批次: ${duplicateBatches.join(', ')}`);
        }
      }
      
      if (options.refuseRecords) {
        const records = parseRefuseRecords(path.resolve(options.refuseRecords));
        refuseRecordsImported = importRefuseRecordsToStore(records);
        console.log(`导入拒收记录: ${refuseRecordsImported} 条`);
      }
      
      if (options.claimRecords) {
        const records = parseClaimRecords(path.resolve(options.claimRecords));
        claimRecordsImported = importClaimRecordsToStore(records);
        console.log(`导入赔付记录: ${claimRecordsImported} 条`);
      }
      
      if (options.analyze !== false) {
        console.log('\n正在分析异常...');
        const analysisResult = runAnalysis();
        console.log(`发现新异常: ${analysisResult.newAbnormals} 条`);
        console.log(`发现新问题: ${analysisResult.newIssues} 条`);
      }
      
      console.log('\n导入完成！');
    });
}
