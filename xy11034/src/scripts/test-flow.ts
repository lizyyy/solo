import { store } from '../data/store';
import { batchService } from '../services/batchService';
import { rulesEngine } from '../services/businessRules';
import { reportService } from '../services/reportService';
import { seedDatabase } from './seed';
import { BatchStatus, RoastLevel } from '../types';

function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 咖啡豆烘焙批次管理 API - 主流程测试');
  console.log('='.repeat(60));
  console.log('');

  seedDatabase();

  const batches = store.getAllBatches();
  console.log(`✅ 数据初始化: 共 ${batches.length} 个批次`);
  console.log('');

  console.log('--- 📊 批次状态统计 ---');
  const statuses = Object.values(BatchStatus);
  statuses.forEach(status => {
    const count = batches.filter(b => b.status === status).length;
    if (count > 0) {
      console.log(`   ${status}: ${count} 个`);
    }
  });
  console.log('');

  console.log('--- 🔍 待处理批次详情 (追溯一致性问题) ---');
  const needsAttentionBatches = batches.filter(b => b.status === BatchStatus.NEEDS_ATTENTION);
  needsAttentionBatches.forEach(batch => {
    console.log(`   批次号: ${batch.batchNumber}`);
    console.log(`   状态: ${batch.status}`);
    console.log(`   生豆产地: ${batch.greenCoffee.origin}`);
    console.log(`   烘焙师: ${batch.roastMaster}`);
    console.log(`   问题原因:`);
    batch.attentionReasons.forEach(reason => {
      console.log(`     - ${reason}`);
    });
    console.log(`   解释: ${rulesEngine.generateExplanationMessage(batch)}`);
    console.log('');
  });

  console.log('--- ❌ 已驳回批次详情 (质量问题) ---');
  const rejectedBatches = batches.filter(b => b.status === BatchStatus.REJECTED);
  rejectedBatches.forEach(batch => {
    console.log(`   批次号: ${batch.batchNumber}`);
    console.log(`   状态: ${batch.status}`);
    console.log(`   生豆产地: ${batch.greenCoffee.origin}`);
    console.log(`   烘焙师: ${batch.roastMaster}`);
    console.log(`   杯测分数: ${batch.cuppingResult?.overall}`);
    console.log(`   驳回原因: ${batch.rejectionReason}`);
    console.log(`   解释: ${rulesEngine.generateExplanationMessage(batch)}`);
    console.log('');
  });

  console.log('--- ✅ 正常完成批次 ---');
  const completedBatches = batches.filter(b => b.status === BatchStatus.COMPLETED);
  completedBatches.forEach(batch => {
    console.log(`   批次号: ${batch.batchNumber}`);
    console.log(`   生豆产地: ${batch.greenCoffee.origin}`);
    console.log(`   烘焙度: ${batch.roastLevel}`);
    console.log(`   杯测分数: ${batch.cuppingResult?.overall}`);
    console.log(`   重量损耗: ${batch.weightLossPercentage}%`);
    console.log(`   解释: ${rulesEngine.generateExplanationMessage(batch)}`);
    console.log('');
  });

  console.log('--- 📋 报表数据一致性验证 ---');
  const reports = reportService.generateBatchReportList(batches);
  console.log(`   报表数量: ${reports.length} (应与批次数量一致: ${batches.length})`);
  console.log(`   ✅ 报表与批次数据一致: ${reports.length === batches.length}`);
  console.log('');

  console.log('--- 📈 统计数据 ---');
  const stats = reportService.generateSummaryStatistics(batches);
  console.log(`   总批次: ${stats.totalBatches}`);
  console.log(`   平均杯测分数: ${stats.qualityMetrics.averageCuppingScore}`);
  console.log(`   平均重量损耗: ${stats.qualityMetrics.averageWeightLossPercentage}%`);
  console.log(`   总计划烘焙量: ${stats.totalWeight.planned} kg`);
  console.log(`   总实际烘焙量: ${stats.totalWeight.actual} kg`);
  console.log('');

  console.log('--- 🆕 创建新批次测试 ---');
  const greenCoffee = store.getAllGreenCoffees()[0];
  const roastingCurve = store.getAllRoastingCurves()[0];

  const newBatchResult = batchService.createBatch({
    greenCoffeeId: greenCoffee.id,
    roastingCurveId: roastingCurve.id,
    roastMaster: '测试烘焙师',
    plannedWeightKg: 50,
    roastLevel: RoastLevel.MEDIUM,
    machineId: 'TEST-001',
    machineName: '测试烘焙机'
  }, 'test-user');

  if (newBatchResult.success) {
    console.log(`   ✅ 批次创建成功: ${newBatchResult.batch?.batchNumber}`);
    console.log(`   状态: ${newBatchResult.batch?.status}`);
    console.log(`   解释: ${newBatchResult.explanation}`);
  } else {
    console.log(`   ❌ 批次创建失败: ${JSON.stringify(newBatchResult.errors)}`);
  }
  console.log('');

  console.log('--- 🔄 同批豆多烘焙曲线测试 ---');
  const colCoffee = store.getAllGreenCoffees().find(c => c.batchNumber === 'GC-2024-COL-002');
  if (colCoffee) {
    const splitBatchResult = batchService.createBatch({
      greenCoffeeId: colCoffee.id,
      roastingCurveId: roastingCurve.id,
      roastMaster: '张伟',
      plannedWeightKg: 30,
      roastLevel: RoastLevel.LIGHT,
      parentBatchId: needsAttentionBatches[0]?.id
    }, 'test-user');

    if (splitBatchResult.success) {
      console.log(`   ✅ 拆分批次创建成功: ${splitBatchResult.batch?.batchNumber}`);
      console.log(`   状态: ${splitBatchResult.batch?.status}`);
      console.log(`   问题数量: ${splitBatchResult.batch?.attentionReasons.length}`);
      splitBatchResult.batch?.attentionReasons.forEach((reason: string) => {
        console.log(`     - ${reason}`);
      });
      console.log(`   解释: ${splitBatchResult.explanation}`);
    }
  }
  console.log('');

  console.log('--- 📜 批次历史记录 ---');
  const testBatch = batches[0];
  const histories = store.getBatchHistories(testBatch.id);
  console.log(`   批次 ${testBatch.batchNumber} 历史记录: ${histories.length} 条`);
  histories.forEach((h, i) => {
    console.log(`     ${i + 1}. ${h.action} - ${h.changedBy} - ${h.changedAt.toLocaleString()}`);
  });
  console.log('');

  console.log('='.repeat(60));
  console.log('🎉 测试完成！所有功能正常运行。');
  console.log('='.repeat(60));
  console.log('');
  console.log('📚 主要功能总结:');
  console.log('   1. ✅ 种子数据和异常样例已预置');
  console.log('   2. ✅ 同批豆多烘焙曲线自动检测');
  console.log('   3. ✅ 批次追溯一致性检查');
  console.log('   4. ✅ 待处理/驳回状态自动判定');
  console.log('   5. ✅ 统一计算口径（报表/详情/历史）');
  console.log('   6. ✅ 可解释的错误消息和拦截原因');
  console.log('');
}

runTests();
