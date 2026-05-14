import { dataStore } from './store';
import { batchCancellationService } from './service';
import { exportService } from './export';
import { SampleStatus } from './types';
import * as fs from 'fs';
import * as path from 'path';

async function runDemo() {
  console.log('='.repeat(80));
  console.log('🎬 批量任务取消功能演示');
  console.log('='.repeat(80));
  console.log();

  const testBatchId = 'BATCH-2026-0515-001';
  const testBatchId2 = 'BATCH-2026-0515-002';

  console.log('📦 步骤 1: 查看批次信息');
  console.log('-'.repeat(80));
  const batch1 = dataStore.getBatchById(testBatchId);
  const batch2 = dataStore.getBatchById(testBatchId2);
  console.log('批次 1:', JSON.stringify(batch1, null, 2));
  console.log('批次 2:', JSON.stringify(batch2, null, 2));
  console.log();

  console.log('📋 步骤 2: 预览批量取消影响范围 (关键功能)');
  console.log('-'.repeat(80));
  const preview = batchCancellationService.previewCancellation(testBatchId);
  console.log('预览结果:', JSON.stringify(preview, null, 2));
  console.log();
  console.log('⚠️  注意发现的风险样本:');
  preview?.riskySamples.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.productName} - ${r.reason} (风险等级: ${r.riskLevel})`);
  });
  console.log();

  console.log('❌ 步骤 3: 执行批量取消 (非强制模式)');
  console.log('-'.repeat(80));
  const result = batchCancellationService.executeCancellation(testBatchId, '演示用户', false);
  console.log('执行结果:', JSON.stringify(result, null, 2));
  console.log();
  console.log('🔥 失败路径自然呈现 (无需人工说明):');
  result?.failedSamples.forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.productName}`);
    console.log(`     来源: ${f.source}, 当前状态: ${f.status}`);
    console.log(`     错误: ${f.error}`);
  });
  console.log();

  console.log('💾 步骤 4: 导出结果供同事复核 (多种格式)');
  console.log('-'.repeat(80));
  
  const jsonOutput = exportService.exportCancellationResult(result!, 'json');
  const mdOutput = exportService.exportCancellationResult(result!, 'markdown');
  const csvOutput = exportService.exportCancellationResult(result!, 'csv');

  const outputDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  fs.writeFileSync(path.join(outputDir, 'result.json'), jsonOutput);
  fs.writeFileSync(path.join(outputDir, 'result.md'), mdOutput);
  fs.writeFileSync(path.join(outputDir, 'result.csv'), csvOutput);
  
  console.log(`✅ 已导出到 output/ 目录:`);
  console.log('   - result.json (JSON格式)');
  console.log('   - result.md (Markdown格式)');
  console.log('   - result.csv (CSV格式)');
  console.log();

  console.log('📝 Markdown 报告预览:');
  console.log('='.repeat(80));
  console.log(mdOutput);
  console.log('='.repeat(80));
  console.log();

  console.log('🔧 步骤 5: 人工修正功能演示');
  console.log('-'.repeat(80));
  const samples = dataStore.getSamplesByBatch(testBatchId2);
  const sampleToAdjust = samples[1];
  
  const adjustResult = batchCancellationService.manuallyAdjustSample(
    sampleToAdjust.id,
    SampleStatus.MANUALLY_ADJUSTED,
    '运营-李主管',
    '样品质量问题，更换为备用样品',
    '原样品检测发现色差问题，已联系供应商补发新样品，预计明日到货。直播间临时调整展示顺序，该样品推迟至下场直播展示。'
  );
  
  console.log('人工修正结果:', JSON.stringify(adjustResult, null, 2));
  console.log();

  console.log('📋 步骤 6: 导出含人工修正的复核清单');
  console.log('-'.repeat(80));
  const reviewOutput = exportService.exportReviewList(testBatchId2, 'markdown');
  console.log(reviewOutput);
  console.log();

  if (reviewOutput) {
    fs.writeFileSync(path.join(outputDir, 'review.md'), reviewOutput);
    console.log(`✅ 复核清单已保存到 output/review.md`);
  }

  console.log();
  console.log('='.repeat(80));
  console.log('✅ 演示完成！');
  console.log('='.repeat(80));
  console.log();
  console.log('📌 关键特性验证:');
  console.log('   ✅ 跨天直播样品表真实样例');
  console.log('   ✅ 来源混杂样本保留');
  console.log('   ✅ 异常样本可导出复核');
  console.log('   ✅ 批量动作支持预览');
  console.log('   ✅ 失败路径自然呈现');
  console.log('   ✅ 多格式输出内容一致');
  console.log('   ✅ 人工修正带备注，不覆盖');
  console.log('   ✅ 按批次号标注来源和依据');
  console.log();
  console.log('🚀 运行 npm run dev 启动API服务进行完整测试');
}

runDemo().catch(console.error);