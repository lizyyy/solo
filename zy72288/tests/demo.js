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

function assert(cond, msg) {
  if (!cond) {
    console.log(`\n   🔴 ASSERTION FAILED: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`   ✅ ${msg}`);
  }
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

  assert(step3.success === true, '正常材料 step3 应成功');
  assert(step3.confirmedName === '分拣口_A01_皮带机侧挡', '正常材料 confirmedName 应为分拣口_A01_皮带机侧挡');

  console.log('\n【运行自检】');
  const selfCheck = await workflow.runSelfCheck();
  console.log(selfCheck.formattedReport);

  console.log(`\n${allConsistent ? '✅' : '❌'} 正常材料：所有步骤的触发动作/页面状态/输出内容 ${allConsistent ? '一致' : '不一致'}`);
  return workflow;
}

async function runWrongDataDemo() {
  printSeparator('❌ 场景二：错口径材料 - 多名称 + CAD测距冲突 + 三维视图阻断 + 老梁逐条处理');
  const workflow = new SortingLineWorkflow();
  let allConsistent = true;
  const assertions = [];

  console.log('\n【1. 第一次导入CAD图层: 分拣口_A01_挡板 (OBS_002)】');
  const step1a = await workflow.step1_importCADLayer({
    layerName: '分拣口_A01_挡板',
    obstacleId: 'OBS_002',
    position: { x: 5.0, y: 0, z: 0 }
  }, '操作员小李');
  printActionResult('第一次导入', step1a);
  allConsistent = verifyStateConsistency(step1a, 'step1a首次导入') && allConsistent;
  assertions.push([step1a.state.pendingConflicts === 0, 'step1a 后 pendingConflicts 应为 0']);

  console.log('\n【2. 同一障碍物被标了第二个名字: 分拣口_A01_侧挡】');
  console.log('   (以前总被当成小备注跳过，现在需要处理)');
  const step1b = await workflow.step1_importCADLayer({
    layerName: '分拣口_A01_侧挡',
    obstacleId: 'OBS_002',
    position: { x: 5.0, y: 0, z: 0 }
  }, '操作员小张');
  printActionResult('第二次导入(多名称)', step1b);
  allConsistent = verifyStateConsistency(step1b, 'step1b多名称') && allConsistent;
  assertions.push([step1b.triggeredDuplicateNames === true, 'step1b 应触发多名称检测']);
  assertions.push([step1b.state.pendingConflicts >= 1, 'step1b 后 pendingConflicts 应 ≥ 1']);
  if (step1b.triggeredDuplicateNames) {
    console.log('   🔍 关键：step1 导入时就感知到了多名称，不再当成小备注跳过！');
    console.log(`   🔍 冲突ID: ${step1b.duplicateNameConflict.conflictId}`);
  }

  console.log('\n【3. 老梁补看测距仪记录 - 6.5米，与CAD 5.0米矛盾】');
  const step2 = await workflow.step2_laoliangReviewRangefinder({
    obstacleId: 'OBS_002',
    distance: 6.5,
    position: { x: 5.0, y: 0, z: 0 },
    remark: '现场重新测量'
  }, '老梁');
  printActionResult('老梁审核结果', step2);
  allConsistent = verifyStateConsistency(step2, 'step2审核') && allConsistent;

  const pendingAfterStep2 = step2.state.pendingConflicts;
  assertions.push([pendingAfterStep2 >= 2, `step2 后 pendingConflicts ≥ 2 (实际=${pendingAfterStep2})，应包含1个多名称+至少1个测距冲突`]);

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
  }

  console.log('\n【4. 老梁先把"多名称冲突"暂缓留给学员复核练习】');
  const dupConflict = step2.output.pendingConflicts.find(c => c.type === 'duplicate_names');
  let resolvedDup;
  if (dupConflict) {
    resolvedDup = await workflow.laoliangResolveConflict(dupConflict.conflictId, 'defer', '老梁');
    printActionResult('老梁暂缓多名称冲突', resolvedDup);
    allConsistent = verifyStateConsistency(resolvedDup, '老梁暂缓多名称') && allConsistent;
  }

  console.log('\n【5. 培训学员复核名称冲突 - 选择"分拣口_A01_侧挡"】');
  const reviewResult = await workflow.traineeReview(
    'OBS_002',
    '分拣口_A01_侧挡',
    '学员小明'
  );
  printActionResult('学员复核', reviewResult);
  allConsistent = verifyStateConsistency(reviewResult, '学员复核') && allConsistent;
  assertions.push([reviewResult.remainingConflictsForObstacle >= 1, `学员复核完名称后仍有测距冲突待处理 (实际=${reviewResult.remainingConflictsForObstacle})`]);
  assertions.push([reviewResult.note && reviewResult.note.includes('不能更新三维视图'), '学员复核完后的 note 应提示不能更新三维视图']);

  console.log('\n【6. 尝试更新三维视图 - 应该被阻断！】');
  const step3Blocked = await workflow.step3_update3DView('OBS_002', '老梁');
  printActionResult('视图更新(被阻断)', step3Blocked);
  allConsistent = verifyStateConsistency(step3Blocked, 'step3被阻断') && allConsistent;
  assertions.push([step3Blocked.success === false, '有待处理测距冲突时 step3 必须返回 success=false']);
  assertions.push([step3Blocked.error && step3Blocked.error.code === 'E007', '阻断错误代码应为 E007']);
  assertions.push([(step3Blocked.blockedConflicts || []).length >= 1, `blockedConflicts 应 ≥ 1 (实际=${(step3Blocked.blockedConflicts || []).length})`]);
  assertions.push([step3Blocked.hint && step3Blocked.hint.includes('不能进入三维视图更新'), 'hint 应明确说明不能进入三维视图更新']);
  console.log(`   🔴 关键阻断：分拣口_A01_侧挡目前仍有测距冲突，不能写成已确认的最新视图！`);
  console.log(`   🔴 返回 success=false，阻止流程继续推进`);

  console.log('\n【7. 老梁逐条处理测距冲突】');
  const rangeConflicts = workflow.conflictDetector.getPendingConflictsForObstacle('OBS_002').filter(c => c.type === 'cad_vs_rangefinder');
  assertions.push([rangeConflicts.length >= 1, `至少1条 cad_vs_rangefinder 冲突待处理 (实际=${rangeConflicts.length})`]);
  console.log(`   共 ${rangeConflicts.length} 条测距冲突需要老梁处理`);
  for (let i = 0; i < rangeConflicts.length; i++) {
    const c = rangeConflicts[i];
    const resolveAction = i === 0 ? 'confirm' : 'confirm';
    const r = await workflow.laoliangResolveConflict(c.conflictId, resolveAction, '老梁');
    console.log(`   • 处理冲突 ${c.conflictId.substring(0, 20)}... -> ${r.success ? '✅' : '❌'} ${resolveAction}`);
    allConsistent = verifyStateConsistency(r, `处理测距冲突${i + 1}`) && allConsistent;
  }

  const pendingNow = workflow.conflictDetector.getPendingConflictsForObstacle('OBS_002').length;
  assertions.push([pendingNow === 0, `老梁处理完后 OBS_002 pending 应为 0 (实际=${pendingNow})`]);

  console.log('\n【8. 再次尝试更新三维视图 - 应该成功】');
  const step3Success = await workflow.step3_update3DView('OBS_002', '老梁');
  printActionResult('视图更新(成功)', step3Success);
  allConsistent = verifyStateConsistency(step3Success, 'step3成功') && allConsistent;
  assertions.push([step3Success.success === true, '所有冲突处理完 step3 应返回 success=true']);
  assertions.push([step3Success.confirmedName === '分拣口_A01_侧挡', `分拣口_A01_侧挡 应作为 confirmedName (实际=${step3Success.confirmedName})`]);
  assertions.push([step3Success.workflowComplete === true, 'workflowComplete 应为 true']);

  console.log('\n【9. 保存/刷新验证：视图快照中分拣口_A01_侧挡状态检查】');
  const snapshot = workflow.viewSync.getViewSnapshot();
  const obs002 = snapshot.obstacles['OBS_002'];
  assertions.push([!!obs002, '视图快照中 OBS_002 应存在']);
  if (obs002) {
    const confirmedName = obs002.names.find(n => n.status === 'trainee_confirmed')?.name;
    assertions.push([confirmedName === '分拣口_A01_侧挡', `视图快照中分拣口_A01_侧挡应为 trainee_confirmed (实际=${confirmedName})`]);
    const annotations = snapshot.annotations.filter(a => a.obstacleId === 'OBS_002');
    assertions.push([annotations.length > 0, '视图快照中 OBS_002 应有标注']);
    annotations.forEach(a => {
      assertions.push([a.status === 'confirmed', `标注 ${a.name} 状态应为 confirmed (实际=${a.status})`]);
    });
  }

  console.log('\n【10. 历史记录检查】');
  const history = workflow.viewSync.getHistory();
  const historyActions = history.map(h => h.action);
  console.log(`   历史记录共 ${history.length} 条，动作: ${historyActions.join(', ')}`);
  assertions.push([historyActions.includes('supplement_data'), '历史应包含 supplement_data']);
  assertions.push([historyActions.includes('recalculate'), '历史应包含 recalculate']);
  assertions.push([historyActions.includes('resolve_conflict'), '历史应包含 resolve_conflict']);
  assertions.push([historyActions.includes('trainee_review'), '历史应包含 trainee_review']);
  assertions.push([historyActions.includes('update_3d_view'), '历史应包含 update_3d_view']);

  console.log('\n【11. 自检报告】');
  const selfCheck = await workflow.runSelfCheck();
  console.log(selfCheck.formattedReport);
  assertions.push([selfCheck.report.summary.failed === 0, `自检 failed 项应为 0 (实际=${selfCheck.report.summary.failed})`]);

  console.log('\n【12. 导出一致性检查】');
  const exportData = workflow.viewSync.exportViewData();
  console.log(`   导出标注数: ${exportData.annotationCount}`);
  console.log(`   导出障碍物数: ${exportData.obstacleCount}`);
  console.log(`   导出历史数: ${exportData.historyCount}`);
  console.log(`   导出一致性: ${exportData.consistencyCheck.consistent ? '✅' : '❌'}`);
  assertions.push([exportData.consistencyCheck.consistent === true, '导出结果 consistencyCheck.consistent 应为 true']);
  assertions.push([exportData.obstacles.OBS_002 && exportData.obstacles.OBS_002.names.length === 2, '导出数据 OBS_002.names 长度应为 2']);

  console.log('\n─── 场景二 断言汇总 ───');
  let passCount = 0;
  for (const [cond, msg] of assertions) {
    if (cond) { passCount++; console.log(`   ✅ ${msg}`); }
    else { console.log(`   ❌ ${msg}`); process.exitCode = 1; }
  }
  console.log(`   断言: ${passCount}/${assertions.length} 通过`);

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
  assert(result2.success === false, '重复导入应返回 success=false');

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
  console.log('🚀 物流分拣线堵点演示 - 完整功能验证\n');
  console.log('核心修复：CAD与测距仪有冲突时，step3_update3DView 必须被阻断，不能把分拣口_A01_侧挡写成已确认\n');

  try {
    await runNormalDemo();
    await runWrongDataDemo();
    await runSupplementDemo();

    printSeparator('🎉 所有演示场景执行完成');
    console.log('\n📊 本次修复覆盖：');
    console.log('   ✅ 新增 E007 错误：有待处理CAD测距冲突时不能更新三维视图');
    console.log('   ✅ ConflictDetector 新增 getPendingConflictsForObstacle');
    console.log('   ✅ step3_update3DView 增加障碍物 pending 冲突门控');
    console.log('   ✅ traineeReview 返回 remainingConflictsForObstacle 和提示 note');
    console.log('   ✅ selfCheck 新增"待处理冲突阻断三维视图确认"检查项');
    console.log('   ✅ 场景二完整链路：导入→补看6.5米测距→学员复核→更新被阻断→老梁逐条处理测距→更新成功');
    console.log('   ✅ 覆盖保存、刷新、重算、导出一致性校验');
    console.log('   ✅ 触发动作/页面状态/输出内容 全部引用同一份 OBS_002');

  } catch (error) {
    console.error('❌ 演示执行出错:', error);
    console.error(error.stack);
    process.exitCode = 1;
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
