import { Command } from 'commander';
import { loadStore, saveStore } from '../utils/store';
import { Review } from '../types';

export function registerReviewCommand(program: Command): void {
  program
    .command('review <abnormalId>')
    .description('登记人工复核')
    .requiredOption('-n, --note <note>', '复核备注')
    .option('-r, --reviewer <reviewer>', '复核人', 'system')
    .action((abnormalId, options) => {
      const store = loadStore();
      
      const abnormalIndex = store.abnormals.findIndex((a) => a.id === abnormalId);
      
      if (abnormalIndex === -1) {
        console.error(`未找到异常记录: ${abnormalId}`);
        process.exit(1);
      }
      
      const abnormal = store.abnormals[abnormalIndex];
      const now = new Date().toISOString();
      
      abnormal.reviewed = true;
      abnormal.reviewedBy = options.reviewer;
      abnormal.reviewedAt = now;
      abnormal.reviewNote = options.note;
      
      const review: Review = {
        abnormalId,
        trackingNo: abnormal.trackingNo,
        reviewer: options.reviewer,
        note: options.note,
        reviewedAt: now,
      };
      
      store.reviews.push(review);
      saveStore(store);
      
      console.log(`\n复核完成！`);
      console.log(`异常ID: ${abnormalId}`);
      console.log(`运单号: ${abnormal.trackingNo}`);
      console.log(`复核人: ${options.reviewer}`);
      console.log(`复核备注: ${options.note}`);
    });
}
