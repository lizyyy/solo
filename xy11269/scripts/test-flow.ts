import * as path from 'path';
import { InspectionService } from '../src/services/inspection-service';
import { sampleTranscriptions } from './sample-data';
import { InspectionStatus } from '../src/models/types';

const DATA_DIR = path.join(__dirname, '..', 'data');

async function runTestFlow() {
  console.log('========================================');
  console.log('🚀 客服质检系统 - 完整流程测试');
  console.log('========================================\n');

  const service = new InspectionService(DATA_DIR);

  console.log('📊 初始统计:');
  console.log(service.getStats());
  console.log();

  console.log('📥 步骤1: 导入转写记录...');
  const imported = service.importTranscriptions(sampleTranscriptions);
  console.log(`✅ 成功导入 ${imported.length} 条记录`);
  console.log();

  console.log('🔍 步骤2: 扫描所有记录进行质检...');
  const scanResult = service.scanAll();
  console.log(`✅ 扫描完成: ${scanResult.scanned} 条记录, ${scanResult.withIssues} 条有问题`);
  console.log();

  console.log('📋 步骤3: 查看待复核记录...');
  const pendingRecords = service.getRecords(InspectionStatus.PENDING_REVIEW);
  console.log(`⏳ 待复核记录: ${pendingRecords.length} 条`);
  pendingRecords.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.externalId} - ${r.agentName} - 问题数: ${r.issues.length}`);
    r.issues.forEach(issue => {
      console.log(`     - ${issue.type}: ${issue.description} (${issue.severity})`);
    });
  });
  console.log();

  console.log('✅ 步骤4: 人工复核第一条记录 (通过)...');
  if (pendingRecords.length > 0) {
    const reviewed = service.reviewRecord(pendingRecords[0].id, {
      reviewer: '质检组长',
      action: 'pass',
      notes: '确认问题属实，已通过'
    });
    console.log(`✅ 复核完成，状态: ${reviewed?.status}`);
  }
  console.log();

  console.log('❌ 步骤5: 人工复核第二条记录 (驳回)...');
  if (pendingRecords.length > 1) {
    const rejected = service.reviewRecord(pendingRecords[1].id, {
      reviewer: '质检组长',
      action: 'reject',
      notes: '问题标注不准确，需要重新扫描'
    });
    console.log(`❌ 复核完成，状态: ${rejected?.status}`);
  }
  console.log();

  console.log('📊 步骤6: 查看质检汇总...');
  const summary = service.getSummary();
  console.log('汇总报告:');
  console.log(`  总记录数: ${summary.totalRecords}`);
  console.log(`  已扫描: ${summary.scannedCount}`);
  console.log(`  待复核: ${summary.pendingReviewCount}`);
  console.log(`  已通过: ${summary.passedCount}`);
  console.log(`  已驳回: ${summary.rejectedCount}`);
  console.log(`  问题分布:`);
  console.log(`    - 缺少道歉: ${summary.issueBreakdown.missingApology}`);
  console.log(`    - 缺少退款承诺: ${summary.issueBreakdown.missingRefundPromise}`);
  console.log(`    - 敏感词: ${summary.issueBreakdown.sensitiveWord}`);
  if (summary.topSensitiveWords.length > 0) {
    console.log(`  高频敏感词:`);
    summary.topSensitiveWords.forEach(w => {
      console.log(`    - ${w.word}: ${w.count}次`);
    });
  }
  console.log();

  console.log('💾 步骤7: 导出CSV报告...');
  const exportPath = await service.exportToCsv();
  console.log(`✅ 报告已导出: ${exportPath}`);
  console.log();

  console.log('📊 最终统计:');
  console.log(service.getStats());
  console.log();

  console.log('========================================');
  console.log('🎉 测试流程完成！');
  console.log('========================================');
}

runTestFlow().catch(console.error);
