const SortingLineWorkflow = require('../src/workflow');

function printSeparator(title = '') {
  const line = '═'.repeat(60);
  console.log(`\n${line}`);
  if (title) console.log(`  ${title}`);
  console.log(line);
}

function printResult(label, result) {
  console.log(`\n📌 ${label}:`);
  console.log(`   ${result.message}`);
  if (result.success && result.nextStep) {
    console.log(`   ➡️  下一步: ${result.nextStep}`);
  }
}

async function runNormalDemo() {
  printSeparator('✅ 场景一：正常材料 - 完整三步流程');
  
  const workflow = new SortingLineWorkflow();
  
  console.log('\n【第一步：导入CAD图层】');
  const step1 = await workflow.step1_importCADLayer({
    layerName: '分拣口_A01_皮带机侧挡',
    obstacleId: 'OBS_001',
    position: { x: 3.2, y: 1.5, z: 0.8 }
  }, '操作员小王');
  printResult('CAD导入结果', step1);

  console.log('\n【第二步：老梁补看测距仪记录】');
  const step2 = await workflow.step2_laoliangReviewRangefinder({
    obstacleId: 'OBS_001',
    distance: 3.72,
    position: { x: 3.2, y: 1.5, z: 0.8 },
    remark: '现场测量，确认距离准确'
  }, '老梁');
  printResult('老梁审核结果', step2);
  
  if (step2.pendingConflicts && step2.pendingConflicts.length > 0) {
    console.log('\n   ⚠️  发现冲突：');
    for (const conflict of step2.pendingConflicts) {
      console.log(`      • ${conflict.description.message}`);
    }
  }

  console.log('\n【第三步：更新三维标注视图】');
  const step3 = await workflow.step3_update3DView('OBS_001', '系统');
  printResult('视图更新结果', step3);

  console.log('\n【运行自检】');
  const selfCheck = await workflow.runSelfCheck();
  console.log(selfCheck.formattedReport);
  
  return workflow;
}

async function runWrongDataDemo() {
  printSeparator('❌ 场景二：错口径材料 - 数据冲突演示');
  
  const workflow = new SortingLineWorkflow();
  
  console.log('\n【导入CAD图层】');
  await workflow.step1_importCADLayer({
    layerName: '分拣口_A01_挡板',
    obstacleId: 'OBS_002',
    position: { x: 5.0, y: 0, z: 0 }
  }, '操作员小李');
  
  console.log('\n【同一障碍物被标了两个名字】');
  await workflow.step1_importCADLayer({
    layerName: '分拣口_A01_侧挡',
    obstacleId: 'OBS_002',
    position: { x: 5.0, y: 0, z: 0 }
  }, '操作员小张');

  console.log('\n【老梁补看测距仪记录 - 数据有矛盾】');
  const step2 = await workflow.step2_laoliangReviewRangefinder({
    obstacleId: 'OBS_002',
    distance: 6.5,
    position: { x: 5.0, y: 0, z: 0 },
    remark: '现场重新测量'
  }, '老梁');
  
  printResult('老梁审核结果', step2);

  if (step2.pendingConflicts && step2.pendingConflicts.length > 0) {
    console.log('\n📋 列出冲突证据（给老梁选择）：');
    for (const conflict of step2.pendingConflicts) {
      const presentation = workflow.presentConflictToLaoliang(conflict.conflictId);
      console.log(`\n   冲突类型: ${presentation.type}`);
      console.log(`   ${presentation.description.message}`);
      console.log(`   证据:`, JSON.stringify(presentation.evidence, null, 6).replace(/\n/g, '\n      '));
      console.log(`   选项:`);
      for (const opt of presentation.options) {
        console.log(`     • ${opt.label}`);
      }
      console.log(`   📌 ${presentation.note}`);
    }
    
    console.log('\n【老梁选择：暂缓 - 留给培训学员复核练习】');
    const resolveResult = await workflow.laoliangResolveConflict(
      step2.pendingConflicts[0].conflictId,
      'defer',
      '老梁'
    );
    console.log(`   结果: ${resolveResult.message}`);
  }

  console.log('\n【培训学员复核名称冲突】');
  const reviewResult = await workflow.traineeReview(
    'OBS_002',
    '分拣口_A01_侧挡',
    '学员小明'
  );
  console.log(`   ${reviewResult.message}`);

  console.log('\n【更新三维视图（学员复核后）】');
  const step3 = await workflow.step3_update3DView('OBS_002', '老梁');
  printResult('视图更新结果', step3);

  console.log('\n【运行自检】');
  const selfCheck = await workflow.runSelfCheck();
  console.log(selfCheck.formattedReport);
  
  return workflow;
}

async function runSupplementDemo() {
  printSeparator('📝 场景三：补录材料 - 重复导入与补录重算演示');
  
  const workflow = new SortingLineWorkflow();
  
  console.log('\n【第一次导入CAD图层】');
  const result1 = await workflow.step1_importCADLayer({
    layerName: '滑槽_B03_导向板',
    obstacleId: 'OBS_003',
    position: { x: 2.1, y: 4.2, z: 1.0 }
  }, '操作员小王');
  console.log(`   ${result1.message}`);

  console.log('\n【尝试重复导入同一图层】');
  const result2 = await workflow.step1_importCADLayer({
    layerName: '滑槽_B03_导向板',
    obstacleId: 'OBS_003',
    position: { x: 2.1, y: 4.2, z: 1.0 }
  }, '操作员小李');
  console.log(`   ${result2.message}`);

  console.log('\n【老梁补录测距仪数据】');
  await workflow.step2_laoliangReviewRangefinder({
    obstacleId: 'OBS_003',
    distance: 4.83,
    position: { x: 2.1, y: 4.2, z: 1.0 },
    remark: '补录上午遗漏的数据'
  }, '老梁');

  console.log('\n【运行自检】');
  const selfCheck = await workflow.runSelfCheck();
  console.log(selfCheck.formattedReport);
  
  return workflow;
}

async function runAllDemos() {
  console.log('🚀 物流分拣线堵点演示 - 完整功能验证\n');
  
  try {
    await runNormalDemo();
    await runWrongDataDemo();
    await runSupplementDemo();
    
    printSeparator('🎉 所有演示场景执行完成');
    console.log('\n📊 系统功能覆盖：');
    console.log('   ✅ 三步完整流程：CAD导入 → 老梁审核 → 视图更新');
    console.log('   ✅ 同一障碍物多名称检测与培训学员复核');
    console.log('   ✅ CAD图层与测距仪数据冲突检测');
    console.log('   ✅ 冲突证据列出，老梁选择确认/驳回/暂缓');
    console.log('   ✅ 不替业务同事自动拍板');
    console.log('   ✅ 重复导入检测与提示');
    console.log('   ✅ 补录后重算追踪');
    console.log('   ✅ 导出一致性检查');
    console.log('   ✅ 三维视图与历史记录同步');
    console.log('   ✅ 人性化错误提示（不说内部字段名）');
    console.log('   ✅ 完整自检报告');
    
  } catch (error) {
    console.error('❌ 演示执行出错:', error);
  }
}

if (require.main === module) {
  runAllDemos();
}

module.exports = {
  runNormalDemo,
  runWrongDataDemo,
  runSupplementDemo,
  runAllDemos
};
