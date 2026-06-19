#!/usr/bin/env ts-node

import { ApprovalService } from '../src/services/ApprovalService';
import { DataStore } from '../src/store/DataStore';
import { ApprovalStatus, WorkflowStep, ImportItemCategory, DisplayMode } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

const logFile = path.join(__dirname, '../verify-results.log');
const logs: string[] = [];

function log(msg: string = '') {
  logs.push(msg);
  console.log(msg);
}

function logSection(title: string) {
  log('\n' + '═'.repeat(80));
  log(`  🎯 ${title}`);
  log('═'.repeat(80));
}

function logSubSection(title: string) {
  log('\n' + '─'.repeat(60));
  log(`  ${title}`);
  log('─'.repeat(60));
}

function logResult(description: string, actual: any, expected: any, pass: boolean) {
  const status = pass ? '✅ PASS' : '❌ FAIL';
  log(`  ${status} | ${description}`);
  log(`     实际: ${JSON.stringify(actual)}`);
  log(`     预期: ${JSON.stringify(expected)}`);
}

interface TestCase {
  description: string;
  actual: any;
  expected: any;
  check: (a: any, e: any) => boolean;
}

const testCases: TestCase[] = [];

function assertEq(description: string, actual: any, expected: any) {
  const pass = actual === expected;
  testCases.push({ description, actual, expected, check: (a, b) => a === b });
  logResult(description, actual, expected, pass);
  return pass;
}

function assertIncludes(description: string, actual: string, expectedSubstring: string) {
  const pass = actual?.includes(expectedSubstring);
  testCases.push({ description, actual, expected: expectedSubstring, check: (a, b) => a?.includes(b) });
  logResult(description, actual, `包含 "${expectedSubstring}"`, pass);
  return pass;
}

function assertGt(description: string, actual: number, expected: number) {
  const pass = actual > expected;
  testCases.push({ description, actual, expected, check: (a, b) => a > b });
  logResult(description, actual, `> ${expected}`, pass);
  return pass;
}

function runVerification() {
  log('🎭 剧院返场曲库审批系统 - 可复现验证脚本');
  log(`启动时间: ${new Date().toLocaleString()}`);
  log(`验证环境: ${process.env.NODE_ENV || 'development'}`);
  log(`Node版本: ${process.version}`);

  const store = DataStore.getInstance();
  store.clearAll();
  const service = new ApprovalService();

  logSection('【验证1】打开实际入口，导入曲目别名表第一次导入');
  logSubSection('1.1 导入样例数据');
  const batchId = 'BATCH-VERIFY-001';
  const trackData = [
    { trackId: 'TRK-VFY-001', trackName: '夜曲', aliases: ['Nocturne', '小夜曲'] },
    { trackId: 'TRK-VFY-002', trackName: '命运', aliases: ['Symphony No.5'] }
  ];
  const importResult = service.importTrackAliases(batchId, trackData, 'admin');

  log(`批次标识: ${batchId}`);
  log(`批次ID: ${importResult.batchId}`);
  log(`导入明细:`);
  importResult.itemDetails.forEach((d, i) => {
    log(`  ${i + 1}. ${d.trackId} - ${d.trackName} | ${d.category} | newRecordId: ${d.newRecordId}`);
  });

  assertEq('导入成功', importResult.success, true);
  assertEq('新记录数量', importResult.newRecordCount, 2);
  assertEq('本次重复数量', importResult.thisTimeDuplicateCount, 0);
  assertEq('历史重复数量', importResult.historicalDuplicateCount, 0);
  assertEq('生成审批记录数', service.getAllApprovals().length, 2);

  const approval1 = service.getApprovalByTrackId('TRK-VFY-001');
  const approval2 = service.getApprovalByTrackId('TRK-VFY-002');
  assertEq('初始步骤为别名导入', approval1?.currentStep, WorkflowStep.ALIAS_IMPORT);
  assertEq('初始状态为待处理', approval1?.status, ApprovalStatus.PENDING);

  logSubSection('1.2 上传并复核签到照片');
  const photo1 = service.uploadCheckinPhoto('CLASS-VFY-001', 'TRK-VFY-001', 'https://example.com/vfy-photo1.jpg', 'xiaolu');
  service.reviewCheckinPhoto(photo1.id, 'xiaolu');
  const photo2 = service.uploadCheckinPhoto('CLASS-VFY-001', 'TRK-VFY-002', 'https://example.com/vfy-photo2.jpg', 'xiaolu');
  service.reviewCheckinPhoto(photo2.id, 'xiaolu');
  log('已上传并复核 2 张签到照片');

  logSection('【验证2】尝试不补录排练变更 - 验证门控不能绕过');
  logSubSection('2.1 尝试跳过排练变更直接推进到 normal');
  const step1 = service.advanceWorkflow(approval1!.id, 'xiaolu');
  logResult('第一步推进（别名→照片）', step1.success, true, step1.success);
  assertEq('第一步推进成功', step1.success, true);

  const step2 = service.advanceWorkflow(approval1!.id, 'xiaolu');
  logResult('第二步推进（照片→排练）', step2.success, true, step2.success);
  assertEq('第二步推进成功', step2.success, true);

  const step3Blocked = service.advanceWorkflow(approval1!.id, 'xiaolu');
  logResult('第三步推进（无排练变更）', step3Blocked.success, false, !step3Blocked.success);
  assertEq('无排练变更时第三步被阻塞', step3Blocked.success, false);
  assertIncludes('错误提示包含「排练变更记录」', step3Blocked.error?.message || '', '排练变更记录');

  const approvalAfterBlocked = service.getApprovalByTrackId('TRK-VFY-001');
  assertEq('状态未变 normal，仍在复核中', approvalAfterBlocked?.status === ApprovalStatus.NORMAL, false);
  log(`当前状态: ${approvalAfterBlocked?.status} (预期: 不是 normal)`);

  logSubSection('2.2 补录排练变更记录');
  const rehearsal = service.addRehearsalChange('TRK-VFY-001', '时长调整', '延长10秒', 'xiaolu');
  log(`添加排练变更: ${rehearsal.id}`);

  const stepInfo = service.getWorkflowStepInfo(approval1!.id);
  log(`当前步骤: ${stepInfo?.step} | 可推进: ${stepInfo?.canAdvance} | 阻塞项: ${stepInfo?.blockers.length}`);
  assertEq('补录后可推进', stepInfo?.canAdvance, true);

  const step3Success = service.advanceWorkflow(approval1!.id, 'xiaolu');
  assertEq('补录后第三步推进成功', step3Success.success, true);

  const approvalFinal = service.getApprovalByTrackId('TRK-VFY-001');
  assertEq('最终状态为 normal', approvalFinal?.status, ApprovalStatus.NORMAL);
  log(`最终状态: ${approvalFinal?.status} ✅`);

  logSection('【验证3】刷新后重算 - 数据一致性验证');
  logSubSection('3.1 模拟刷新：重新查询所有数据');
  const refreshedApproval = service.getApprovalRecord(approval1!.id);
  const refreshedRemarks = service.getTrackRemarks('TRK-VFY-001');
  const refreshedHistory = service.getChangeHistory('approval_record', approval1!.id);

  assertEq('刷新后审批ID一致', refreshedApproval?.id, approval1?.id);
  assertEq('刷新后状态一致', refreshedApproval?.status, ApprovalStatus.NORMAL);
  assertGt('刷新后有变更历史', refreshedHistory.length, 0);
  log(`刷新后变更历史: ${refreshedHistory.length} 条`);

  logSection('【验证4】重复导入 - 三类区分');
  logSubSection('4.1 同批次重复导入（本次重复）');
  const sameBatchImport = service.importTrackAliases(batchId, trackData, 'admin');
  assertEq('同批次重复导入 - 新记录', sameBatchImport.newRecordCount, 0);
  assertEq('同批次重复导入 - 本次重复', sameBatchImport.thisTimeDuplicateCount, 2);
  assertEq('同批次重复导入 - 历史重复', sameBatchImport.historicalDuplicateCount, 0);
  assertEq('审批记录不翻倍', service.getAllApprovals().length, 2);

  sameBatchImport.itemDetails.forEach(d => {
    assertEq(`同批次 ${d.trackId} 分类为本次重复`, d.category, ImportItemCategory.THIS_TIME_DUPLICATE);
    assertEq(`同批次 ${d.trackId} 已有批次标识正确`, d.existingBatchIdentifier, batchId);
  });

  logSubSection('4.2 跨批次混合导入（历史重复 + 新记录）');
  const crossBatchData = [
    { trackId: 'TRK-VFY-001', trackName: '夜曲', aliases: ['Nocturne'] },
    { trackId: 'TRK-VFY-003', trackName: '月光', aliases: ['Moonlight'] }
  ];
  const crossBatchImport = service.importTrackAliases('BATCH-VERIFY-002', crossBatchData, 'admin');

  assertEq('跨批次混合 - 新记录', crossBatchImport.newRecordCount, 1);
  assertEq('跨批次混合 - 本次重复', crossBatchImport.thisTimeDuplicateCount, 0);
  assertEq('跨批次混合 - 历史重复', crossBatchImport.historicalDuplicateCount, 1);
  assertEq('审批记录只增加新记录', service.getAllApprovals().length, 3);

  const trk001Detail = crossBatchImport.itemDetails.find(d => d.trackId === 'TRK-VFY-001');
  const trk003Detail = crossBatchImport.itemDetails.find(d => d.trackId === 'TRK-VFY-003');
  assertEq('TRK-VFY-001 分类为历史重复', trk001Detail?.category, ImportItemCategory.HISTORICAL_DUPLICATE);
  assertEq('TRK-VFY-003 分类为新记录', trk003Detail?.category, ImportItemCategory.NEW_RECORD);
  assertEq('历史重复记录关联正确批次', trk001Detail?.existingBatchIdentifier, batchId);

  logSection('【验证5】轨道备注 - 小鹿只改一条');
  logSubSection('5.1 给两个曲目各加一条备注');
  const remark1 = service.addTrackRemark('TRK-VFY-001', 'TRK-VFY-001 初始备注', 'editor');
  const remark2 = service.addTrackRemark('TRK-VFY-002', 'TRK-VFY-002 初始备注', 'editor');
  assertEq('添加备注1成功', remark1.success, true);
  assertEq('添加备注2成功', remark2.success, true);

  logSubSection('5.2 小鹿只修改 TRK-VFY-001 的备注');
  const updateResult = service.updateTrackRemark(
    remark1.remark!.id,
    '小鹿修改后：这段有杂音需要返工重录',
    'xiaolu'
  );
  assertEq('修改备注成功', updateResult.success, true);

  logSubSection('5.3 验证变更历史 - 只改一条');
  const historyRmk1 = service.getChangeHistory('track_remark', remark1.remark!.id);
  const historyRmk2 = service.getChangeHistory('track_remark', remark2.remark!.id);

  assertEq('TRK-VFY-001 备注有1条变更历史', historyRmk1.length, 1);
  assertEq('TRK-VFY-002 备注无变更历史', historyRmk2.length, 0);

  if (historyRmk1.length > 0) {
    const h = historyRmk1[0];
    assertEq('修改人是小鹿', h.changedBy, 'xiaolu');
    assertEq('改前内容正确', h.oldValue, 'TRK-VFY-001 初始备注');
    assertIncludes('改后内容正确', h.newValue, '小鹿修改后');
    assertEq('关联导入批次', h.importBatchId, importResult.batchId);
    assertEq('关联受影响审批', h.affectedEntityId, approval1?.id);
    assertEq('关联受影响实体类型', h.affectedEntityType, 'approval_record');
    log(`变更历史: ${h.changedBy} 改了 ${h.entityType}.${h.fieldName}`);
    log(`  从: "${h.oldValue}"`);
    log(`  到: "${h.newValue}"`);
    log(`  影响审批: ${h.affectedEntityId}`);
    log(`  所属批次: ${h.importBatchId}`);
  }

  logSubSection('5.4 验证受影响查询 - 按审批维度区分');
  const affected1 = service.getChangeHistoryByAffected('approval_record', approval1!.id);
  const affected2 = service.getChangeHistoryByAffected('approval_record', approval2!.id);

  const xiaoluChange1 = affected1.find(h => h.entityType === 'track_remark' && h.changedBy === 'xiaolu');
  const xiaoluChange2 = affected2.find(h => h.entityType === 'track_remark' && h.changedBy === 'xiaolu');

  assertEq('TRK-VFY-001 审批关联到小鹿的修改', !!xiaoluChange1, true);
  assertEq('TRK-VFY-002 审批未关联到小鹿的修改', !!xiaoluChange2, false);
  log('小鹿只改一条备注的影响范围正确 ✅');

  logSection('【验证6】先服务复核 - 与重复导入判断一致');
  logSubSection('6.1 检测到返工原因时切换图表模式被阻塞');
  service.addTrackRemark('TRK-VFY-002', '需要返工修改', 'editor');
  const chartBlocked = service.setDisplayMode(approval2!.id, DisplayMode.CHART, 'xiaolu');
  assertEq('有返工原因时切换图表被阻塞', chartBlocked.success, false);
  assertIncludes('错误提示包含「服务复核」', chartBlocked.error?.message || '', '服务复核');

  logSubSection('6.2 导航回原始数据源');
  const navTargets = service.getNavigationTargets('TRK-VFY-001');
  const navTypes = navTargets.map(t => t.type);
  log(`可导航目标: ${navTypes.join(', ')}`);
  assertEq('可导航到别名表', navTypes.includes('alias_table'), true);
  assertEq('可导航到签到照片', navTypes.includes('checkin_photo'), true);
  assertEq('可导航到排练记录', navTypes.includes('rehearsal_record'), true);

  navTargets.forEach(t => {
    const navResult = service.navigateToSource('TRK-VFY-001', t.type as any, t.id);
    assertEq(`导航到 ${t.type} 成功`, navResult.success, true);
    assertEq(`导航来源正确`, navResult.context?.source, t.type);
  });

  logSection('【验证7】执行回滚 - 恢复明细和报告');
  logSubSection('7.0 新建独立曲目，专门用于测试 normal 状态回滚（避免状态污染）');
  const rollbackImport = service.importTrackAliases(
    'BATCH-VERIFY-ROLLBACK',
    [{ trackId: 'TRK-VFY-ROLLBACK', trackName: '回滚测试曲', aliases: ['RollbackTest'] }],
    'admin'
  );
  const approvalRollback = service.getApprovalByTrackId('TRK-VFY-ROLLBACK');
  
  const photoRb = service.uploadCheckinPhoto('CLASS-VFY-RB', 'TRK-VFY-ROLLBACK', 'https://example.com/rb.jpg', 'xiaolu');
  service.reviewCheckinPhoto(photoRb.id, 'xiaolu');
  service.addRehearsalChange('TRK-VFY-ROLLBACK', '回滚测试', '测试数据', 'xiaolu');
  
  service.advanceWorkflow(approvalRollback!.id, 'xiaolu');
  service.advanceWorkflow(approvalRollback!.id, 'xiaolu');
  service.advanceWorkflow(approvalRollback!.id, 'xiaolu');
  
  const approvalNormal = service.getApprovalByTrackId('TRK-VFY-ROLLBACK');
  log(`新建曲目最终状态: ${approvalNormal?.status} | 步骤: ${approvalNormal?.currentStep}`);
  assertEq('新建曲目状态为 normal', approvalNormal?.status, ApprovalStatus.NORMAL);

  logSubSection('7.1 normal 状态不能直接回滚');
  const rollbackBlocked = service.rollback(approvalRollback!.id, 'xiaolu', '测试直滚');
  assertEq('normal 状态直接回滚被拒绝', rollbackBlocked.success, false);
  assertIncludes('错误提示包含「正常」', rollbackBlocked.error?.message || '', '正常');

  logSubSection('7.2 推进工作流打快照 → 申请返工 → 批准 → 回滚');
  const approvalBefore = service.getApprovalByTrackId('TRK-VFY-001');
  log(`申请返工前状态: ${approvalBefore?.status} | 步骤: ${approvalBefore?.currentStep}`);
  
  service.addRehearsalChange('TRK-VFY-001', '返工前调整', '测试数据', 'xiaolu');
  service.advanceWorkflow(approval1!.id, 'xiaolu');
  service.advanceWorkflow(approval1!.id, 'xiaolu');
  service.advanceWorkflow(approval1!.id, 'xiaolu');
  
  const approvalBeforeApply = service.getApprovalByTrackId('TRK-VFY-001');
  log(`申请返工前（推进后）状态: ${approvalBeforeApply?.status} | 步骤: ${approvalBeforeApply?.currentStep}`);
  
  const applyResult = service.applyForRework(approval1!.id, '发现版权问题需要重审', 'editor');
  assertEq('提交返工申请成功', applyResult.success, true);

  const apps = service.getReworkApplications(approval1!.id);
  assertEq('有1条待审核申请', apps.length, 1);
  assertEq('申请状态为待审核', apps[0].status, 'pending_review');

  const approveResult = service.approveReworkApplication(apps[0].id, 'xiaolu');
  assertEq('批准返工申请成功', approveResult.success, true);

  const approvalAfterRework = service.getApprovalByTrackId('TRK-VFY-001');
  assertEq('批准后状态变为需返工', approvalAfterRework?.status, ApprovalStatus.REWORK_REQUIRED);
  log(`批准后状态: ${approvalAfterRework?.status} | 步骤: ${approvalAfterRework?.currentStep}`);

  logSubSection('7.3 执行回滚，验证数据恢复');
  const rollbackResult = service.rollback(approval1!.id, 'xiaolu', '版权问题，回滚到复核前');
  assertEq('回滚执行成功', rollbackResult.success, true);
  assertGt('恢复了至少1条备注', rollbackResult.restoredRemarks || 0, 0);
  log(`回滚后状态: ${rollbackResult.record?.status} | 步骤: ${rollbackResult.record?.currentStep}`);
  assertEq('回滚后步骤恢复到快照版本', rollbackResult.record?.currentStep, approvalBeforeApply?.currentStep);
  assertEq('回滚后状态恢复到快照版本', rollbackResult.record?.status, approvalBeforeApply?.status);

  logSubSection('7.4 回滚变更历史含快照关联');
  const approvalHistory = service.getChangeHistory('approval_record', approval1!.id);
  const rollbackEntries = approvalHistory.filter(h => h.changeReason?.includes('回滚'));
  assertGt('回滚有变更历史记录', rollbackEntries.length, 0);

  rollbackEntries.forEach(h => {
    assertEq('回滚历史有快照ID', !!h.snapshotId, true);
    log(`回滚记录: ${h.fieldName} ${h.oldValue}→${h.newValue} | snapshot: ${h.snapshotId}`);
  });

  logSection('【验证8】导出报告 - 关联同批次所有数据');
  logSubSection('8.1 按批次导出完整报告');
  const batchHistory = service.getChangeHistoryByBatch(importResult.batchId);
  const batchApprovals = service.getAllApprovals().filter(a => a.importBatchId === importResult.batchId);

  const exportReport = {
    exportTime: new Date().toISOString(),
    batchId: importResult.batchId,
    batchIdentifier: batchId,
    summary: {
      totalTracks: importResult.itemDetails.length,
      newRecords: importResult.newRecordCount,
      thisTimeDuplicates: importResult.thisTimeDuplicateCount,
      historicalDuplicates: importResult.historicalDuplicateCount,
      changeHistoryCount: batchHistory.length,
      approvalCount: batchApprovals.length
    },
    approvals: batchApprovals.map(a => ({
      trackId: a.trackId,
      approvalId: a.id,
      status: a.status,
      currentStep: a.currentStep,
      remarks: service.getTrackRemarks(a.trackId).map(r => ({
        id: r.id,
        content: r.content,
        hasReworkReason: r.hasReworkReason
      })),
      changeHistory: service.getChangeHistoryByAffected('approval_record', a.id)
    })),
    changeHistory: batchHistory
  };

  log(`导出报告摘要:`);
  log(`  批次: ${exportReport.batchIdentifier}`);
  log(`  曲目数: ${exportReport.summary.totalTracks}`);
  log(`  新记录: ${exportReport.summary.newRecords}`);
  log(`  本次重复: ${exportReport.summary.thisTimeDuplicates}`);
  log(`  历史重复: ${exportReport.summary.historicalDuplicates}`);
  log(`  变更历史: ${exportReport.summary.changeHistoryCount} 条`);
  log(`  审批记录: ${exportReport.summary.approvalCount} 条`);

  assertGt('导出报告有变更历史', exportReport.summary.changeHistoryCount, 0);
  assertEq('导出报告关联正确审批数', exportReport.summary.approvalCount, 2);

  exportReport.approvals.forEach(app => {
    log(`\n  ${app.trackId}:`);
    log(`    状态: ${app.status} | 步骤: ${app.currentStep}`);
    log(`    备注: ${app.remarks.length} 条`);
    log(`    变更: ${app.changeHistory.length} 条`);
    app.remarks.forEach(r => {
      log(`      - ${r.content} ${r.hasReworkReason ? '(⚠️ 返工)' : ''}`);
    });
  });

  logSection('【验证9】核对所有关联 - 重复导入明细');
  logSubSection('9.1 同批次重复导入明细核对');
  assertEq('同批次重复导入总数', sameBatchImport.importedCount, 2);
  assertEq('同批次重复导入明细数', sameBatchImport.itemDetails.length, 2);
  sameBatchImport.itemDetails.forEach(d => {
    assertEq(`${d.trackId} 关联已有批次`, !!d.existingBatchId, true);
    assertEq(`${d.trackId} 关联已有批次标识`, d.existingBatchIdentifier, batchId);
  });

  logSubSection('9.2 跨批次重复导入明细核对');
  assertEq('跨批次导入总数', crossBatchImport.importedCount, 2);
  assertEq('跨批次导入明细数', crossBatchImport.itemDetails.length, 2);
  crossBatchImport.itemDetails.forEach(d => {
    if (d.category === ImportItemCategory.HISTORICAL_DUPLICATE) {
      assertEq(`${d.trackId} 关联历史批次`, !!d.existingBatchId, true);
      assertEq(`${d.trackId} 关联历史批次标识`, d.existingBatchIdentifier, batchId);
    } else {
      assertEq(`${d.trackId} 有新记录ID`, !!d.newRecordId, true);
    }
  });

  logSection('📊 验证结果汇总');
  const passed = testCases.filter(t => t.check(t.actual, t.expected)).length;
  const failed = testCases.filter(t => !t.check(t.actual, t.expected)).length;
  log(`\n  总测试用例: ${testCases.length}`);
  log(`  ✅ 通过: ${passed}`);
  log(`  ❌ 失败: ${failed}`);

  if (failed > 0) {
    log('\n  失败用例:');
    testCases.filter(t => !t.check(t.actual, t.expected)).forEach(t => {
      log(`    - ${t.description}: 实际=${JSON.stringify(t.actual)}, 预期=${JSON.stringify(t.expected)}`);
    });
  }

  log('\n' + '═'.repeat(80));
  if (failed === 0) {
    log('  ✅ 所有验证用例通过！业务链路已正确接入');
    log('     不能再靠旧入口跳过排练变更记录');
    log('     重复导入、回滚、返工、小鹿改备注均已接入真实样例');
  } else {
    log('  ❌ 部分验证失败，请检查上方日志');
  }
  log('═'.repeat(80));

  fs.writeFileSync(logFile, logs.join('\n'), 'utf-8');
  log(`\n完整验证日志已写入: ${logFile}`);

  return {
    success: failed === 0,
    passed,
    failed,
    total: testCases.length,
    logFile
  };
}

const result = runVerification();
process.exit(result.success ? 0 : 1);
