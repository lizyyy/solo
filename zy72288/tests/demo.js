const SortingLineWorkflow = require('../src/workflow');

function printSeparator(title = '') {
  const line = '═'.repeat(60);
  console.log(`\n${line}`);
  if (title) console.log(`  ${title}`);
  console.log(line);
}

function printActionResult(label, result) {
  console.log(`\n📌 ${label}:`);
  console.log(`   动作: ${result.action}`);
  console.log(`   结果: ${result.message}`);
  if (result.nextStep) {
    console.log(`   ➡️  下一步: ${result.nextStep}`);
  }
  if (result.state) {
    console.log(`   📊 当前状态: 步骤=${result.state.currentStep}, 障碍物=${result.state.obstacleCount}, 待处理冲突=${result.state.pendingConflicts}, 待学员复核=${result.state.pendingTraineeReviews}, 视图版本=${result.state.viewVersion}`);
  }
  if (result.output && result.output.pendingConflicts && result.output.pendingConflicts.length > 0) {
    console.log(`   ⚠️  待处理冲突:`);
    for (const c of result.output.pendingConflicts) {
      console.log(`      • [${c.type}] ${c.description.message}`);
    }
  }
}

function verifyStateConsistency(result, label) {
  if (!result.state || !result.output) {
    console.log(`   ❌ ${label}: 返回结果缺少 state 或 output`);
    return false;
  }
  
  const viewVersion = result.state.viewVersion;
  const snapshotVersion = result.output.viewSnapshot.version;
  
  if (viewVersion !== snapshotVersion) {
    console.log(`   ❌ ${label}: state.viewVersion(${viewVersion}) ≠ output.viewSnapshot.version(${snapshotVersion})，状态不一致！`);
    return false;
  }
  
  console.log(`   ✅ ${label}: state与output一致 (viewVersion=${viewVersion})`);
  return true;
}

async function runNormalDemo() {
  printSeparator('✅ 场景一：正常材料 - 完整三步流程');
  
  const workflow = new SortingLineWorkflow();
  let allConsistent = true;

  console.log('\n【第一步：导入CAD图层】');
  const step1 = await workflow.step1_importCADLayer({
    layerName: '分拣口_A01_皮带机侧挡',
    obstacleId: 'OBS_001',
    position: { x: 3.2, y: 1.5, z: 0.8 }
  }, '操作员小王');
  printActionResult('CAD导入结果', step1);
  allConsistent = verifyStateConsistency(step1, 'step1导入') && allConsistent;

  console.log('\n【第二步：老梁补看测距仪记录】');
  const step2 = await workflow.step2_laoliangReviewRangefinder({
    obstacleId: 'OBS_001',
    distance: 3.72,
    position: { x: 3.2, y: 1.5, z: 0.8 },
    remark: '现场测量，确认距离准确'
  }, '老梁');
  printActionResult('老梁审核结果', step2);
  allConsistent = verifyStateConsistency(step2, 'step2审核') && allConsistent;

  console.log('\n【第三步：更新三维标注视图】');
  const step3 = await workflow.step3_update3DView('OBS_001', '系统');
  printActionResult('视图更新结果', step3);
  allConsistent = verifyStateConsistency(step3, 'step3更新') && allConsistent;

  console.log('\n【运行自检】');
  const selfCheck = await workflow.runSelfCheck();
  console.log(selfCheck.formattedReport);
  
  console.log(`\n${allConsistent ? '✅' : '❌'} 正常材料：所有步骤的触发动作/页面状态/输出内容 ${allConsistent ? '一致' : '不一致'}`);
  
  return workflow;
}

async function runWrongDataDemo() {
  printSeparator('❌ 场景二：错口径材料 - 同一障碍物两个名字 + 数据冲突');
  
  const workflow = new SortingLineWorkflow();
  let allConsistent = true;

  console.log('\n【第一次导入CAD图层】');
  const step1a = await workflow.step1_importCADLayer({
    layerName: '分拣口_A01_挡板',
    obstacleId: 'OBS_002',
    position: { x: 5.0, y: 0, z: 0 }
  }, '操作员小李');
  printActionResult('第一次导入', step1a);
  allConsistent = verifyStateConsistency(step1a, 'step1a首次导入') && allConsistent;

  console.log('\n【同一障碍物被标了第二个名字 - 以前总被当成小备注跳过】');
  const step1b = await workflow.step1_importCADLayer({
    layerName: '分拣口_A01_侧挡',
    obstacleId: 'OBS_002',
    position: { x: 5.0, y: 0, z: 0 }
  }, '操作员小张');
  printActionResult('第二次导入(多名称)', step1b);
  allConsistent = verifyStateConsistency(step1b, 'step1b多名称') && allConsistent;
  
  if (step1b.triggeredDuplicateNames) {
    console.log('   🔍 关键：step1 导入时就感知到了多名称，不再当成小备注跳过！');
    console.log(`   🔍 冲突ID: ${step1b.duplicateNameConflict.conflictId}`);
  }

  console.log('\n【老梁补看测距仪记录 - 数据有矛盾】');
  const step2 = await workflow.step2_laoliangReviewRangefinder({
    obstacleId: 'OBS_002',
    distance: 6.5,
    position: { x: 5.0, y: 0, z: 0 },
    remark: '现场重新测量'
  }, '老梁');
  printActionResult('老梁审核结果', step2);
  allConsistent = verifyStateConsistency(step2, 'step2审核') && allConsistent;

  if (step2.output && step2.output.pendingConflicts && step2.output.pendingConflicts.length > 0) {
    console.log('\n📋 列出冲突证据（给老梁选择）：');
    for (const c of step2.output.pendingConflicts) {
      const presentation = workflow.presentConflictToLaoliang(c.conflictId);
      console.log(`\n   冲突类型: ${presentation.type}`);
      console.log(`   ${presentation.description.message}`);
      console.log(`   选项:`);
      for (const opt of presentation.options) {
        console.log(`     • ${opt.label}`);
      }
      console.log(`   📌 ${presentation.note}`);
    }
    
    console.log('\n【老梁选择：暂缓 - 留给培训学员复核练习】');
    const resolveResult = await workflow.laoliangResolveConflict(
      step2.output.pendingConflicts[0].conflictId,
      'defer',
      '老梁'
    );
    printActionResult('老梁暂缓冲突', resolveResult);
    allConsistent = verifyStateConsistency(resolveResult, '老梁暂缓') && allConsistent;
  }

  console.log('\n【培训学员复核名称冲突】');
  const reviewResult = await workflow.traineeReview(
    'OBS_002',
    '分拣口_A01_侧挡',
    '学员小明'
  );
  printActionResult('学员复核', reviewResult);
  allConsistent = verifyStateConsistency(reviewResult, '学员复核') && allConsistent;

  console.log('\n【更新三维视图（学员复核后）】');
  const step3 = await workflow.step3_update3DView('OBS_002', '老梁');
  printActionResult('视图更新结果', step3);
  allConsistent = verifyStateConsistency(step3, 'step3更新') && allConsistent;

  console.log('\n【运行自检】');
  const selfCheck = await workflow.runSelfCheck();
  console.log(selfCheck.formattedReport);
  
  console.log(`\n${allConsistent ? '✅' : '❌'} 错口径材料：所有步骤的触发动作/页面状态/输出内容 ${allConsistent ? '一致' : '不一致'}`);
  
  return workflow;
}

async function runSupplementDemo() {
  printSeparator('📝 场景三：补录材料 - 重复导入与补录重算演示');
  
  const workflow = new SortingLineWorkflow();
  let allConsistent = true;

  console.log('\n【第一次导入CAD图层】');
  const result1 = await workflow.step1_importCADLayer({
    layerName: '滑槽_B03_导向板',
    obstacleId: 'OBS_003',
    position: { x: 2.1, y: 4.2, z: 1.0 }
  }, '操作员小王');
  printActionResult('首次导入', result1);
  allConsistent = verifyStateConsistency(result1, '首次导入') && allConsistent;

  console.log('\n【尝试重复导入同一图层】');
  const result2 = await workflow.step1_importCADLayer({
    layerName: '滑槽_B03_导向板',
    obstacleId: 'OBS_003',
    position: { x: 2.1, y: 4.2, z: 1.0 }
  }, '操作员小李');
  printActionResult('重复导入', result2);
  allConsistent = verifyStateConsistency(result2, '重复导入') && allConsistent;

  console.log('\n【老梁补录测距仪数据】');
  const step2 = await workflow.step2_laoliangReviewRangefinder({
    obstacleId: 'OBS_003',
    distance: 4.83,
    position: { x: 2.1, y: 4.2, z: 1.0 },
    remark: '补录上午遗漏的数据'
  }, '老梁');
  printActionResult('老梁补录', step2);
  allConsistent = verifyStateConsistency(step2, '老梁补录') && allConsistent;

  console.log('\n【运行自检】');
  const selfCheck = await workflow.runSelfCheck();
  console.log(selfCheck.formattedReport);
  
  console.log(`\n${allConsistent ? '✅' : '❌'} 补录材料：所有步骤的触发动作/页面状态/输出内容 ${allConsistent ? '一致' : '不一致'}`);
  
  return workflow;
}

async function runAllDemos() {
  console.log('🚀 物流分拣线堵点演示 - 完整功能验证（修复后）\n');
  console.log('核心修复：每个步骤的返回结果统一包含 action + state + output 三部分');
  console.log('验证目标：正常材料、错口径材料、补录材料都跟同一份最新结果一致\n');
  
  try {
    await runNormalDemo();
    await runWrongDataDemo();
    await runSupplementDemo();
    
    printSeparator('🎉 所有演示场景执行完成');
    console.log('\n📊 修复要点：');
    console.log('   ✅ viewSync 深拷贝存储，不再用活引用');
    console.log('   ✅ step1 感知多名称，不再当小备注跳过');
    console.log('   ✅ ConflictDetector 不丢失已解决冲突');
    console.log('   ✅ 所有步骤统一返回 action + state + output');
    console.log('   ✅ 返回值全部深拷贝，不暴露可变引用');
    console.log('   ✅ state.viewVersion 与 output.viewSnapshot.version 一致');
    
  } catch (error) {
    console.error('❌ 演示执行出错:', error);
    console.error(error.stack);
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
