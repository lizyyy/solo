function computeNextStatus(record, allRecords, conflicts = []) {
  if (record.status === 'rejected') return 'rejected';
  if (record.isCoordinateMixed) return 'pending_review';
  if (conflicts.some((c) => c.recordId === record.id && c.status === 'pending')) return 'pending_review';
  if (!record.cadLayer) return 'step1';
  if (record.siteInstruction) return 'step3';
  return 'step2';
}

let passCount = 0;
let failCount = 0;
const log = [];

function assert(condition, label) {
  if (condition) { passCount++; log.push(`  ✅ ${label}`); }
  else { failCount++; log.push(`  ❌ ${label}`); }
}

function section(title) { log.push(`\n=== ${title} ===`); }

function makeRecord(overrides = {}) {
  return {
    id: 'test-' + Math.random().toString(36).slice(2, 8),
    photoNumber: 'XJ-A01-2026',
    materialType: 'normal',
    status: 'step1',
    coordinate: { type: 'metric', metricX: 125.5, metricY: 86.75 },
    isCoordinateMixed: false,
    createdBy: '培训教官老梁',
    updatedBy: '培训教官老梁',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeConflict(recordId, type = 'photo_cad_mismatch', status = 'pending') {
  return {
    id: 'conflict-' + Math.random().toString(36).slice(2, 8),
    recordId,
    type,
    evidence: [{ description: '照片编号前缀(XJ)与CAD图层名前缀(PIPE)不一致', photoValue: 'XJ-A01-2026', cadValue: 'PIPE-M-A01' }],
    status,
  };
}

section('1. 基本三步流程（无冲突、无坐标混合）');
{
  const r1 = makeRecord({ status: 'step1' });
  assert(computeNextStatus(r1, [r1], []) === 'step1', 'Step1: 只有照片编号 → status=step1');
  const r2 = makeRecord({ status: 'step2', cadLayer: 'PIPE-M-A01' });
  assert(computeNextStatus(r2, [r2], []) === 'step2', 'Step2: 补录CAD后 → status=step2');
  const r3 = makeRecord({ status: 'step3', cadLayer: 'PIPE-M-A01', siteInstruction: '管线位置说明...' });
  assert(computeNextStatus(r3, [r3], []) === 'step3', 'Step3: 填写现场说明后 → status=step3');
}

section('2. 照片-CAD前缀冲突 → 未裁决时阻断');
{
  const record = makeRecord({ cadLayer: 'PIPE-M-A01', status: 'step2' });
  const conflict = makeConflict(record.id, 'photo_cad_mismatch', 'pending');
  const status = computeNextStatus(record, [record], [conflict]);
  assert(status === 'pending_review', `XJ≠PIPE未裁决 → status=${status}，应为pending_review`);
  const resolvedConflict = makeConflict(record.id, 'photo_cad_mismatch', 'resolved');
  const statusAfterResolve = computeNextStatus(record, [record], [resolvedConflict]);
  assert(statusAfterResolve === 'step2', `冲突裁决后 → status=${statusAfterResolve}，应回到step2`);
  const recordWithInst = makeRecord({ cadLayer: 'PIPE-M-A01', siteInstruction: '说明', status: 'pending_review' });
  const statusWithInst = computeNextStatus(recordWithInst, [recordWithInst], [resolvedConflict]);
  assert(statusWithInst === 'step3', `冲突裁决后+已有说明 → status=${statusWithInst}，应为step3`);
}

section('3. store层守卫：未裁决冲突 → updateSiteInstruction被拒绝');
{
  const record = makeRecord({ cadLayer: 'PIPE-M-A01', status: 'pending_review' });
  const conflict = makeConflict(record.id, 'photo_cad_mismatch', 'pending');
  const wouldBlock = conflict.status === 'pending' && conflict.recordId === record.id;
  assert(wouldBlock, '存在未裁决冲突 → store守卫应拒绝updateSiteInstruction');
  const resolved = makeConflict(record.id, 'photo_cad_mismatch', 'resolved');
  const wouldAllow = !(resolved.status === 'pending' && resolved.recordId === record.id);
  assert(wouldAllow, '冲突已裁决 → store守卫应允许updateSiteInstruction');
}

section('4. 页面层锁定：未裁决冲突 → canEditInstruction=false');
{
  const record = makeRecord({ cadLayer: 'PIPE-M-A01', status: 'pending_review' });
  const conflicts = [makeConflict(record.id, 'photo_cad_mismatch', 'pending')];
  const canEdit = !(record.status === 'rejected' || record.isCoordinateMixed === true || !record.cadLayer || conflicts.some((c) => c.recordId === record.id && c.status === 'pending'));
  assert(canEdit === false, `canEditInstruction=${canEdit}，未裁决冲突时应为false`);
  const resolvedConflicts = [makeConflict(record.id, 'photo_cad_mismatch', 'resolved')];
  const canEditAfterResolve = !(record.status === 'rejected' || record.isCoordinateMixed === true || !record.cadLayer || resolvedConflicts.some((c) => c.recordId === record.id && c.status === 'pending'));
  assert(canEditAfterResolve === true, `canEditInstruction=${canEditAfterResolve}，冲突裁决后应为true`);
}

section('5. 完整端到端样例：照片-CAD冲突从触发到解除');
{
  let record = makeRecord({ photoNumber: 'XJ-A01-2026', status: 'step1' });
  let conflicts = [];
  assert(computeNextStatus(record, [record], conflicts) === 'step1', '[Step1] 导入照片编号 → status=step1');
  record = makeRecord({ ...record, cadLayer: 'PIPE-M-A01', status: 'step2' });
  conflicts = [makeConflict(record.id, 'photo_cad_mismatch', 'pending')];
  assert(computeNextStatus(record, [record], conflicts) === 'pending_review', '[冲突] XJ≠PIPE → status=pending_review');
  const tryRecord = makeRecord({ ...record, siteInstruction: '尝试绕过冲突' });
  assert(computeNextStatus(tryRecord, [tryRecord], conflicts) === 'pending_review', '[阻断] 即使填了说明 → 仍pending_review');
  conflicts = [makeConflict(record.id, 'photo_cad_mismatch', 'resolved')];
  assert(computeNextStatus(record, [record], conflicts) === 'step2', '[老梁确认] 冲突裁决 → 回到step2');
  const done = makeRecord({ ...record, siteInstruction: '管线位于主机右侧第3根，口径DN80' });
  assert(computeNextStatus(done, [done], conflicts) === 'step3', '[Step3] 填写说明 → status=step3');
}

section('6. 老梁驳回 → rejected');
{
  const rejectedRecord = makeRecord({ ...makeRecord({ cadLayer: 'PIPE-M-A01' }), status: 'rejected' });
  const conflict = makeConflict(rejectedRecord.id, 'photo_cad_mismatch', 'resolved');
  conflict.resolution = 'reject';
  assert(computeNextStatus(rejectedRecord, [rejectedRecord], [conflict]) === 'rejected', '驳回 → 永远rejected');
  const tryRecover = makeRecord({ ...rejectedRecord, siteInstruction: '试图恢复' });
  assert(computeNextStatus(tryRecover, [tryRecover], [conflict]) === 'rejected', 'rejected后填说明 → 仍rejected');
}

section('7. 多条冲突记录互不影响');
{
  const r1 = makeRecord({ id: 'r1', cadLayer: 'PIPE-M-A01', status: 'pending_review' });
  const r2 = makeRecord({ id: 'r2', cadLayer: 'PIPE-L-B07', status: 'step2' });
  const c1 = makeConflict('r1', 'photo_cad_mismatch', 'pending');
  const c2 = makeConflict('r2', 'photo_cad_mismatch', 'resolved');
  assert(computeNextStatus(r1, [r1, r2], [c1, c2]) === 'pending_review', 'R1未裁决 → pending_review');
  assert(computeNextStatus(r2, [r1, r2], [c1, c2]) === 'step2', 'R2已裁决 → step2');
}

section('8. 坐标混合+冲突并存');
{
  const record = makeRecord({ cadLayer: 'PIPE-M-A01', isCoordinateMixed: true, status: 'pending_review' });
  const conflict = makeConflict(record.id, 'photo_cad_mismatch', 'pending');
  assert(computeNextStatus(record, [record], [conflict]) === 'pending_review', '坐标混合+冲突 → pending_review');
  const noConflict = makeConflict(record.id, 'photo_cad_mismatch', 'resolved');
  assert(computeNextStatus(record, [record], [noConflict]) === 'pending_review', '冲突已裁决但坐标混合未处理 → 仍pending');
  const noMixed = makeRecord({ ...record, isCoordinateMixed: false });
  assert(computeNextStatus(noMixed, [noMixed], [noConflict]) === 'step2', '坐标混合解除+冲突已裁决 → step2');
}

console.log(log.join('\n'));
console.log(`\n============================`);
console.log(`总计: ${passCount + failCount} 项, 通过 ${passCount}, 失败 ${failCount}`);
if (failCount > 0) { console.log('\n⚠️ 有测试未通过！'); process.exit(1); }
else { console.log('\n✅ 全部测试通过！'); }
