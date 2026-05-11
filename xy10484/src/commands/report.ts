import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { loadStore, saveStore } from '../utils/store';
import { analyzeAbnormals, analyzeIssues, ABNORMAL_TYPE_LABELS, ISSUE_TYPE_LABELS } from '../core/analyzer';

export function registerReportCommand(program: Command): void {
  program
    .command('report')
    .description('重新生成异常报告')
    .option('--force', '清除现有异常和问题，重新分析')
    .option('-o, --output <file>', '输出报告文件路径')
    .option('--json', '以 JSON 格式输出')
    .action((options) => {
      const store = loadStore();
      
      if (options.force) {
        store.abnormals = [];
        store.issues = [];
        saveStore(store);
      }
      
      const newAbnormals = analyzeAbnormals(store);
      const newIssues = analyzeIssues(store);
      
      store.abnormals.push(...newAbnormals);
      store.issues.push(...newIssues);
      saveStore(store);
      
      if (options.json) {
        const report = {
          generatedAt: new Date().toISOString(),
          summary: {
            totalAbnormals: store.abnormals.length,
            pendingAbnormals: store.abnormals.filter((a) => !a.reviewed).length,
            reviewedAbnormals: store.abnormals.filter((a) => a.reviewed).length,
            totalIssues: store.issues.length,
          },
          abnormals: store.abnormals,
          issues: store.issues,
        };
        
        const jsonOutput = JSON.stringify(report, null, 2);
        
        if (options.output) {
          fs.writeFileSync(path.resolve(options.output), jsonOutput, 'utf-8');
          console.log(`报告已保存到: ${options.output}`);
        } else {
          console.log(jsonOutput);
        }
        return;
      }
      
      console.log('\n========================================');
      console.log('物流签收异常报告');
      console.log(`生成时间: ${new Date().toISOString()}`);
      console.log('========================================\n');
      
      const totalAbnormals = store.abnormals.length;
      const pendingAbnormals = store.abnormals.filter((a) => !a.reviewed).length;
      const reviewedAbnormals = store.abnormals.filter((a) => a.reviewed).length;
      const totalIssues = store.issues.length;
      
      console.log('【统计概览】');
      console.log(`  异常总数: ${totalAbnormals}`);
      console.log(`  待处理: ${pendingAbnormals}`);
      console.log(`  已复核: ${reviewedAbnormals}`);
      console.log(`  问题总数: ${totalIssues}`);
      console.log('');
      
      const abnormalByType: Record<string, number> = {};
      for (const abnormal of store.abnormals) {
        const label = ABNORMAL_TYPE_LABELS[abnormal.type];
        abnormalByType[label] = (abnormalByType[label] || 0) + 1;
      }
      
      console.log('【异常类型分布】');
      for (const [type, count] of Object.entries(abnormalByType)) {
        console.log(`  ${type}: ${count} 条`);
      }
      console.log('');
      
      const issueByType: Record<string, number> = {};
      for (const issue of store.issues) {
        const label = ISSUE_TYPE_LABELS[issue.type];
        issueByType[label] = (issueByType[label] || 0) + 1;
      }
      
      console.log('【问题类型分布】');
      for (const [type, count] of Object.entries(issueByType)) {
        console.log(`  ${type}: ${count} 条`);
      }
      console.log('');
      
      console.log('【异常列表】');
      if (store.abnormals.length === 0) {
        console.log('  暂无异常');
      } else {
        for (const abnormal of store.abnormals) {
          const status = abnormal.reviewed ? '[已复核]' : '[待处理]';
          console.log(`\n${status} [${ABNORMAL_TYPE_LABELS[abnormal.type]}]`);
          console.log(`  运单号: ${abnormal.trackingNo}`);
          console.log(`  订单号: ${abnormal.orderNo}`);
          console.log(`  描述: ${abnormal.description}`);
        }
      }
      console.log('');
      
      console.log('【问题列表】');
      if (store.issues.length === 0) {
        console.log('  暂无问题');
      } else {
        for (const issue of store.issues) {
          console.log(`\n[${ISSUE_TYPE_LABELS[issue.type]}]`);
          if (issue.trackingNo) {
            console.log(`  运单号: ${issue.trackingNo}`);
          }
          console.log(`  描述: ${issue.description}`);
        }
      }
      
      if (options.output) {
        const report = {
          generatedAt: new Date().toISOString(),
          summary: {
            totalAbnormals,
            pendingAbnormals,
            reviewedAbnormals,
            totalIssues,
            abnormalByType,
            issueByType,
          },
          abnormals: store.abnormals,
          issues: store.issues,
        };
        fs.writeFileSync(path.resolve(options.output), JSON.stringify(report, null, 2), 'utf-8');
        console.log(`\n\nJSON 报告已保存到: ${options.output}`);
      }
    });
}
