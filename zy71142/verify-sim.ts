import { EvacuationSimulator } from './src/engine/simulator';
import { normalPlan, conflictPlan, emptyPlan } from './src/data/plans';

function runTest(plan: typeof normalPlan, name: string, maxSeconds: number = 600) {
  const sim = new EvacuationSimulator(plan);
  sim.start();
  
  const startTime = Date.now();
  let steps = 0;
  const maxSteps = maxSeconds * 2; // 0.5s per step
  
  for (let i = 0; i < maxSteps; i++) {
    sim.update(0.5, 1);
    steps++;
    
    if (sim.isComplete()) {
      break;
    }
  }
  
  const elapsed = (Date.now() - startTime) / 1000;
  const stats = sim.getStatistics();
  const completionRate = stats.totalStudents > 0 
    ? (stats.evacuatedStudents / stats.totalStudents * 100).toFixed(1)
    : '0';
  
  console.log(`\n=== ${name} ===`);
  console.log(`模拟时间: ${sim.getCurrentTime().toFixed(1)}s`);
  console.log(`疏散完成: ${stats.evacuatedStudents}/${stats.totalStudents} (${completionRate}%)`);
  console.log(`冲突数: ${stats.conflictCount}`);
  console.log(`最大排队: ${stats.totalQueueLength}`);
  console.log(`平均疏散时间: ${stats.avgEvacuationTime.toFixed(1)}s`);
  console.log(`模拟步数: ${steps}`);
  console.log(`运行耗时: ${elapsed.toFixed(2)}s`);
  
  const statusCounts: Record<string, number> = {};
  sim.getStudents().forEach(s => {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  });
  console.log('状态分布:', statusCounts);
  
  return {
    name,
    completed: stats.evacuatedStudents,
    total: stats.totalStudents,
    completionRate: parseFloat(completionRate),
    conflicts: stats.conflictCount,
    maxQueue: stats.totalQueueLength,
    avgTime: stats.avgEvacuationTime,
    totalTime: sim.getCurrentTime()
  };
}

console.log('=== 验证模拟引擎 ===\n');

const results = [
  runTest(normalPlan, '正常疏散方案', 900),
  runTest(conflictPlan, '冲突疏散方案', 900),
  runTest(emptyPlan, '空方案模板', 900)
];

console.log('\n=== 方案对比总结 ===');
console.log('| 方案 | 完成率 | 冲突 | 最大排队 | 平均时间 | 总时间 |');
console.log('|------|--------|------|----------|----------|--------|');
results.forEach(r => {
  console.log(`| ${r.name} | ${r.completionRate}% | ${r.conflicts} | ${r.maxQueue} | ${r.avgTime.toFixed(1)}s | ${r.totalTime.toFixed(1)}s |`);
});

// 验证正常方案和冲突方案有显著差异
const normal = results[0];
const conflict = results[1];
console.log('\n=== 差异验证 ===');
console.log(`正常方案完成率: ${normal.completionRate}%`);
console.log(`冲突方案完成率: ${conflict.completionRate}%`);

if (normal.total > 0 && conflict.total > 0) {
  if (normal.completionRate >= 100 && conflict.completionRate >= 100) {
    console.log('✓ 两个方案都能完成疏散');
    if (normal.totalTime < conflict.totalTime * 0.8) {
      console.log('✓ 正常方案明显快于冲突方案');
    } else {
      console.log('⚠ 正常方案和冲突方案耗时差异不够明显');
    }
    if (normal.conflicts < conflict.conflicts) {
      console.log('✓ 正常方案冲突更少');
    }
  } else {
    console.log('✗ 部分方案未完成疏散');
  }
}
