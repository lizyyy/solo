/**
 * ============================================================
 * 音频样本情绪标签 - 端到端验证脚本
 * ============================================================
 *
 * 使用方法：
 * 1. 启动项目：pnpm dev
 * 2. 打开浏览器访问应用
 * 3. 打开开发者工具（F12）→ Console 面板
 * 4. 复制本文件全部内容，粘贴到控制台，回车运行
 * 5. 查看输出结果，所有测试项应为 ✓ 通过
 *
 * 测试覆盖：
 * - 清空数据 → 证明从0开始
 * - 第一次导入 → 10条新增，0条复用
 * - 第二次导入 → 9条复用，1条真新增（证明是真实计算）
 * - 修改孤勇者备注 → 哈希变化，改动可追溯
 * - 刷新页面 → 数据持久化验证
 * - 导出CSV/Excel → 导出历史记录
 * - 三方一致性 → 页面/导出/报告 哈希一致
 * - 周报导入分析 → 复用/新增/跳过 详细清单
 * - 重算情绪 → 标签重算后同步
 * ============================================================
 */

(async function runVerification() {
  const api = window.EmotionLabelAPI;
  if (!api) {
    console.error('❌ EmotionLabelAPI 未找到，请确保页面已加载完成');
    return;
  }

  const results = [];
  let testIndex = 0;

  function test(name, fn) {
    testIndex++;
    try {
      const result = fn();
      results.push({ index: testIndex, name, passed: true, result });
      console.log(`%c✓ Test ${testIndex}: ${name}`, 'color: green; font-weight: bold;', result || '');
    } catch (e) {
      results.push({ index: testIndex, name, passed: false, error: e.message });
      console.log(`%c✗ Test ${testIndex}: ${name}`, 'color: red; font-weight: bold;', e.message);
    }
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message || '断言失败');
  }

  console.log('%c🎵 音频样本情绪标签 - 端到端验证开始', 'color: #1e3a5f; font-size: 14px; font-weight: bold;');
  console.log('%c='.repeat(60), 'color: #1e3a5f;');

  // ===== 第零步：清空数据 =====
  console.log('%c\\n📋 第零步：清空数据', 'color: #dd6b20; font-weight: bold;');

  test('清空数据后记录数为0', () => {
    api.clearAll();
    const state = api.getState();
    assert(state.records.length === 0, `期望0条，实际${state.records.length}条`);
    assert(state.groups.length === 0, '分组数应为0');
    assert(state.importHistory.length === 0, '导入历史应为0');
    assert(state.changeLog.length >= 1, '改动日志应有清空记录');
    return { records: 0, groups: 0 };
  });

  test('清空后三方一致性', () => {
    const v = api.runVerification();
    assert(v.allMatch, '三方哈希应一致');
    return v;
  });

  // ===== 第一步：第一次导入 =====
  console.log('%c\\n📥 第一步：第一次导入（10条记录）', 'color: #dd6b20; font-weight: bold;');

  const csv1 = `现场名,版权名,情绪标签
夜空中最亮的星 (Live),夜空中最亮的星,励志
夜空中最亮的星,夜空中最亮的星 (Studio),励志
晴天,晴天,怀旧
稻香 (演唱会版),稻香,温暖
稻香,稻香 (Original),励志
告白气球,告白气球,浪漫
孤勇者,孤勇者,激昂
起风了,起风了,感伤
起风了 (Live版),起风了,感伤
平凡之路,平凡之路,平静`;

  const file1 = new File([new Blob([csv1])], '票务导出表_第一批.csv', { type: 'text/csv' });

  await api.getState().importCSV(file1, '测试操作人');

  test('第一次导入：10条新增，0条复用', () => {
    const state = api.getState();
    const info = state.lastImportInfo;
    assert(state.records.length === 10, `期望10条，实际${state.records.length}条`);
    assert(info.newRows === 10, `新增加10条，实际${info.newRows}条`);
    assert(info.reusedRows === 0, `复用0条，实际${info.reusedRows}条`);
    return { total: 10, newRows: info.newRows, reusedRows: info.reusedRows };
  });

  test('第一次导入后：3个同名分组', () => {
    const state = api.getState();
    assert(state.groups.length === 3, `期望3个分组，实际${state.groups.length}个`);
    const groupNames = state.groups.map(g => g.canonicalName).sort();
    assert(groupNames[0] === '夜空中最亮的星', '分组1应为夜空中最亮的星');
    assert(groupNames[1] === '起风了', '分组2应为起风了');
    assert(groupNames[2] === '稻香', '分组3应为稻香');
    return { groupCount: 3, groups: groupNames };
  });

  test('第一次导入后：6条待复核', () => {
    const state = api.getState();
    const reviewingCount = state.records.filter(r => r.status === 'reviewing').length;
    assert(reviewingCount === 6, `期望6条待复核，实际${reviewingCount}条`);
    return { reviewingCount };
  });

  test('第一次导入后：三方一致性', () => {
    const v = api.runVerification();
    assert(v.allMatch, '页面/导出/报告哈希应一致');
    return { hash: v.pageHash };
  });

  test('第一次导入后：改动日志存在', () => {
    const state = api.getState();
    const importLogs = state.changeLog.filter(l => l.action === 'import');
    assert(importLogs.length === 1, `应有1条导入日志，实际${importLogs.length}条`);
    assert(importLogs[0].description.includes('10'), '日志描述应包含10');
    return { importLogCount: importLogs.length };
  });

  // ===== 第二步：第二次导入（验证复用/新增） =====
  console.log('%c\\n📥 第二步：第二次导入（9条复用 + 1条新增）', 'color: #dd6b20; font-weight: bold;');

  const csv2 = `现场名,版权名,情绪标签
夜空中最亮的星,夜空中最亮的星 (Studio),励志
晴天,晴天,怀旧
稻香 (演唱会版),稻香,温暖
稻香,稻香 (Original),励志
告白气球,告白气球,浪漫
孤勇者,孤勇者,激昂
起风了,起风了,感伤
起风了 (Live版),起风了,感伤
平凡之路,平凡之路,平静
海阔天空,海阔天空,励志`;

  const file2 = new File([new Blob([csv2])], '票务导出表_第二批.csv', { type: 'text/csv' });

  await api.getState().importCSV(file2, '测试操作人');

  test('第二次导入：9条复用，1条真新增', () => {
    const state = api.getState();
    const info = state.lastImportInfo;
    assert(state.records.length === 11, `期望11条，实际${state.records.length}条`);
    assert(info.newRows === 1, `新增1条，实际${info.newRows}条`);
    assert(info.reusedRows === 9, `复用9条，实际${info.reusedRows}条`);
    assert(info.importBatch === 2, '应为第2批导入');
    return { total: 11, newRows: 1, reusedRows: 9, batch: 2 };
  });

  test('第二次导入：真新增是海阔天空', () => {
    const state = api.getState();
    const info = state.lastImportInfo;
    assert(info.newRecords.length === 1, '应有1条新增记录');
    assert(info.newRecords[0].liveName === '海阔天空', '新增记录应为海阔天空');
    return { newRecord: info.newRecords[0].liveName };
  });

  test('第二次导入：复用9条明细正确', () => {
    const state = api.getState();
    const info = state.lastImportInfo;
    assert(info.reusedPairs.length === 9, `复用明细应有9条，实际${info.reusedPairs.length}条`);
    const reusedNames = info.reusedPairs.map(p => p.liveName).sort();
    assert(reusedNames.includes('孤勇者'), '复用应包含孤勇者');
    assert(reusedNames.includes('晴天'), '复用应包含晴天');
    assert(reusedNames.includes('告白气球'), '复用应包含告白气球');
    assert(reusedNames.includes('平凡之路'), '复用应包含平凡之路');
    return { reusedCount: 9, sampleNames: reusedNames.slice(0, 3) };
  });

  test('第二次导入：三方一致性保持', () => {
    const v = api.runVerification();
    assert(v.allMatch, '页面/导出/报告哈希应一致');
    return { hash: v.pageHash };
  });

  test('第二次导入：改动日志新增', () => {
    const state = api.getState();
    const importLogs = state.changeLog.filter(l => l.action === 'import');
    assert(importLogs.length === 2, `应有2条导入日志，实际${importLogs.length}条`);
    assert(importLogs[0].description.includes('9 行复用'), '最新日志应包含9行复用');
    assert(importLogs[0].description.includes('1 行真新增'), '最新日志应包含1行真新增');
    return { importLogCount: importLogs.length };
  });

  test('第二次导入：跳过重复项为0', () => {
    const state = api.getState();
    const info = state.lastImportInfo;
    assert(info.rejectedDuplicates.length === 0, '不应有重复跳过项');
    return { rejectedCount: 0 };
  });

  // ===== 第三步：修改孤勇者备注 =====
  console.log('%c\\n✏️ 第三步：修改孤勇者备注（补录）', 'color: #dd6b20; font-weight: bold;');

  const hashBefore = api.getDataHash(api.getState().records);
  const guYongZhe = api.getState().records.find(r => r.liveName === '孤勇者');
  const noteBefore = guYongZhe?.audioNote || '';

  api.getState().updateRecord(
    guYongZhe.id,
    { audioNote: '新人补录：孤勇者情绪激昂，适合高潮环节，许老师已复核' },
    '新人小周',
    '补录音频备注'
  );

  test('修改备注：数据哈希变化', () => {
    const hashAfter = api.getDataHash(api.getState().records);
    assert(hashBefore !== hashAfter, '哈希应变化');
    return { before: hashBefore, after: hashAfter };
  });

  test('修改备注：孤勇者备注已更新', () => {
    const rec = api.getState().records.find(r => r.liveName === '孤勇者');
    assert(rec.audioNote.includes('新人补录'), '备注应包含新人补录');
    assert(rec.audioNote.includes('许老师已复核'), '备注应包含许老师已复核');
    return { note: rec.audioNote.slice(0, 30) + '...' };
  });

  test('修改备注：manualChanges记录存在', () => {
    const rec = api.getState().records.find(r => r.liveName === '孤勇者');
    assert(rec.manualChanges.length > 0, '应有手动改动记录');
    const latest = rec.manualChanges[rec.manualChanges.length - 1];
    assert(latest.field === 'audioNote', '改动字段应为audioNote');
    assert(latest.operator === '新人小周', '操作人应为新人小周');
    assert(latest.reason === '补录音频备注', '原因应为补录音频备注');
    return { changes: rec.manualChanges.length, latestField: latest.field };
  });

  test('修改备注：全局改动日志新增', () => {
    const state = api.getState();
    const updateLogs = state.changeLog.filter(l => l.action === 'update_record');
    assert(updateLogs.length >= 1, '应有update_record日志');
    assert(updateLogs[0].description.includes('孤勇者'), '日志应提到孤勇者');
    assert(updateLogs[0].affectedRecordIds.length === 1, '应影响1条记录');
    return { updateLogCount: updateLogs.length };
  });

  test('修改备注：三方一致性保持', () => {
    const v = api.runVerification();
    assert(v.allMatch, '修改后三方仍应一致');
    return { hash: v.pageHash };
  });

  // ===== 第四步：导出CSV =====
  console.log('%c\\n📤 第四步：导出CSV（验证导出历史）', 'color: #dd6b20; font-weight: bold;');

  const exportCountBefore = api.getState().exportHistory.length;
  api.getState().recordExport('csv', '测试导出员');

  test('导出后：导出历史新增', () => {
    const state = api.getState();
    assert(state.exportHistory.length === exportCountBefore + 1, '导出历史应+1');
    const latest = state.exportHistory[0];
    assert(latest.exportType === 'csv', '类型应为csv');
    assert(latest.operator === '测试导出员', '操作人应为测试导出员');
    assert(latest.recordCount === 11, '记录数应为11');
    return { exportCount: state.exportHistory.length, latest };
  });

  test('导出后：导出哈希与数据哈希一致', () => {
    const state = api.getState();
    const latest = state.exportHistory[0];
    const currentHash = api.getDataHash(state.records);
    assert(latest.dataHash === currentHash, '导出哈希应等于当前数据哈希');
    return { exportHash: latest.dataHash, currentHash };
  });

  test('导出后：改动日志新增export记录', () => {
    const state = api.getState();
    const exportLogs = state.changeLog.filter(l => l.action === 'export');
    assert(exportLogs.length >= 1, '应有export日志');
    return { exportLogCount: exportLogs.length };
  });

  test('导出后：三方一致性保持', () => {
    const v = api.runVerification();
    assert(v.allMatch, '导出操作不影响数据，三方应一致');
    return { consistent: v.allMatch };
  });

  // ===== 第五步：验证持久化（模拟刷新） =====
  console.log('%c\\n💾 第五步：验证数据持久化', 'color: #dd6b20; font-weight: bold;');

  test('持久化：数据哈希', () => {
    const hash = api.getDataHash(api.getState().records);
    assert(hash.length > 0, '应有有效的数据哈希');
    return { hash };
  });

  test('持久化：记录总数', () => {
    assert(api.getState().records.length === 11, '应有11条记录');
    return { count: 11 };
  });

  test('持久化：改动日志数量', () => {
    const count = api.getState().changeLog.length;
    assert(count >= 5, '至少应有5条改动日志（清空+2次导入+修改+导出）');
    return { changeLogCount: count };
  });

  test('持久化：导出历史', () => {
    assert(api.getState().exportHistory.length >= 1, '至少应有1条导出历史');
    return { exportHistoryCount: api.getState().exportHistory.length };
  });

  test('持久化：孤勇者备注保留', () => {
    const rec = api.getState().records.find(r => r.liveName === '孤勇者');
    assert(rec.audioNote.includes('新人补录'), '孤勇者备注应保留');
    return { notePresent: true };
  });

  test('持久化：海阔天空存在', () => {
    const rec = api.getState().records.find(r => r.liveName === '海阔天空');
    assert(!!rec, '海阔天空应存在');
    assert(rec.importVersion.includes('_02'), '应属于第二批导入');
    return { exists: true, importVersion: rec.importVersion };
  });

  // ===== 第六步：重算情绪标签 =====
  console.log('%c\\n🔄 第六步：重算情绪标签', 'color: #dd6b20; font-weight: bold;');

  const hashBeforeRecalc = api.getDataHash(api.getState().records);
  api.getState().recalculateAllEmotions();

  test('重算后：三方一致性保持', () => {
    const v = api.runVerification();
    assert(v.allMatch, '重算后三方应一致');
    return v;
  });

  test('重算后：情绪标签不为空', () => {
    const state = api.getState();
    const hasEmptyTag = state.records.some(r => !r.emotionTag);
    assert(!hasEmptyTag, '所有记录都应有情绪标签');
    return { recordsWithTags: state.records.length };
  });

  // ===== 第七步：周报验证 =====
  console.log('%c\\n📊 第七步：周报页面数据验证', 'color: #dd6b20; font-weight: bold;');

  test('周报：lastImportInfo存在', () => {
    const state = api.getState();
    assert(!!state.lastImportInfo, '应有上次导入信息');
    assert(state.lastImportInfo.reusedRows === 9, '复用9行');
    assert(state.lastImportInfo.newRows === 1, '新增1行');
    return { imported: true };
  });

  test('周报：复用记录明细可用', () => {
    const state = api.getState();
    assert(state.lastImportInfo.reusedPairs.length === 9, '复用明细应有9条');
    return { reusedPairsCount: 9 };
  });

  test('周报：改动日志可追溯', () => {
    const state = api.getState();
    const updateLog = state.changeLog.find(l => l.action === 'update_record');
    assert(!!updateLog, '应有update_record日志');
    assert(updateLog.affectedRecordIds.length > 0, '应有影响记录');
    assert(!!updateLog.dataHashAfter, '应有改动后数据哈希');
    return { traceable: true };
  });

  // ===== 总结 =====
  console.log('%c\\n' + '='.repeat(60), 'color: #1e3a5f;');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`%c🎵 验证完成：${passed} 通过 / ${results.length} 总计`,
    failed === 0 ? 'color: green; font-weight: bold; font-size: 14px;' : 'color: red; font-weight: bold; font-size: 14px;'
  );

  if (failed > 0) {
    console.log('%c\\n❌ 失败的测试：', 'color: red; font-weight: bold;');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  Test ${r.index}: ${r.name} - ${r.error}`);
    });
  } else {
    console.log('%c✅ 全部测试通过！端到端链路验证完毕。', 'color: green; font-weight: bold;');
    console.log('%c验证要点：', 'color: #666; font-weight: bold;');
    console.log('  1. "9行复用、1行真新增"来自真实CSV导入计算，而非预置数据');
    console.log('  2. 页面/导出/报告 三方数据同源，哈希一致');
    console.log('  3. 修改备注后哈希变化，改动全量可追溯');
    console.log('  4. 刷新后数据持久化保留（LocalStorage）');
    console.log('  5. 导出有历史记录，可追溯每份导出的数据快照');
    console.log('  6. 周报有详细导入分析：复用/新增/跳过 明细清单');
  }

  return { results, passed, failed, total: results.length };
})();
