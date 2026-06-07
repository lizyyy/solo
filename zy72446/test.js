const { initDatabase, prepare, exec } = require('./database');
const service = require('./service');

function assert(condition, message) {
  if (!condition) {
    console.error('❌ 测试失败:', message);
    process.exit(1);
  }
  console.log('✅', message);
}

function clearDatabase() {
  exec(`
    DELETE FROM operation_history;
    DELETE FROM workflow_steps;
    DELETE FROM room_linkages;
    DELETE FROM song_aliases;
    DELETE FROM contract_screenshots;
    DELETE FROM import_batches;
  `);
  console.log('🧹 数据库已清空');
}

async function runTests() {
  await initDatabase();
  
  console.log('\n========== 开始测试 ==========\n');

  clearDatabase();

  console.log('\n--- 测试1: 导入合同截图 ---');
  const testRows = [
    { song_name: '七里香 (Live)', hotel_name: '希尔顿酒店', room_type: '标准间', room_count: 5, original_row_number: 3 },
    { song_name: '七里香', hotel_name: '希尔顿酒店', room_type: '标准间', room_count: 5, original_row_number: 7 },
    { song_name: '晴天', hotel_name: '万豪酒店', room_type: '大床房', room_count: 3, original_row_number: 12 }
  ];
  
  const result1 = service.importContractScreenshots(testRows, '测试合同.csv', '阿梅');
  assert(result1.imported_rows === 3, `应该导入3条，实际${result1.imported_rows}条`);
  assert(result1.duplicate_rows === 0, `应该0条重复，实际${result1.duplicate_rows}条`);
  
  const contracts = prepare('SELECT * FROM contract_screenshots ORDER BY original_row_number').all();
  assert(contracts.length === 3, '数据库里应该有3条合同记录');
  assert(contracts[0].original_row_number === 3, '原始行号应该保留');
  assert(contracts[0].source_file === '测试合同.csv', '来源文件名应该保留');

  console.log('\n--- 测试2: 重复导入不翻倍 ---');
  const result2 = service.importContractScreenshots(testRows, '测试合同.csv', '阿梅');
  assert(result2.imported_rows === 0, `重复导入应该新增0条，实际${result2.imported_rows}条`);
  assert(result2.duplicate_rows === 3, `重复导入应该3条重复，实际${result2.duplicate_rows}条`);
  
  const contractsAfter = prepare('SELECT COUNT(*) as count FROM contract_screenshots').get().count;
  assert(contractsAfter === 3, `重复导入后总数还是3，实际${contractsAfter}条`);

  console.log('\n--- 测试3: 添加曲目别名 ---');
  const alias1 = service.addSongAlias('七里香', '七里香 (Live)', 'live_name', '曲目别名表V3', '阿梅');
  const alias2 = service.addSongAlias('七里香', '七里香', 'copyright_name', '版权合同', '阿梅');
  const alias3 = service.addSongAlias('晴天', '晴天', 'copyright_name', '版权合同', '阿梅');
  
  const aliases = prepare('SELECT * FROM song_aliases').all();
  assert(aliases.length === 3, '应该有3条别名记录');

  console.log('\n--- 测试4: 检测现场名和版权名冲突 ---');
  const qiliXiangContract = contracts.find(c => c.song_name === '七里香 (Live)');
  const conflict = service.checkNameConflict('七里香 (Live)', qiliXiangContract.id);
  assert(conflict.hasConflict === true, '七里香应该检测到冲突');
  assert(conflict.conflictType === 'live_vs_copyright', '冲突类型应该是现场名vs版权名');
  console.log('   冲突详情:', conflict.detail);

  console.log('\n--- 测试5: 联动状态应该是待复核，不是正常 ---');
  const linkage = prepare('SELECT * FROM room_linkages WHERE contract_screenshot_id = ?').get(qiliXiangContract.id);
  assert(linkage.linkage_status === 'pending_review', `有冲突的应该是pending_review，实际是${linkage.linkage_status}`);
  assert(linkage.conflict_detail !== null, '冲突详情不能为空');

  const sunnyContract = contracts.find(c => c.song_name === '晴天');
  const linkage2 = prepare('SELECT * FROM room_linkages WHERE contract_screenshot_id = ?').get(sunnyContract.id);
  assert(linkage2.linkage_status === 'normal', `晴天没有冲突应该是normal，实际是${linkage2.linkage_status}`);

  console.log('\n--- 测试6: 修改备注留历史 ---');
  const contractId = contracts[0].id;
  service.updateContractRemarks(contractId, '这是第一条备注', '阿梅');
  service.updateContractRemarks(contractId, '这是修改后的备注', '阿梅');
  
  const history = prepare(`
    SELECT * FROM operation_history 
    WHERE entity_type = 'contract_screenshot' AND entity_id = ? AND field_name = 'remarks'
    ORDER BY created_at DESC
  `).all(contractId);
  
  assert(history.length >= 2, '至少有2条备注修改历史');
  assert(history[0].old_value !== history[0].new_value, '改前改后值不同');
  console.log('   改前:', JSON.parse(history[0].old_value));
  console.log('   改后:', JSON.parse(history[0].new_value));

  console.log('\n--- 测试7: 三步工作流 ---');
  const workflow = prepare('SELECT * FROM workflow_steps WHERE contract_screenshot_id = ? ORDER BY step_order').all(contractId);
  assert(workflow.length === 3, '应该有3个工作流步骤');
  assert(workflow[0].step_name === 'contract_import', '第一步是导入');
  assert(workflow[0].step_status === 'completed', '导入步骤应该自动完成');
  assert(workflow[1].step_status === 'pending', '核对别名表还没做');
  assert(workflow[2].step_status === 'pending', '更新周报还没做');

  service.updateWorkflowStep(contractId, 'alias_check', 'completed', '阿梅', '已核对曲目别名表V3');
  const workflowAfter = prepare('SELECT step_status FROM workflow_steps WHERE contract_screenshot_id = ? ORDER BY step_order').all(contractId);
  assert(workflowAfter[1].step_status === 'completed', '核对别名表已完成');

  console.log('\n--- 测试8: 音乐老师复核 ---');
  const pendingLinkage = prepare("SELECT * FROM room_linkages WHERE linkage_status = 'pending_review' LIMIT 1").get();
  assert(pendingLinkage !== undefined, '有待复核的记录');
  
  service.reviewLinkage(pendingLinkage.id, 'confirm_normal', '经确认是同一首歌', '音乐老师');
  
  const afterReview = prepare('SELECT * FROM room_linkages WHERE id = ?').get(pendingLinkage.id);
  assert(afterReview.linkage_status === 'normal', '复核后应该变成normal');
  assert(afterReview.reviewed_by === '音乐老师', '复核人应该是音乐老师');
  assert(afterReview.review_note === '经确认是同一首歌', '复核意见应该保存');

  const reviewHistory = prepare(`
    SELECT * FROM operation_history 
    WHERE entity_type = 'room_linkage' AND entity_id = ? AND operation_type = 'review'
  `).get(pendingLinkage.id);
  assert(reviewHistory !== undefined, '复核操作应该留历史');

  console.log('\n--- 测试9: 店长周报数据 ---');
  const weeklyData = service.getWeeklyReportData();
  assert(weeklyData.length > 0, '周报应该有数据');
  console.log('   周报条目数:', weeklyData.length);
  weeklyData.forEach(d => {
    console.log(`   - ${d.song_canonical_name}: ${d.total_rooms}间 ${d.linkage_status}`);
  });

  console.log('\n--- 测试10: 获取完整证据链 ---');
  const fullData = service.getContractWithHistory(contractId);
  assert(fullData.contract !== undefined, '有合同数据');
  assert(fullData.linkage !== undefined, '有联动数据');
  assert(fullData.workflow.length === 3, '有3个工作流步骤');
  assert(fullData.history.length > 0, '有操作历史');
  console.log('   证据链完整:', {
    contract: fullData.contract.song_name,
    linkage: fullData.linkage.linkage_status,
    workflow_steps: fullData.workflow.length,
    history_count: fullData.history.length
  });

  console.log('\n========== 全部测试通过 ==========\n');
  
  const stats = prepare(`
    SELECT 
      (SELECT COUNT(*) FROM contract_screenshots) as contracts,
      (SELECT COUNT(*) FROM room_linkages) as linkages,
      (SELECT COUNT(*) FROM song_aliases) as aliases,
      (SELECT COUNT(*) FROM operation_history) as history,
      (SELECT COUNT(*) FROM workflow_steps) as workflow
  `).get();
  
  console.log('📊 最终数据统计:');
  console.log('   合同截图:', stats.contracts);
  console.log('   房型联动:', stats.linkages);
  console.log('   曲目别名:', stats.aliases);
  console.log('   操作历史:', stats.history);
  console.log('   工作流步骤:', stats.workflow);
  console.log('\n🎯 所有边界规则验证通过!');
}

runTests().catch(e => {
  console.error('\n❌ 测试出错:', e.message);
  console.error(e.stack);
  process.exit(1);
});
