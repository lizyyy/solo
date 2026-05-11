import { Command } from 'commander';
import { loadStore } from '../utils/store';
import { ABNORMAL_TYPE_LABELS, ISSUE_TYPE_LABELS } from '../core/analyzer';

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('列出异常和问题')
    .option('-t, --type <type>', '类型: abnormal (异常), issue (问题), all (全部)', 'all')
    .option('--status <status>', '状态: pending (待处理), reviewed (已复核), all (全部)', 'all')
    .option('--abnormal-type <abnormalType>', '异常类型筛选')
    .option('--issue-type <issueType>', '问题类型筛选')
    .action((options) => {
      const store = loadStore();
      
      if (options.type === 'abnormal' || options.type === 'all') {
        let abnormals = [...store.abnormals];
        
        if (options.status === 'pending') {
          abnormals = abnormals.filter((a) => !a.reviewed);
        } else if (options.status === 'reviewed') {
          abnormals = abnormals.filter((a) => a.reviewed);
        }
        
        if (options.abnormalType) {
          abnormals = abnormals.filter((a) => a.type === options.abnormalType);
        }
        
        console.log('\n========================================');
        console.log(`异常列表 (共 ${abnormals.length} 条)`);
        console.log('========================================\n');
        
        if (abnormals.length === 0) {
          console.log('暂无异常记录\n');
        } else {
          for (const abnormal of abnormals) {
            const status = abnormal.reviewed ? '[已复核]' : '[待处理]';
            console.log(`${status} [${ABNORMAL_TYPE_LABELS[abnormal.type]}]`);
            console.log(`  ID: ${abnormal.id}`);
            console.log(`  运单号: ${abnormal.trackingNo}`);
            console.log(`  订单号: ${abnormal.orderNo}`);
            console.log(`  描述: ${abnormal.description}`);
            console.log(`  检测时间: ${abnormal.detectedAt}`);
            if (abnormal.reviewed) {
              console.log(`  复核人: ${abnormal.reviewedBy}`);
              console.log(`  复核时间: ${abnormal.reviewedAt}`);
              if (abnormal.reviewNote) {
                console.log(`  复核备注: ${abnormal.reviewNote}`);
              }
            }
            console.log('');
          }
        }
      }
      
      if (options.type === 'issue' || options.type === 'all') {
        let issues = [...store.issues];
        
        if (options.issueType) {
          issues = issues.filter((i) => i.type === options.issueType);
        }
        
        console.log('\n========================================');
        console.log(`问题列表 (共 ${issues.length} 条)`);
        console.log('========================================\n');
        
        if (issues.length === 0) {
          console.log('暂无问题记录\n');
        } else {
          for (const issue of issues) {
            console.log(`[${ISSUE_TYPE_LABELS[issue.type]}]`);
            console.log(`  ID: ${issue.id}`);
            if (issue.trackingNo) {
              console.log(`  运单号: ${issue.trackingNo}`);
            }
            console.log(`  来源: ${issue.source}`);
            console.log(`  描述: ${issue.description}`);
            console.log(`  检测时间: ${issue.detectedAt}`);
            console.log('');
          }
        }
      }
    });
}
