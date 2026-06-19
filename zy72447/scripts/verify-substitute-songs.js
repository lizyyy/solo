#!/usr/bin/env node
/**
 * 临时替补曲目识别验证脚本
 * 验证：王五（替补）- 临时替上 - 小星星 → 曲目=小星星，替补说明=临时替上
 *      钱七 - 替补，代班 - 土耳其进行曲 → 曲目=土耳其进行曲，替补说明=替补，代班
 *
 * 运行方式: node scripts/verify-substitute-songs.js
 */

const { defaultStore } = require('../dist/store');
const { importGroupSignupFile } = require('../dist/importers/group-signup');
const { importContractFile } = require('../dist/importers/contract-screenshot');
const { runReconciliation, confirmResult } = require('../dist/core/reconciliation');
const { exportResultsToExcel } = require('../dist/exporters');
const {
  buildDetailRow,
  detailRowToExportColumns,
  buildLogRow,
  FIELD_LABELS
} = require('../dist/shared/presenter');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const EXPORT_PATH = path.join(__dirname, '..', 'test-output-substitute-songs.xlsx');

function verify(label, actual, expected, critical = false) {
  const ok = actual === expected;
  const status = ok ? '✓' : '✗';
  const detail = ok ? '' : ` (实际: ${actual})`;
  console.log(`  ${status} ${label}: ${expected}${detail}`);
  if (!ok && critical) {
    throw new Error(`关键验证失败: ${label}`);
  }
  return ok;
}

async function main() {
  console.log('========================================');
  console.log('  临时替补曲目识别 - 完整验证脚本');
  console.log('========================================\n');

  // 重置数据
  defaultStore.resetState('verify-script');
  console.log('✓ 数据已重置\n');

  // ====== Step 1: 导入排练群接龙 ======
  console.log('【Step 1】导入排练群接龙样例');
  const groupResult = importGroupSignupFile(
    defaultStore,
    './examples/group-signup.txt',
    '票务同事A'
  );
  console.log(`  批次ID: ${groupResult.batchId}`);
  console.log(`  记录数: ${groupResult.recordCount}\n`);

  // 验证接龙记录
  const state = defaultStore.getState();
  const wangwu = state.groupRecords.find((g) => g.performerName === '王五');
  const qianqi = state.groupRecords.find((g) => g.performerName === '钱七');
  const zhangsan = state.groupRecords.find((g) => g.performerName === '张三');

  console.log('--- 接龙记录验证 ---');
  console.log('\n王五 (行号3):');
  console.log(`  原始内容: ${wangwu.rawContent}`);
  verify('接龙原始行号', wangwu.originalRowNumber, 3, true);
  verify('表演者', wangwu.performerName, '王五', true);
  verify('曲目 (songName)', wangwu.songName, '小星星', true);
  verify('替补标记', wangwu.isTemporarySubstitute, true, true);
  verify('替补说明 (substituteNote)', wangwu.substituteNote, '临时替上', true);

  console.log('\n钱七 (行号5):');
  console.log(`  原始内容: ${qianqi.rawContent}`);
  verify('接龙原始行号', qianqi.originalRowNumber, 5, true);
  verify('表演者', qianqi.performerName, '钱七', true);
  verify('曲目 (songName)', qianqi.songName, '土耳其进行曲', true);
  verify('替补标记', qianqi.isTemporarySubstitute, true, true);
  verify('替补说明 (substituteNote)', qianqi.substituteNote, '替补，代班', true);

  console.log('\n张三 (行号1，对比用):');
  verify('曲目', zhangsan.songName, '月光奏鸣曲');
  verify('替补标记', zhangsan.isTemporarySubstitute, false);

  // ====== Step 2: 导入合同 Part1 ======
  console.log('\n【Step 2】导入合同 Part1 (张三李四赵六)');
  const contractResult = importContractFile(
    defaultStore,
    './examples/contract-part1.txt',
    '老周'
  );
  console.log(`  批次ID: ${contractResult.batchId}\n`);

  // ====== Step 3: 初次核对 ======
  console.log('【Step 3】初次核对');
  const reconResult = runReconciliation(defaultStore, '系统');
  console.log(`  新增: ${reconResult.created}  更新: ${reconResult.updated}\n`);

  const details = defaultStore.getResultsWithDetails();

  // 验证核对结果曲目
  console.log('--- 核对结果验证 ---');
  details.forEach((d) => {
    const name = d.result.matchedPerformerName;
    if (name !== '王五' && name !== '钱七') return;
    const row = buildDetailRow(d.result, d.groupRecord, d.contractRecord);
    console.log(`\n${name}:`);
    verify('  状态', row.statusLabel, '待复核');
    verify('  最终曲目 (songName)', row.songName, name === '王五' ? '小星星' : '土耳其进行曲', true);
    verify('  接龙解析曲目 (groupSongName)', row.groupSongName, name === '王五' ? '小星星' : '土耳其进行曲', true);
    verify('  替补备注 (groupSubstituteNote)', row.groupSubstituteNote, name === '王五' ? '临时替上' : '替补，代班', true);
    verify('  接龙原始行号 (groupOriginalRowNumber)', row.groupOriginalRowNumber, name === '王五' ? 3 : 5, true);
    verify('  原始内容 (groupRawContent)', row.groupRawContent, d.groupRecord.rawContent);

    // 关键验证：曲目不是替补说明
    const song = row.songName;
    const notPolluted =
      song !== '临时替上' &&
      song !== '替补' &&
      song !== '替补，代班' &&
      song !== '代班';
    verify('  关键: 曲目未被替补说明污染', notPolluted, true, true);
  });

  // ====== Step 4: 确认已匹配的 ======
  console.log('\n【Step 4】人工确认 3 条已匹配 (张三李四赵六)');
  const matched = details.filter((d) => d.result.status === 'matched');
  for (const m of matched) {
    confirmResult(defaultStore, m.result.id, '老周', '核对无误');
  }
  console.log(`  已确认: ${matched.length} 条\n`);

  // ====== Step 5: 导入晚到合同 ======
  console.log('【Step 5】导入晚到合同 (孙八)');
  const lateResult = importContractFile(
    defaultStore,
    './examples/contract-part2-late.txt',
    '老周',
    true
  );
  console.log(`  批次ID: ${lateResult.batchId} (晚到模式)\n`);

  // ====== Step 6: 晚到增量核对 ======
  console.log('【Step 6】晚到增量核对');
  const lateRecon = runReconciliation(defaultStore, '系统', {
    lateContractBatchId: lateResult.batchId,
    preserveConfirmed: true
  });
  console.log(`  更新: ${lateRecon.updated}  跳过(已确认): ${lateRecon.skipped}\n`);

  // 验证晚到后临时替补未被污染
  const afterLate = defaultStore.getResultsWithDetails();
  const wangwuLate = afterLate.find((d) => d.result.matchedPerformerName === '王五');
  const qianqiLate = afterLate.find((d) => d.result.matchedPerformerName === '钱七');
  console.log('--- 晚到核对后验证 ---');
  verify('  王五曲目不变', wangwuLate.result.matchedSongName, '小星星');
  verify('  钱七曲目不变', qianqiLate.result.matchedSongName, '土耳其进行曲');
  verify('  王五状态不变', wangwuLate.result.status, 'needs_review');
  verify('  钱七状态不变', qianqiLate.result.status, 'needs_review');

  // ====== Step 7: 全量重算 ======
  console.log('\n【Step 7】全量重算 (模拟刷新/重算按钮)');
  const forceRecon = runReconciliation(defaultStore, '系统', {
    preserveConfirmed: false
  });
  console.log(`  更新: ${forceRecon.updated}  新增: ${forceRecon.created}\n`);

  const afterForce = defaultStore.getResultsWithDetails();
  const wangwuForce = afterForce.find((d) => d.result.matchedPerformerName === '王五');
  const qianqiForce = afterForce.find((d) => d.result.matchedPerformerName === '钱七');
  console.log('--- 重算后验证 ---');
  verify('  王五曲目重算后仍正确', wangwuForce.result.matchedSongName, '小星星', true);
  verify('  钱七曲目重算后仍正确', qianqiForce.result.matchedSongName, '土耳其进行曲', true);

  // ====== Step 8: 导出明细 ======
  console.log('\n【Step 8】导出 Excel 明细');
  if (fs.existsSync(EXPORT_PATH)) fs.unlinkSync(EXPORT_PATH);
  exportResultsToExcel(defaultStore, EXPORT_PATH);
  console.log(`  导出文件: ${EXPORT_PATH}\n`);

  // 验证导出内容
  const wb = XLSX.readFile(EXPORT_PATH);
  const ws = wb.Sheets['核对明细'];
  const exportRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  console.log('--- 导出内容验证 ---');
  const wangwuExport = exportRows.find((r) => r[FIELD_LABELS.performerName] === '王五');
  const qianqiExport = exportRows.find((r) => r[FIELD_LABELS.performerName] === '钱七');

  console.log('\n王五导出列:');
  verify(`  ${FIELD_LABELS.songName}`, wangwuExport[FIELD_LABELS.songName], '小星星', true);
  verify(`  ${FIELD_LABELS.groupSongName}`, wangwuExport[FIELD_LABELS.groupSongName], '小星星', true);
  verify(`  ${FIELD_LABELS.groupSubstituteNote}`, wangwuExport[FIELD_LABELS.groupSubstituteNote], '临时替上', true);
  verify(`  ${FIELD_LABELS.groupOriginalRowNumber}`, Number(wangwuExport[FIELD_LABELS.groupOriginalRowNumber]), 3, true);

  console.log('\n钱七导出列:');
  verify(`  ${FIELD_LABELS.songName}`, qianqiExport[FIELD_LABELS.songName], '土耳其进行曲', true);
  verify(`  ${FIELD_LABELS.groupSongName}`, qianqiExport[FIELD_LABELS.groupSongName], '土耳其进行曲', true);
  verify(`  ${FIELD_LABELS.groupSubstituteNote}`, qianqiExport[FIELD_LABELS.groupSubstituteNote], '替补，代班', true);
  verify(`  ${FIELD_LABELS.groupOriginalRowNumber}`, Number(qianqiExport[FIELD_LABELS.groupOriginalRowNumber]), 5, true);

  // 防污染验证
  console.log('\n--- 全局防污染验证 ---');
  const polluted = exportRows.filter((r) => {
    if (r[FIELD_LABELS.groupIsTempSubstitute] !== '是') return false;
    const song = r[FIELD_LABELS.songName];
    const groupSong = r[FIELD_LABELS.groupSongName];
    return (
      ['临时替上', '替补', '替补，代班', '代班'].includes(song) ||
      ['临时替上', '替补', '替补，代班', '代班'].includes(groupSong)
    );
  });
  verify('  临时替补记录曲目不包含替补说明', polluted.length, 0, true);

  // ====== Step 9: 历史记录验证 ======
  console.log('\n【Step 9】历史操作日志验证');
  const wangwuResult = afterForce.find((d) => d.result.matchedPerformerName === '王五');
  const logs = defaultStore.getLogsForEntity(wangwuResult.result.id);
  console.log(`  王五的操作日志: ${logs.length} 条`);
  logs.slice().reverse().forEach((log) => {
    const row = buildLogRow(log);
    console.log(`    ${row.timestamp.substring(11, 19)} | ${row.operationType} | ${row.operator} | ${row.notes || ''}`);
  });

  // ====== 汇总 ======
  console.log('\n========================================');
  console.log('  验证通过 ✓');
  console.log('========================================');
  console.log('\n核心字段对应关系:');
  console.log('  王五:');
  console.log('    原始内容 → "3. 王五（替补）- 临时替上 - 小星星"');
  console.log('    表演者 (performerName) → 王五');
  console.log('    曲目 (songName) → 小星星');
  console.log('    替补说明 (substituteNote) → 临时替上');
  console.log('    接龙原始行号 → 3');
  console.log('  钱七:');
  console.log('    原始内容 → "5. 钱七 - 替补，代班 - 土耳其进行曲"');
  console.log('    表演者 (performerName) → 钱七');
  console.log('    曲目 (songName) → 土耳其进行曲');
  console.log('    替补说明 (substituteNote) → 替补，代班');
  console.log('    接龙原始行号 → 5');
  console.log('\n覆盖链路: 导入 → 保存 → 核对 → 晚到增量 → 重算 → 导出');
  console.log(`\n导出文件已保留: ${EXPORT_PATH}`);
}

main().catch((e) => {
  console.error('\n✗ 验证失败:', e.message);
  if (fs.existsSync(EXPORT_PATH)) fs.unlinkSync(EXPORT_PATH);
  process.exit(1);
});
