import { importFromCsv, getRecords, getRecordById, reviewRecord, confirmRecord, rollbackRecord, getReport, getReportCsv } from './api/services/recordService.js';
import { getAuditLogsByRecordId } from './api/services/auditService.js';
import fs from 'fs';

const separator = (t) => console.log(`\n${'═'.repeat(60)}\n ${t}\n${'─'.repeat(60)}`);
const pass = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => { console.log(`  ❌ ${msg}`); process.exitCode = 1; };
const info = (label, val) => {
  if (typeof val === 'object') {
    console.log(`  ℹ️  ${label}: ${JSON.stringify(val)}`);
  } else {
    console.log(`  ℹ️  ${label}: ${val}`);
  }
};

let tests = 0;
let passes = 0;

function assert(cond, desc) {
  tests++;
  if (cond) { passes++; pass(desc); } else fail(desc);
}

async function main() {
  // 清理旧数据
  try { fs.unlinkSync('./data/wave-tank.db'); } catch(_) {}

  separator('0. 角色值统一测试');
  {
    const { normalizeRole, roleToLabel } = await import('./api/services/recordService.js');

    assert(normalizeRole('training_coach') === 'training_coach', `training_coach 规范化保持不变`);
    assert(normalizeRole('coach') === 'training_coach', `历史角色 'coach' 规范化为 training_coach`);
    assert(normalizeRole('senior') === 'training_coach', `历史角色 'senior' 规范化为 training_coach`);
    assert(normalizeRole('maintenance') === 'maintenance_worker', `历史角色 'maintenance' 规范化为 maintenance_worker`);
    assert(normalizeRole('engineer_lead') === 'engineer', `历史角色 'engineer_lead' 规范化为 engineer`);
    assert(normalizeRole('engineer') === 'engineer', `engineer 保持不变`);
    assert(roleToLabel('training_coach') === '训练教练', '角色标签：训练教练');
    assert(roleToLabel('coach') === '训练教练', '角色标签兼容历史值 coach → 训练教练');
    assert(roleToLabel('maintenance_worker') === '维修师傅', '角色标签：维修师傅');
    assert(roleToLabel('engineer') === '实验工程师', '角色标签：实验工程师');
  }

  separator('1. 导入：混用检测');
  const buf = fs.readFileSync('./test-data.csv');
  const imp = await importFromCsv(buf, 'test.csv');
  info('导入批次', { fileName: imp.batch.fileName, total: imp.batch.totalCount, mixed: imp.batch.mixedCount });
  assert(imp.records.length === 15, '导入 15 条记录');
  assert(imp.batch.mixedCount === 10, '其中 10 条混用待复核（S001, S003, S005）');
  assert(imp.batch.totalCount === 15, '批次总数正确');

  // 统计各传感器
  const groups = {};
  imp.records.forEach(r => (groups[r.sensorId] = groups[r.sensorId] || []).push(r));
  info('传感器分组', {
    S001_total: groups.S001.length, S001_mixed: groups.S001.filter(r => r.status === 'mixed_unit').length,
    S002_total: groups.S002.length, S002_mixed: groups.S002.filter(r => r.status === 'mixed_unit').length,
    S003_total: groups.S003.length, S003_mixed: groups.S003.filter(r => r.status === 'mixed_unit').length,
    S004_total: groups.S004.length, S004_mixed: groups.S004.filter(r => r.status === 'mixed_unit').length,
    S005_total: groups.S005.length, S005_mixed: groups.S005.filter(r => r.status === 'mixed_unit').length,
  });
  assert(groups.S001.filter(r => r.status === 'mixed_unit').length === 4, 'S001 4条混用');
  assert(groups.S002.filter(r => r.status === 'normal').length === 3, 'S002 3条正常');
  assert(groups.S003.filter(r => r.status === 'mixed_unit').length === 3, 'S003 3条混用');
  assert(groups.S004.filter(r => r.status === 'normal').length === 2, 'S004 2条正常');
  assert(groups.S005.filter(r => r.status === 'mixed_unit').length === 3, 'S005 3条混用');

  // 混入记录不自动转换
  const s001 = groups.S001[0]; // 原始 25.5 C
  info('S001 第1条（混用）', { value: s001.temperatureValue, unit: s001.temperatureUnit, corrected: s001.correctedValue });
  assert(s001.correctedValue === null, '混用记录不自动转换，correctedValue 保持 null');
  assert(s001.status === 'mixed_unit', '混用记录 status = mixed_unit');
  assert(s001.credibility === 'pending_confirmation', '混用记录 credibility = pending_confirmation');
  assert(s001.source === 'sensor_original', '混用记录 source = sensor_original');
  assert(s001.originalLineNo === 1, '保留原始行号');

  separator('2. 维修师傅（maintenance_worker）复核标记照片可信');
  const targetId = s001.id;
  const reviewed = await reviewRecord(targetId, {
    credibility: 'photo_trusted',
    correctedValue: 298.65,
    correctedUnit: 'K',
    note: '工况照片显示传感器 S001 应使用开尔文',
    operatorRole: 'maintenance_worker',
  });
  info('复核后', { correctedValue: reviewed.correctedValue, correctedUnit: reviewed.correctedUnit,
          status: reviewed.status, credibility: reviewed.credibility, source: reviewed.source });
  assert(reviewed.correctedValue === 298.65, '修正值写入 298.65');
  assert(reviewed.correctedUnit === 'K', '修正单位写入 K');
  assert(reviewed.status === 'anomaly', '复核后 status = anomaly（待确认）');
  assert(reviewed.credibility === 'photo_trusted', '复核后 credibility = photo_trusted');
  assert(reviewed.source === 'photo_corrected', '复核后 source = photo_corrected');
  assert(reviewed.temperatureValue === 25.5, '原始值保留不变（25.5）');
  assert(reviewed.temperatureUnit === 'C', '原始单位保留不变（C）');

  // 检查审计日志
  const logs1 = await getAuditLogsByRecordId(targetId);
  info('审计日志条数', logs1.length);
  assert(logs1.length === 2, '有 2 条审计日志（1 导入 + 1 复核）');
  const reviewLog = logs1[1];
  assert(reviewLog.action === 'review', '第2条是 review 操作');
  assert(reviewLog.operatorRole === 'maintenance_worker', '操作人角色规范化为 maintenance_worker');
  assert(reviewLog.oldValue !== null, '审计日志保留修改前的值');
  assert(reviewLog.newValue !== null, '审计日志保留修改后的值');
  info('原始→新值', `${reviewLog.oldValue?.substring(0, 80)}... → ${reviewLog.newValue?.substring(0, 80)}...`);

  separator('3. 维修师傅确认（应该失败）');
  try {
    await confirmRecord(targetId, 'maintenance_worker', '维修师傅试确认');
    assert(false, '维修师傅确认应该抛出错误');
  } catch(e) {
    assert(e.message.includes('训练教练'), '错误提示包含"训练教练"，明确告知角色');
    info('错误信息', e.message);
  }

  separator('4. 训练教练（training_coach）确认 ✅');
  const confirmed = await confirmRecord(targetId, 'training_coach', '确认使用开尔文单位，与工况照片一致');
  info('确认后', { status: confirmed.status, credibility: confirmed.credibility, source: confirmed.source, note: confirmed.note });
  assert(confirmed.status === 'confirmed', '确认后 status = confirmed');
  assert(confirmed.credibility === 'photo_trusted', '确认后 credibility = photo_trusted');
  assert(confirmed.source === 'coach_confirmed', '确认后 source = coach_confirmed');
  assert(confirmed.temperatureValue === 25.5, '确认后原始值仍保留（25.5）');
  assert(confirmed.temperatureUnit === 'C', '确认后原始单位仍保留（C）');
  assert(confirmed.correctedValue === 298.65, '确认后修正值仍保留（298.65）');
  assert(confirmed.correctedUnit === 'K', '确认后修正单位仍保留（K）');

  const logs2 = await getAuditLogsByRecordId(targetId);
  assert(logs2.length === 3, '现在有 3 条审计日志（+1 confirm）');
  const confirmLog = logs2[2];
  assert(confirmLog.action === 'confirm', '第3条是 confirm 操作');
  assert(confirmLog.operatorRole === 'training_coach', '操作人角色 training_coach');

  separator('5. 报告：摘要与分组同步同一份数据');
  const report = await getReport();
  info('报告摘要', report.summary);
  assert(report.summary.totalRecords === 15, '报告总数 15 = 导入条数');
  assert(report.summary.confirmedCount === 1, '报告已确认 1 条');
  assert(report.summary.normalCount === 5, '报告正常 5 条');
  assert(report.summary.mixedCount === 9, '报告单位混用 9 条（原10 - 已确认1）');
  assert(report.summary.rolledBackCount === 0, '报告已回滚 0 条');

  const s001_group = report.groups.find(g => g.sensorId === 'S001');
  const s001_confirmed_record = s001_group.records.find(r => r.id === targetId);
  assert(s001_confirmed_record.status === 'confirmed', '分组中的同一条记录状态为 confirmed');
  assert(s001_confirmed_record.source === 'coach_confirmed', '分组中的同一条记录 source 一致');
  assert(s001_confirmed_record.correctedValue === 298.65, '分组中的同一条记录修正值一致');

  separator('6. 训练教练（training_coach）回滚');
  const rolled = await rollbackRecord(targetId, '复核时发现工况照片拍摄角度不对，恢复原始值', 'training_coach');
  info('回滚后', { status: rolled.status, credibility: rolled.credibility, source: rolled.source,
            correctedValue: rolled.correctedValue, correctedUnit: rolled.correctedUnit, note: rolled.note });
  assert(rolled.status === 'rolled_back', '回滚后 status = rolled_back');
  assert(rolled.correctedValue === null, '回滚后修正值清空');
  assert(rolled.correctedUnit === null, '回滚后修正单位清空');
  assert(rolled.temperatureValue === 25.5, '回滚后原始值仍保留（25.5）');
  assert(rolled.temperatureUnit === 'C', '回滚后原始单位仍保留（C）');
  assert(rolled.source === 'rolled_back', '回滚后 source = rolled_back');
  assert(rolled.note.includes('拍摄角度不对'), '回滚原因记录在 note 中');

  const logs3 = await getAuditLogsByRecordId(targetId);
  assert(logs3.length === 4, '现在有 4 条审计日志（+1 rollback）');
  assert(logs3[3].action === 'rollback', '第4条是 rollback 操作');

  separator('7. 报告摘要：再次同步（回滚后的变化）');
  const report2 = await getReport();
  info('报告摘要（回滚后）', report2.summary);
  assert(report2.summary.rolledBackCount === 1, '报告已回滚 1 条');
  assert(report2.summary.confirmedCount === 0, '报告已确认 0 条（1条被回滚）');
  assert(report2.summary.totalRecords === 15, '报告总数 15 不变');

  // 回滚后的记录在分组中的状态同步
  const s001_group2 = report2.groups.find(g => g.sensorId === 'S001');
  const s001_rolled = s001_group2.records.find(r => r.id === targetId);
  assert(s001_rolled.status === 'rolled_back', '分组中同一条记录回滚状态一致');
  assert(s001_rolled.source === 'rolled_back', '分组中同一条记录 source 一致');

  separator('8. 导出 CSV：与报告页面展示同一份数据');
  const csv = await getReportCsv();
  const lines = csv.split('\n');
  info('CSV', { header: lines[0], lines: lines.length });
  assert(lines.length === 16, 'CSV 1 表头 + 15 数据行 = 16');
  assert(lines[0].includes('下一步找谁'), 'CSV 包含"下一步找谁"列');
  assert(lines[0].includes('原始温度'), 'CSV 保留原始值');
  assert(lines[0].includes('修正后温度'), 'CSV 包含修正值');
  assert(lines[0].includes('展示温度'), 'CSV 包含展示值（与页面显示一致逻辑）');
  assert(lines[0].includes('处理状态'), 'CSV 包含处理状态');
  assert(lines[0].includes('单位混用风险'), 'CSV 包含单位混用风险');

  // 确认回滚记录的行
  const rollRow = lines.find(l => l.includes(targetId.substring(0, 8)));
  if (rollRow) {
    info('回滚记录的CSV行', rollRow.substring(0, 200) + '...');
    assert(rollRow.includes('已回滚'), 'CSV 中回滚记录状态正确（已回滚）');
  } else {
    info('回滚ID', targetId);
  }

  separator('9. 兼容历史角色 coach → 确认');
  const s001_other = groups.S001[1];
  const result = await confirmRecord(s001_other.id, 'coach', '兼容历史角色 coach 也可确认');
  assert(result.status === 'confirmed', `兼容历史角色 'coach' 仍可正常确认`);

  separator('10. 列表筛选：同步最新状态');
  const list_mixed = await getRecords({ status: 'mixed_unit', pageSize: 100 });
  info('混用列表数', list_mixed.total);
  assert(list_mixed.total === 8, '当前混用待复核 8 条（10 初始 - 1 确认 - 1 回滚）');

  const list_confirmed = await getRecords({ status: 'confirmed', pageSize: 100 });
  info('确认列表数', list_confirmed.total);
  assert(list_confirmed.total === 1, '已确认 1 条（兼容 coach 的那一条）');

  const list_rolled = await getRecords({ status: 'rolled_back', pageSize: 100 });
  info('回滚列表数', list_rolled.total);
  assert(list_rolled.total === 1, '已回滚 1 条');

  console.log(`\n${'═'.repeat(60)}\n📊 测试总结：${passes}/${tests} 通过\n${'═'.repeat(60)}`);
  fs.writeFileSync('/tmp/report.csv', '\uFEFF' + csv);
  console.log(`报告 CSV 已导出: /tmp/report.csv (${csv.length} bytes)`);
}

main().catch(e => {
  console.error('\n❌ 测试异常:', e);
  console.error(e.stack);
  process.exit(1);
});
