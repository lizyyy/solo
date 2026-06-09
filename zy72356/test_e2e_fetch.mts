import fs from 'fs';

const BASE = 'http://localhost:3002/api';

const pass = (msg: string) => console.log(`  ✅ ${msg}`);
const fail = (msg: string) => { console.log(`  ❌ ${msg}`); process.exitCode = 1; };
let total = 0, ok = 0;
function assert(cond: boolean, desc: string) {
  total++;
  if (cond) { ok++; pass(desc); } else fail(desc);
}
function sep(t: string) { console.log(`\n${'═'.repeat(60)}\n ${t}\n${'─'.repeat(60)}`); }
function info(label: string, val: unknown) {
  console.log(`  ℹ️  ${label}: ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`);
}

async function request<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, opts);
  return r.json() as Promise<T>;
}

async function main() {
  // 先清空，再重启后端重新建库，现在已有 db，直接用前面导入的15条
  sep('1. 读取列表：混用记录数');
  const list = await request<any>('/records?status=mixed_unit&pageSize=100');
  info('混用记录数', list.data.total);
  assert(list.data.total === 10, '导入后混用待复核 = 10');
  const s001_list = list.data.records.filter((r: any) => r.sensorId === 'S001');
  info('S001 记录数', s001_list.length);
  const target = s001_list[0];
  assert(target.status === 'mixed_unit', '目标记录状态 = mixed_unit');
  assert(target.credibility === 'pending_confirmation', '目标记录可信度 = pending_confirmation');
  assert(target.originalLineNo > 0, '保留原始行号');
  info('目标记录ID', target.id);

  sep('2. 维修师傅确认 → 权限拒绝');
  const deny1 = await request<any>(`/records/${target.id}/confirm`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operatorRole: 'maintenance_worker', note: '修' }),
  });
  assert(deny1.success === false, '维修师傅确认 = 失败');
  assert(String(deny1.error).includes('训练教练'), '错误提示说明：仅训练教练能确认');
  info('错误信息', deny1.error);

  sep('3. 维修师傅 review（照片可信 + 修正值）');
  const rev = await request<any>(`/records/${target.id}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operatorRole: 'maintenance_worker',
      credibility: 'photo_trusted',
      correctedValue: 298.65, correctedUnit: 'K',
      note: '工况照片显示S001应使用K',
    }),
  });
  const r = rev.data;
  info('复核后', { status: r.status, cred: r.credibility, src: r.source, cv: r.correctedValue, cu: r.correctedUnit });
  assert(rev.success === true, '维修师傅 review = 成功');
  assert(r.status === 'anomaly', '复核后 status = anomaly');
  assert(r.credibility === 'photo_trusted', '复核后 credibility = photo_trusted');
  assert(r.source === 'photo_corrected', '复核后 source = photo_corrected');
  assert(r.correctedValue === 298.65, '复核后 修正值 = 298.65K');
  assert(r.temperatureValue === target.temperatureValue, '原始值仍保留不变');

  sep('4. 报告摘要（确认前）');
  const rp1 = await request<any>('/report');
  info('摘要', rp1.data.summary);
  assert(rp1.data.summary.totalRecords === 15, '总数 = 15');
  assert(rp1.data.summary.mixedCount === 10, '混用数不变（review 不改混用计数）');
  assert(rp1.data.summary.confirmedCount === 0, '已确认 = 0');
  assert(rp1.data.summary.rolledBackCount === 0, '已回滚 = 0');
  const s001_group = rp1.data.groups.find((g: any) => g.sensorId === 'S001');
  const inGroup = s001_group.records.find((x: any) => x.id === target.id);
  assert(inGroup.status === 'anomaly', '分组中的同一条记录状态同步 = anomaly');

  sep('5. 训练教练 training_coach → 确认 ✅');
  const conf = await request<any>(`/records/${target.id}/confirm`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operatorRole: 'training_coach', note: '和工况照片一致' }),
  });
  const c = conf.data;
  info('确认后', { status: c.status, cred: c.credibility, src: c.source, cv: c.correctedValue, cu: c.correctedUnit });
  assert(conf.success === true, '训练教练确认 = 成功');
  assert(c.status === 'confirmed', '确认后 status = confirmed');
  assert(c.source === 'coach_confirmed', '确认后 source = coach_confirmed');
  assert(c.correctedValue === 298.65, '确认后修正值保留');
  assert(c.correctedUnit === 'K', '确认后修正单位保留');
  assert(c.temperatureValue === target.temperatureValue, '确认后原始值仍保留');

  sep('6. 报告摘要（确认后）');
  const rp2 = await request<any>('/report');
  info('摘要', rp2.data.summary);
  assert(rp2.data.summary.confirmedCount === 1, '已确认 +1');
  assert(rp2.data.summary.mixedCount === 9, '混用 -1 = 9');

  sep('7. 兼容历史角色 coach 确认 S001 另一条');
  const target2 = s001_list[1];
  const conf2 = await request<any>(`/records/${target2.id}/confirm`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operatorRole: 'coach', note: '兼容历史值' }),
  });
  assert(conf2.success === true, `历史角色 'coach' 也能确认 = 成功`);
  assert(conf2.data.status === 'confirmed', '确认后状态 = confirmed');

  sep('8. 审计日志（4步操作：导入+review+confirm+rollback前）');
  const logs = await request<any>(`/records/${target.id}/audit-log`);
  info('审计条数', logs.data.length);
  assert(logs.data.length >= 3, '目标记录至少 3 条审计（导入 / review / confirm）');
  assert(logs.data[1].action === 'review', '第2条 action = review');
  assert(logs.data[1].operatorRole === 'maintenance_worker', 'review 操作人角色规范化 = maintenance_worker');
  assert(logs.data[2].action === 'confirm', '第3条 action = confirm');
  assert(logs.data[2].operatorRole === 'training_coach', 'confirm 操作人角色 = training_coach');
  assert(logs.data[2].note.includes('工况照片一致'), '教练确认备注记录');

  sep('9. 训练教练 → 回滚目标记录');
  const rb = await request<any>(`/records/${target.id}/rollback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operatorRole: 'training_coach', reason: '工况照片角度有问题，需要重拍' }),
  });
  const rbData = rb.data;
  info('回滚后', { status: rbData.status, src: rbData.source, cv: rbData.correctedValue, note: rbData.note });
  assert(rb.success === true, '回滚成功');
  assert(rbData.status === 'rolled_back', '回滚后 status = rolled_back');
  assert(rbData.correctedValue === null, '回滚后修正值清空');
  assert(rbData.correctedUnit === null, '回滚后修正单位清空');
  assert(rbData.source === 'rolled_back', '回滚后 source = rolled_back');
  assert(rbData.note.includes('角度有问题'), '回滚原因写入 note');
  assert(rbData.temperatureValue === target.temperatureValue, '回滚后原始值仍保留');

  sep('10. 报告摘要（回滚后）');
  const rp3 = await request<any>('/report');
  info('摘要', rp3.data.summary);
  assert(rp3.data.summary.confirmedCount === 1, '已确认 = 1（target 回滚了，但 target2 还在）');
  assert(rp3.data.summary.rolledBackCount === 1, '已回滚 = 1');
  assert(rp3.data.summary.mixedCount === 8, '混用 = 8（原10 - 已确认2 + 回滚后状态不是mixed 0）');

  const inGroup3 = rp3.data.groups.find((g: any) => g.sensorId === 'S001').records.find((x: any) => x.id === target.id);
  assert(inGroup3.status === 'rolled_back', '分组中同一条记录状态同步 = rolled_back');

  sep('11. 列表筛选同步更新');
  const rolledList = await request<any>('/records?status=rolled_back&pageSize=10');
  assert(rolledList.data.total === 1, '筛选 rolled_back = 1 条');
  const confList = await request<any>('/records?status=confirmed&pageSize=10');
  assert(confList.data.total === 1, '筛选 confirmed = 1 条（只剩 target2）');
  const mixedList = await request<any>('/records?status=mixed_unit&pageSize=100');
  assert(mixedList.data.total === 8, '筛选 mixed_unit = 8 条');

  sep('12. CSV 导出列与页面同一份逻辑');
  const csvRes = await fetch(`${BASE}/report/export?format=csv`);
  const csv = await csvRes.text();
  const lines = csv.split('\n').filter(Boolean);
  info('CSV', { 行数: lines.length });
  assert(lines.length === 16, 'CSV 1表头+15行');
  const header = lines[0];
  const needCols = ['下一步找谁', '原始温度', '修正后温度', '展示温度', '处理状态', '可信度结论', '单位混用风险'];
  needCols.forEach(col => assert(header.includes(col), `CSV 包含列: ${col}`));

  const targetLine = lines.find(l => l.includes(target.id.substring(0, 10)));
  if (targetLine) {
    assert(targetLine.includes('已回滚'), 'CSV 中目标记录状态 = 已回滚');
    info('回滚记录CSV前200字', targetLine.substring(0, 200));
  }

  console.log(`\n${'═'.repeat(60)}\n📊 HTTP E2E 测试：${ok}/${total} 通过\n${'═'.repeat(60)}`);
}

main().catch(e => { console.error(e.stack || e); process.exit(1); });
