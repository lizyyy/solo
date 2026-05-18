import { store } from '../data/store';
import { generateGreenCoffees, generateRoastingCurves, generateRoastingBatches } from '../data/seedData';
import { BatchStatus } from '../types';

export function seedDatabase(): void {
  store.clearAll();

  const greenCoffees = generateGreenCoffees();
  greenCoffees.forEach(coffee => store.addGreenCoffee(coffee));

  const roastingCurves = generateRoastingCurves();
  roastingCurves.forEach(curve => store.addRoastingCurve(curve));

  const batches = generateRoastingBatches(greenCoffees, roastingCurves);
  batches.forEach(batch => {
    store.addBatch(batch);
    store.createHistoryRecord(
      batch.id,
      '创建批次',
      null,
      batch.status,
      batch.roastMaster,
      `创建烘焙批次 ${batch.batchNumber}`,
      { initialStatus: batch.status }
    );
  });

  console.log(`✅ 已导入 ${greenCoffees.length} 批生豆数据`);
  console.log(`✅ 已导入 ${roastingCurves.length} 条烘焙曲线`);
  console.log(`✅ 已导入 ${batches.length} 个烘焙批次`);
  console.log(`📊 批次状态统计:`);
  console.log(`   - 已完成: ${batches.filter(b => b.status === BatchStatus.COMPLETED).length}`);
  console.log(`   - 处理中: ${batches.filter(b => b.status === BatchStatus.PROCESSING).length}`);
  console.log(`   - 待处理: ${batches.filter(b => b.status === BatchStatus.NEEDS_ATTENTION).length}`);
  console.log(`   - 已驳回: ${batches.filter(b => b.status === BatchStatus.REJECTED).length}`);
}

if (require.main === module) {
  seedDatabase();
  console.log('\n🎉 种子数据导入完成！');
}
