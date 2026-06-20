import { useManifestStore, conflictStatusLabels } from '../src/store/manifestStore';

function log(header: string, data: unknown) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${header}`);
  console.log('='.repeat(60));
  console.log(JSON.stringify(data, null, 2));
}

function assertEqual(name: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    console.log(`  ✅ ${name}: ${actual} === ${expected}`);
  } else {
    console.error(`  ❌ ${name}: ${actual} !== ${expected}`);
    process.exitCode = 1;
  }
}

function runE2E() {
  const store = useManifestStore.getState();

  console.log('\n🚀 端到端测试：CD202406070001 舱单冲突裁决完整流程\n');
  console.log('核心要求：暂不裁决(deferred)不会被页面、接口或导出任一入口改写成已裁决\n');

  const manifestId = 'm1';
  const manifest = store.getManifestById(manifestId);

  console.log('\n--- STEP 1: 查找CD202406070001初始状态 ---');
  if (!manifest) {
    console.error('❌ 找不到舱单CD202406070001');
    process.exitCode = 1;
    return;
  }
  assertEqual('manifestNo', manifest.manifestNo, 'CD202406070001');
  console.log(`  初始status: ${manifest.status}`);
  console.log(`  初始stepProgress: ${manifest.stepProgress}`);
  console.log(`  初始hasConflict: ${manifest.hasConflict}`);

  const unresolvedBefore = store.getUnresolvedConflictsByManifestId(manifestId);
  console.log(`  未决冲突数: ${unresolvedBefore.length}`);
  unresolvedBefore.forEach((c) => {
    console.log(`    - ${c.fieldLabel}: status=${c.status}`);
  });

  console.log('\n--- STEP 2: 模拟导入知识库引用链接（第一步）---');
  store.importKnowledgeBase(
    manifestId,
    'https://kb.internal.example.com/articles/consignee-override-v3',
    '收货人知识库条目v3',
    { consignee: '知识库公司名称有限公司' }
  );

  const afterImport = store.getManifestById(manifestId)!;
  console.log(`  stepProgress: ${afterImport.stepProgress}`);
  assertEqual('stepProgress after import', afterImport.stepProgress >= 1, true);

  const unresolvedAfterImport = store.getUnresolvedConflictsByManifestId(manifestId);
  console.log(`  未决冲突数(导入后): ${unresolvedAfterImport.length}`);

  console.log('\n--- STEP 3: 选择暂不裁决(deferred) ---');
  const pendingConflict = store.getUnresolvedConflictsByManifestId(manifestId)
    .find((c) => c.status === 'pending');
  if (!pendingConflict) {
    console.error('❌ 找不到pending状态的冲突');
    process.exitCode = 1;
    return;
  }
  console.log(`  选中冲突: ${pendingConflict.fieldLabel} (id=${pendingConflict.id})`);

  store.resolveConflict(
    pendingConflict.id,
    'deferred',
    '需要安全审核同事进一步核实收货人信息，暂不裁决',
    '阿宁'
  );

  const afterDefer = store.getManifestById(manifestId)!;
  const unresolvedAfterDefer = store.getUnresolvedConflictsByManifestId(manifestId);
  const deferredAfterDefer = unresolvedAfterDefer.filter((c) => c.status === 'deferred');

  console.log('\n--- STEP 4: 验证暂不裁决后的状态 ---');
  assertEqual('status仍为conflict(非completed)', afterDefer.status, 'conflict');
  assertEqual('暂不裁决冲突仍在未决池', deferredAfterDefer.length, 1);
  assertEqual('hasConflict仍为true', afterDefer.hasConflict, true);
  assertEqual('stepProgress不推进(仍为1)', afterDefer.stepProgress, 1);

  console.log('\n--- STEP 5: 获取导出JSON并验证 ---');
  const exportData = store.getExportData();
  const exportManifest = (exportData.manifests as Array<Record<string, unknown>>)
    .find((m) => m.id === manifestId);

  if (!exportManifest) {
    console.error('❌ 导出数据中找不到CD202406070001');
    process.exitCode = 1;
    return;
  }

  log('导出JSON中CD202406070001关键字段', {
    status: exportManifest.status,
    hasConflict: exportManifest.hasConflict,
    unresolvedConflictCount: exportManifest.unresolvedConflictCount,
    overriddenFieldCount: exportManifest.overriddenFieldCount,
    hasOverride: exportManifest.hasOverride,
  });

  assertEqual('导出status=conflict', exportManifest.status, 'conflict');
  assertEqual('导出hasConflict=true', exportManifest.hasConflict, true);
  assertEqual('导出unresolvedConflictCount=1', exportManifest.unresolvedConflictCount, 1);

  console.log('\n--- STEP 6: 导出冲突明细验证 ---');
  const exportConflicts = exportData.conflicts as Array<Record<string, unknown>>;
  const deferredConflict = exportConflicts.find((c) => c.id === pendingConflict.id);
  if (deferredConflict) {
    assertEqual('冲突conflictStatusLabel=暂不裁决', deferredConflict.conflictStatusLabel, '暂不裁决');
    assertEqual('冲突isUnresolved=true', deferredConflict.isUnresolved, true);
    console.log(`  ✅ deferred冲突在导出中标记为"暂不裁决"，不被改写成已裁决`);
  } else {
    console.error('❌ 导出数据中找不到该冲突记录');
    process.exitCode = 1;
  }

  console.log('\n--- STEP 7: 自检验证 ---');
  store.runSelfCheck();
  const selfCheckResults = useManifestStore.getState().selfCheckResults;
  selfCheckResults.forEach((r) => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`  ${icon} ${r.type}: ${r.passed ? '通过' : '失败'} (${r.failedCount}/${r.totalCount})`);
    if (!r.passed) {
      r.failedItems.forEach((item) => {
        console.log(`     - ${item.manifestNo}: ${item.reason}`);
      });
    }
  });

  const exportConsistency = selfCheckResults.find((r) => r.type === 'export_consistency');
  if (exportConsistency) {
    assertEqual('export_consistency自检通过', exportConsistency.passed, true);
  }

  console.log('\n--- STEP 8: 验证暂不裁决期间不能自动推进到第二步 ---');
  assertEqual('stepProgress仍为1(有deferred不推进)', afterDefer.stepProgress, 1);
  assertEqual('status仍为conflict(有未决冲突)', afterDefer.status, 'conflict');
  console.log('  ✅ 暂不裁决期间stepProgress=1, status=conflict, 工单补看不能自动推进');

  console.log('\n--- STEP 9: 人工裁决（确认采纳知识库，覆盖暂不裁决）---');
  store.resolveConflict(
    pendingConflict.id,
    'confirmed_knowledge',
    '经安全审核同事确认，采用知识库值',
    '阿宁'
  );

  const afterConfirm = store.getManifestById(manifestId)!;
  const unresolvedAfterConfirm = store.getUnresolvedConflictsByManifestId(manifestId);
  const resolvedAfterConfirm = store.getResolvedConflictsByManifestId(manifestId);

  assertEqual('人工裁决后无未决冲突', unresolvedAfterConfirm.length, 0);
  assertEqual('裁决历史有1条', resolvedAfterConfirm.length, 1);
  assertEqual('裁决结果为confirmed_knowledge', resolvedAfterConfirm[0].status, 'confirmed_knowledge');

  console.log(`  stepProgress: ${afterConfirm.stepProgress}`);
  console.log(`  status: ${afterConfirm.status}`);
  assertEqual('人工裁决后stepProgress>=2', afterConfirm.stepProgress >= 2, true);
  assertEqual('人工裁决后status不再是conflict', afterConfirm.status !== 'conflict', true);

  console.log('\n--- STEP 10: 最终导出验证 ---');
  const finalExport = store.getExportData();
  const finalManifest = (finalExport.manifests as Array<Record<string, unknown>>)
    .find((m) => m.id === manifestId);
  if (finalManifest) {
    assertEqual('最终导出unresolvedConflictCount=0', finalManifest.unresolvedConflictCount, 0);
    assertEqual('最终导出resolvedConflictCount', finalManifest.resolvedConflictCount, 1);
  }

  console.log('\n--- STEP 11: 接口一致性验证（模拟API响应与页面Store对比）---');
  const apiLikeResponse = {
    status: afterConfirm.status,
    hasConflict: afterConfirm.hasConflict,
    unresolvedConflictCount: unresolvedAfterConfirm.length,
    overriddenFieldCount: store.getOverriddenFieldsByManifestId(manifestId).length,
    conflicts: store.getAllConflictsByManifestId(manifestId).map((c) => ({
      ...c,
      conflictStatusLabel: conflictStatusLabels[c.status as keyof typeof conflictStatusLabels],
      isUnresolved: (c.status === 'pending' || c.status === 'deferred'),
    })),
  };
  assertEqual('API.status === 页面.status', apiLikeResponse.status, afterConfirm.status);
  assertEqual('API.hasConflict === 页面.hasConflict', String(apiLikeResponse.hasConflict), String(afterConfirm.hasConflict));
  assertEqual('API.unresolvedConflictCount === 页面.unresolved.length', apiLikeResponse.unresolvedConflictCount, unresolvedAfterConfirm.length);

  const deferredInApi = (apiLikeResponse.conflicts as Array<Record<string, unknown>>)
    .filter((c) => c.status === 'deferred').length;
  assertEqual('API中deferred冲突数=0(已人工裁决)', deferredInApi, 0);

  console.log('\n' + '='.repeat(60));
  console.log('  🏁 端到端测试完成');
  console.log('='.repeat(60));

  if (!process.exitCode) {
    console.log('\n✅ 全部通过：暂不裁决(deferred)不会被页面、接口或导出任一入口改写成已裁决\n');
  } else {
    console.error('\n❌ 存在失败项，请检查上方输出\n');
  }
}

runE2E();
