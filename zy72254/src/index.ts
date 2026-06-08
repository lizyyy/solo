export * from './types';
export * from './utils/idGenerator';
export * from './models/ObstructionModel';
export * from './models/EvacuationRouteModel';
export * from './models/RangefinderModel';
export * from './core/BoundaryRules';
export * from './core/CADImporter';
export * from './core/HistoryTracker';
export * from './core/DisplayService';
export * from './core/ErrorHandler';
export * from './core/ProcessOrchestrator';

export { ProcessOrchestrator as FireEvacuationSimulation } from './core/ProcessOrchestrator';

import { ProcessOrchestrator } from './core/ProcessOrchestrator';
import { ConflictResolution, DisplayMode, ObstructionStatus } from './types';
import { normalizeName, detectConflicts, resolveConflict, requiresReview } from './core/BoundaryRules';
import { formatErrorForDisplay } from './core/ErrorHandler';
import { getAllNames } from './models/ObstructionModel';
import type { RawCADLayer } from './core/CADImporter';

async function main() {
  console.log('=== 消防疏散路线推演系统 - 完整流程演示 ===\n');

  const sim = new ProcessOrchestrator();

  const cadLayers: RawCADLayer[] = [
    {
      layerName: '消防栓-001',
      originalName: '消防栓-001',
      geometry: [
        { x: 10, y: 20, z: 0 },
        { x: 12, y: 20, z: 0 },
        { x: 12, y: 22, z: 0 },
        { x: 10, y: 22, z: 0 }
      ],
      isOnEvacuationRoute: true,
      hazardLevel: 'medium'
    },
    {
      layerName: '消防栓_001',
      originalName: '消防栓_001',
      geometry: [
        { x: 10, y: 20, z: 0 },
        { x: 12, y: 20, z: 0 },
        { x: 12, y: 22, z: 0 },
        { x: 10, y: 22, z: 0 }
      ],
      isOnEvacuationRoute: true,
      hazardLevel: 'medium'
    },
    {
      layerName: '安全出口-A1',
      originalName: '安全出口-A1',
      geometry: [
        { x: 0, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 2, y: 2, z: 0 },
        { x: 0, y: 2, z: 0 }
      ],
      isOnEvacuationRoute: true,
      hazardLevel: 'high'
    }
  ];

  console.log('【第一步】CAD图层名第一次导入');
  const step1 = await sim.step1_importCADLayers(cadLayers, '小魏', 'B栋三楼.dwg');
  console.log(`  导入结果: success=${step1.success}`);
  console.log(`  障碍物数量: ${step1.data!.obstructions.length}`);
  console.log(`  冲突数量: ${step1.data!.conflictCount}`);
  console.log(`  需要复核: ${step1.requiresReview}`);

  if (step1.reviewItems && step1.reviewItems.length > 0) {
    console.log('  复核清单:');
    for (const item of step1.reviewItems) {
      console.log(`    - ${item.description}`);
      console.log(`      冲突名称: ${item.conflictingNames.join(', ')}`);
    }
  }

  const state1 = sim.getState();
  for (const obs of state1.obstructions) {
    console.log(`  障碍物: ${obs.aliases[0].name} 状态=${obs.status} 冲突=${!!obs.conflictInfo}`);
  }

  console.log('\n【冲突检测】同一障碍物被标了两个名字');
  const conflicts = step1.data!.obstructions.filter(o => o.conflictInfo);
  if (conflicts.length >= 2) {
    const name1 = conflicts[0].aliases[0].name;
    const name2 = conflicts[1].aliases[0].name;
    const norm1 = normalizeName(name1);
    const norm2 = normalizeName(name2);
    console.log(`  "${name1}" → 归一化: "${norm1}"`);
    console.log(`  "${name2}" → 归一化: "${norm2}"`);
    console.log(`  归一化后相同: ${norm1 === norm2} → 判定为同一障碍物`);
    console.log(`  处理方式: 留给培训学员复核，不急着归正常`);
  }

  console.log('\n【解决冲突】培训学员复核并合并');
  if (conflicts.length >= 2) {
    const resolveResult = await sim.resolvePendingConflict(
      conflicts[0].id,
      conflicts[1].id,
      ConflictResolution.MERGE,
      '培训学员',
      '消防栓001'
    );
    console.log(`  合并结果: success=${resolveResult.success}`);
    console.log(`  主名称: ${resolveResult.data!.primary.canonicalName}`);
    console.log(`  所有名称: ${getAllNames(resolveResult.data!.primary).join(', ')}`);
    console.log(`  CAD图层: ${resolveResult.data!.primary.cadLayers.length} 个`);
    console.log(`  副本状态: ${resolveResult.data!.secondary.status}`);
  }

  console.log('\n【第二步】航测内业小魏补看测距仪记录');
  const exitObs = step1.data!.obstructions.find(o => o.aliases[0].name === '安全出口-A1');
  const step2 = await sim.step2_supplementRangefinder(
    [
      {
        obstructionId: exitObs!.id,
        measuredBy: '小魏',
        distance: 5.0,
        fromPoint: { x: 0, y: 0, z: 0 },
        toPoint: { x: 5, y: 0, z: 0 },
        notes: '距离疏散门5.0米'
      }
    ],
    '小魏'
  );
  console.log(`  补录结果: success=${step2.success}`);
  console.log(`  有效记录: ${step2.data!.validRecords} 条`);
  console.log(`  可以进入第三步: ${step2.nextStage !== undefined}`);

  console.log('\n【备注修改】历史记录要能看出改前改后的差别');
  const mergedObs = sim.getState().obstructions.find(o => o.status === ObstructionStatus.MERGED);
  if (mergedObs) {
    await sim.updateObstructionNotes(mergedObs.id, '培训学员确认合并，消防栓位置正确', '培训学员');
    const history = sim.getObstructionHistory(mergedObs.id);
    const diffEntry = history.find(h => h.fieldName === 'notes');
    if (diffEntry) {
      console.log(`  改前: ${JSON.stringify(diffEntry.oldValue)}`);
      console.log(`  改后: ${JSON.stringify(diffEntry.newValue)}`);
    }
  }

  console.log('\n【第三步】三维标注视图更新');
  const canProceed = sim.canProceedToNextStage();
  console.log(`  可以进入第三步: ${canProceed}`);

  const step3 = await sim.step3_update3DView(DisplayMode.VIEW_3D, '培训学员');
  console.log(`  3D更新结果: success=${step3.success}`);
  if (step3.success) {
    console.log(`  展示项数量: ${step3.data!.itemCount}`);
    console.log(`  存在冲突的项: ${step3.data!.itemsWithConflicts}`);
  }

  console.log('\n【溯源验证】3D展示点到障碍物要能回到CAD图层名或测距仪记录');
  if (step3.success && mergedObs) {
    const selectionResult = await sim.selectItemForReview(mergedObs.id, 'obstruction');
    if (selectionResult.success && selectionResult.data) {
      const detail = selectionResult.data.detail as any;
      const sourceTrace = selectionResult.data.sourceTrace as any;
      console.log(`  选中项: ${detail?.canonicalName || mergedObs.canonicalName}`);
      if (sourceTrace?.cadLayers) {
        console.log(`  CAD图层溯源:`);
        for (const layer of sourceTrace.cadLayers) {
          console.log(`    - 图层: ${layer.layerName} 来源: ${layer.importSource}`);
        }
      }
      if (sourceTrace?.rangefinderRecords) {
        console.log(`  测距仪记录溯源:`);
        for (const record of sourceTrace.rangefinderRecords) {
          console.log(`    - 距离: ${record.distance}m 测量人: ${record.measuredBy}`);
        }
      }
    }
  }

  console.log('\n【重复导入验证】重复导入同一批CAD图层名不要把数量翻倍');
  const sim2 = new ProcessOrchestrator();
  const r1 = await sim2.step1_importCADLayers(cadLayers, '小魏', 'B栋三楼.dwg');
  const r2 = await sim2.step1_importCADLayers(cadLayers, '小魏', 'B栋三楼.dwg', true);
  console.log(`  首次导入: ${r1.data!.obstructions.length} 个障碍物`);
  console.log(`  重复导入: ${r2.data!.obstructions.length} 个障碍物`);
  console.log(`  数量未翻倍: ${r1.data!.obstructions.length === r2.data!.obstructions.length}`);

  console.log('\n【错误提示验证】错误提示要说人话');
  const sim3 = new ProcessOrchestrator();
  await sim3.step1_importCADLayers(cadLayers, '小魏', 'B栋三楼.dwg');
  const badResult = await sim3.step2_supplementRangefinder(
    [{ obstructionId: 'non_existent_id', measuredBy: '小魏', distance: 5.0, fromPoint: { x: 0, y: 0, z: 0 }, toPoint: { x: 5, y: 0, z: 0 } }],
    '小魏'
  );
  if (badResult.errors.length > 0) {
    const err = formatErrorForDisplay(badResult.errors[0]);
    console.log(`  错误消息: ${err.content}`);
    console.log(`  操作建议: ${err.suggestion}`);
    console.log(`  无内部字段名: ${!/obstruction_id|foreign_key/i.test(err.content)}`);
  }

  const finalState = sim.getState();
  console.log('\n=== 最终状态 ===');
  console.log(`  当前阶段: ${finalState.currentStage}`);
  console.log(`  障碍物总数: ${finalState.obstructions.length}`);
  console.log(`  阶段历史: ${finalState.stageHistory.map(h => h.stage).join(' → ')}`);

  console.log('\n=== 演示完成 ===');
}

if (require.main === module) {
  main().catch(err => {
    console.error('运行出错:', err.message);
    process.exit(1);
  });
}
