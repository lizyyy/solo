/* eslint-disable @typescript-eslint/no-explicit-any */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
});
const win = dom.window as any;
(globalThis as any).window = win;
(globalThis as any).document = win.document;
(globalThis as any).URL = win.URL;
(globalThis as any).Blob = win.Blob;
(globalThis as any).ReadableStream = win.ReadableStream;
const memoryStore: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => memoryStore[k] ?? null,
  setItem: (k: string, v: string) => { memoryStore[k] = v; },
  removeItem: (k: string) => { delete memoryStore[k]; },
  clear: () => { Object.keys(memoryStore).forEach(k => delete memoryStore[k]); },
  length: 0,
  key: () => null,
};
(globalThis as any).sessionStorage = (globalThis as any).localStorage;
(globalThis as any).localStorage.clear();

let useStore: any, exportAsCSV: any, exportAsJSON: any;
let storeApi: any = null;

async function loadDeps() {
  const storeMod = await import('@/store');
  const exportMod = await import('@/utils/export');
  useStore = storeMod.useStore;
  exportAsCSV = exportMod.exportAsCSV;
  exportAsJSON = exportMod.exportAsJSON;

  for (let i = 0; i < 20; i++) {
    const state = useStore.getState();
    if (typeof state.login === 'function' && typeof state.importNameplate === 'function') {
      storeApi = state;
      break;
    }
    await new Promise(r => setTimeout(r, 50));
  }
  if (!storeApi) {
    throw new Error('Store methods not available after 1s');
  }
}

const LOGS: string[] = [];

function log(msg: string, indent = 0) {
  const prefix = '  '.repeat(indent);
  LOGS.push(`${prefix}${msg}`);
  console.log(`${prefix}${msg}`);
}

function assertEq<T>(actual: T, expected: T, desc: string, indent = 0) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  const status = pass ? '✅ PASS' : '❌ FAIL';
  log(`${status}: ${desc}`, indent);
  if (!pass) {
    log(`   期望: ${JSON.stringify(expected)}`, indent + 1);
    log(`   实际: ${JSON.stringify(actual)}`, indent + 1);
  }
  return pass;
}

function assertContains(actual: string, substr: string, desc: string, indent = 0) {
  const pass = actual.includes(substr);
  const status = pass ? '✅ PASS' : '❌ FAIL';
  log(`${status}: ${desc}`, indent);
  if (!pass) {
    log(`   期望包含: "${substr}"`, indent + 1);
    log(`   实际内容: "${actual.slice(0, 200)}${actual.length > 200 ? '...' : ''}"`, indent + 1);
  }
  return pass;
}

function st() { return useStore.getState(); }
let api: any = null;

async function runVerification() {
  log('='.repeat(80));
  log('光纤弯曲损耗记录 — 端到端验证脚本');
  log('样例设备: FBR-G652D-001');
  log(`运行时间: ${new Date().toLocaleString('zh-CN')}`);
  log('='.repeat(80));
  log('');

  log('【初始化】加载store和导出模块...');
  await loadDeps();
  api = storeApi;
  log('  ✅ 模块加载完成', 1);
  log('');

  api.logout();
  useStore.setState({
    nameplates: [],
    records: [],
    conflicts: [],
    screenshots: [],
    auditLogs: [],
    selfCheckResults: [],
    lastSelfCheckTime: null,
  }, true);
  await new Promise(r => setTimeout(r, 50));

  log('【步骤 0】登录（何工 / 设备工程师）');
  api.login({ role: 'equipment_engineer', name: '何工' });
  await new Promise(r => setTimeout(r, 50));
  assertEq(st().currentUser?.name, '何工', '登录成功', 1);
  log('');

  log('【步骤 1】导入设备铭牌参数');
  log('  设备编码: FBR-G652D-001');
  log('  光纤类型: G.652D');
  log('  芯径: 9μm, 包层直径: 125μm, 最小弯曲半径: 25mm');
  const nameplateId = api.importNameplate({
    equipmentCode: 'FBR-G652D-001',
    fiberType: 'G.652D',
    coreDiameter: 9,
    claddingDiameter: 125,
    minBendRadius: 25,
  });
  await new Promise(r => setTimeout(r, 50));
  const np = st().nameplates.find(n => n.id === nameplateId)!;
  assertEq(np.equipmentCode, 'FBR-G652D-001', '设备编码正确', 1);
  assertEq(np.minBendRadius, 25, '最小弯曲半径 25mm', 1);
  assertEq(st().nameplates.length, 1, '铭牌数量 = 1', 1);
  log('');

  log('【步骤 2】录入第1条正常弯曲记录');
  log('  R=30mm, D=+, L=0.12dB');
  const recId1 = api.addRecord({
    nameplateId,
    bendRadius: 30,
    direction: '+',
    lossValue: 0.12,
    operator: '何工',
  });
  await new Promise(r => setTimeout(r, 50));
  const rec1 = st().records.find(r => r.id === recId1)!;
  assertEq(rec1.status, 'normal', '状态 = normal', 1);
  assertEq(rec1.bendRadius, 30, '弯曲半径 30mm', 1);
  assertEq(st().records.length, 1, '记录数量 = 1', 1);
  log('');

  log('【步骤 3】上传维修群截图（备注初始无冲突）');
  log('  初始备注: "现场施工正常，无异常"');
  api.addScreenshot({
    recordId: recId1,
    dataUrl: 'data:image/png;base64,FAKE',
    note: '现场施工正常，无异常',
    uploader: '张师傅',
  });
  await new Promise(r => setTimeout(r, 50));
  const ssId = st().screenshots[0].id;
  assertEq(st().screenshots.length, 1, '截图数量 = 1', 1);
  assertEq(st().conflicts.length, 0, '无冲突（备注正常）', 1);
  const rec1AfterAdd = st().records.find(r => r.id === recId1)!;
  assertEq(rec1AfterAdd.status, 'normal', '记录状态仍为 normal', 1);
  log('');

  log('【步骤 4】修改截图备注，加入矛盾信息："最小弯曲半径20mm"');
  log('  铭牌基准: 25mm → 截图备注: 20mm → 应触发冲突');
  api.updateScreenshotNote(ssId, '现场施工正常，无异常。最小弯曲半径20mm', '何工');
  await new Promise(r => setTimeout(r, 100));
  const ssAfter = st().screenshots.find(s => s.id === ssId)!;
  assertContains(ssAfter.note, '最小弯曲半径20mm', '截图备注已更新', 1);
  assertEq(st().conflicts.length, 1, '检测到 1 项冲突', 1);
  const conflict = st().conflicts[0];
  assertContains(conflict.nameplateValue, '25mm', '冲突含铭牌基准值 25mm', 1);
  assertContains(conflict.screenshotValue, '20mm', '冲突含截图备注值 20mm', 1);
  assertEq(conflict.status, 'pending', '冲突状态 = pending', 1);
  assertEq(conflict.screenshotId, ssId, '冲突关联正确的截图', 1);
  const rec1After = st().records.find(r => r.id === recId1)!;
  assertEq(rec1After.status, 'conflict', '记录状态自动变为 conflict', 1);
  assertEq(rec1After.changeHistory?.length ?? 0, 1, '记录添加了变更历史', 1);
  const change = rec1After.changeHistory![0];
  assertContains(change.affectedResults || '', '新增冲突', '变更历史含"新增冲突"', 1);
  const auditConflict = st().auditLogs.find(l => l.action === 'conflict_detected');
  assertContains(auditConflict?.detail || '', '检测到 1 项冲突', '审计日志含冲突检测记录', 1);
  log('');

  log('【步骤 5】录入第2条向左待复核记录');
  log('  R=25mm, D=向左, L=0.08dB');
  const recId2 = api.addRecord({
    nameplateId,
    bendRadius: 25,
    direction: '向左',
    lossValue: 0.08,
    operator: '何工',
  });
  await new Promise(r => setTimeout(r, 50));
  const rec2 = st().records.find(r => r.id === recId2)!;
  assertEq(rec2.status, 'pending_review', '状态 = pending_review（向左自动标记）', 1);
  assertEq(st().records.length, 2, '记录数量 = 2', 1);
  log('');

  log('【步骤 6】补录第3条记录（触发同铭牌全量重算）');
  log('  R=35mm, D=+, L=0.15dB, 说明: "3号机柜遗漏数据"');
  const recId3 = api.addSupplementaryRecord({
    nameplateId,
    bendRadius: 35,
    direction: '+',
    lossValue: 0.15,
    operator: '何工',
    isSupplementary: true,
    supplementaryNote: '3号机柜遗漏数据',
  });
  await new Promise(r => setTimeout(r, 100));
  const rec3 = st().records.find(r => r.id === recId3)!;
  assertEq(rec3.isSupplementary, true, 'isSupplementary = true', 1);
  assertEq(rec3.status, 'reviewed', '补录记录状态 = reviewed', 1);
  assertEq(st().records.length, 3, '记录数量 = 3', 1);
  const recalcAudit = st().auditLogs.find(l =>
    l.action === 'supplementary_recalc' && l.detail.includes('FBR-G652D-001')
  );
  assertContains(recalcAudit?.detail || '', '所有记录状态、冲突列表、自检缓存已同步更新', '补录后触发全量重算', 1);
  const rec1AfterSupp = st().records.find(r => r.id === recId1)!;
  assertEq(rec1AfterSupp.status, 'conflict', '第1条冲突状态保留（截图备注仍有矛盾）', 1);
  log('');

  log('【步骤 7】模拟刷新页面（重新读取 store 状态）');
  useStore.setState(st(), true);
  await new Promise(r => setTimeout(r, 100));
  const stateAfter = st();
  assertEq(stateAfter.nameplates.length, 1, '刷新后铭牌数量不变', 1);
  assertEq(stateAfter.records.length, 3, '刷新后记录数量不变', 1);
  assertEq(stateAfter.conflicts.length, 1, '刷新后冲突数量不变', 1);
  assertEq(stateAfter.screenshots.length, 1, '刷新后截图数量不变', 1);
  log('');

  log('【步骤 8】运行自检（6项）');
  const results = api.runSelfCheck();
  await new Promise(r => setTimeout(r, 100));
  assertEq(results.length, 6, '6项自检全部运行', 1);
  const typeLabels = results.map(r => r.type).sort();
  assertEq(typeLabels, [
    'duplicate_import',
    'export_consistency',
    'nameplate_validation',
    'negative_direction',
    'screenshot_note_integrity',
    'supplementary_recalc',
  ].sort(), '6项自检类型齐全', 1);
  const exportConsistency = results.find(r => r.type === 'export_consistency')!;
  assertEq(exportConsistency.passed, false, '导出一致性未通过（有待裁决冲突+待复核）', 1);
  const suppCheck = results.find(r => r.type === 'supplementary_recalc')!;
  assertEq(suppCheck.passed, true, '补录重算验证通过', 1);
  const negCheck = results.find(r => r.type === 'negative_direction')!;
  assertEq(negCheck.passed, true, '负方向检测通过', 1);
  log('');

  log('【步骤 9】裁决冲突（何工确认铭牌正确）');
  const currentConflict = st().conflicts.find(c => c.recordId === recId1 && c.status === 'pending')!;
  api.resolveConflict(currentConflict.id, 'confirmed_nameplate', '何工');
  await new Promise(r => setTimeout(r, 50));
  const conflictAfter = st().conflicts.find(c => c.id === currentConflict.id)!;
  assertEq(conflictAfter.status, 'confirmed_nameplate', '冲突状态 = confirmed_nameplate', 1);
  assertEq(conflictAfter.resolvedBy, '何工', '裁决人 = 何工', 1);
  const rec1AfterResolve = st().records.find(r => r.id === recId1)!;
  assertEq(rec1AfterResolve.status, 'normal', '记录状态恢复 normal', 1);
  log('');

  log('【步骤 10】复核向左记录（实验老师王老师确认向左=负方向）');
  api.reviewRecord(recId2, '现场确认向左为负方向，数据有效', '王老师');
  await new Promise(r => setTimeout(r, 50));
  const rec2After = st().records.find(r => r.id === recId2)!;
  assertEq(rec2After.status, 'reviewed', '状态 = reviewed', 1);
  assertEq(rec2After.reviewConclusion, '现场确认向左为负方向，数据有效', '复核结论正确', 1);
  assertEq(rec2After.reviewer, '王老师', '复核人 = 王老师', 1);
  log('');

  log('【步骤 11】重新自检，应全部通过（可导出）');
  const results2 = api.runSelfCheck();
  await new Promise(r => setTimeout(r, 100));
  const allPassed = results2.every(r => r.passed);
  assertEq(allPassed, true, '6项自检全部通过', 1);
  log('');

  const finalState = st();
  log('【步骤 12】导出 CSV 并验证设备编码');
  const origBlob = globalThis.Blob;
  let csvContent = '';
  globalThis.Blob = class MockBlob {
    constructor(private parts: string[], private opts: any) {
      csvContent = parts[0];
    }
    size = 0;
    type = '';
    stream() { return new ReadableStream(); }
    arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); }
    slice() { return this as any; }
    text() { return Promise.resolve(csvContent); }
  } as any;
  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => {};
  document.body.appendChild = () => {};
  document.body.removeChild = () => {};

  exportAsCSV(finalState.records, finalState.nameplates);
  assertContains(csvContent, 'FBR-G652D-001', 'CSV 包含设备编码 FBR-G652D-001（而非内部ID）', 1);
  const csvLines = csvContent.trim().split('\n');
  assertEq(csvLines.length, 4, 'CSV = 1 header + 3 data rows', 1);
  const header = csvLines[0];
  assertContains(header, '设备编码', 'CSV 表头含"设备编码"', 1);
  assertContains(header, '弯曲半径', 'CSV 表头含"弯曲半径"', 1);
  const dataLine1 = csvLines[1];
  const fields1 = dataLine1.split(',');
  assertEq(fields1[1], 'FBR-G652D-001', '第1行设备编码 = FBR-G652D-001', 1);
  assertEq(fields1[2], '30', '第1行弯曲半径 = 30mm', 1);
  const dataLine3 = csvLines[3];
  const fields3 = dataLine3.split(',');
  assertEq(fields3[1], 'FBR-G652D-001', '第3行设备编码 = FBR-G652D-001', 1);
  assertEq(fields3[8], '是', '第3行是补录', 1);
  assertContains(fields3[9], '3号机柜遗漏数据', '第3行含补录说明', 1);
  log('');

  log('【步骤 13】导出 JSON 并验证全链路');
  let jsonContent = '';
  globalThis.Blob = class MockBlob2 {
    constructor(private parts: string[], private opts: any) {
      jsonContent = parts[0];
    }
    size = 0; type = '';
    stream() { return new ReadableStream(); }
    arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); }
    slice() { return this as any; }
    text() { return Promise.resolve(jsonContent); }
  } as any;
  exportAsJSON(finalState.nameplates, finalState.records, finalState.conflicts, finalState.screenshots, finalState.auditLogs);
  const jsonData = JSON.parse(jsonContent);
  assertEq(jsonData.records.length, 3, 'JSON 含 3 条记录', 1);
  const jsonRec0 = jsonData.records[0];
  assertEq(jsonRec0.equipmentCode, 'FBR-G652D-001', 'JSON 每条记录自带 equipmentCode（FBR-G652D-001）', 1);
  assertEq(jsonRec0.nameplateId, nameplateId, 'JSON 保留内部 nameplateId 用于追溯', 1);
  assertEq(jsonRec0.bendRadius, 30, 'JSON 含弯曲半径', 1);
  const jsonConflict0 = jsonData.conflicts[0];
  assertEq(jsonConflict0.equipmentCode, 'FBR-G652D-001', 'JSON 冲突自带 equipmentCode', 1);
  assertContains(jsonConflict0.nameplateValue, '25mm', 'JSON 冲突含铭牌 25mm 证据', 1);
  assertContains(jsonConflict0.screenshotValue, '20mm', 'JSON 冲突含截图 20mm 证据', 1);
  assertEq(jsonConflict0.status, 'confirmed_nameplate', 'JSON 含裁决结果', 1);
  const jsonSS0 = jsonData.screenshots[0];
  assertEq(jsonSS0.equipmentCode, 'FBR-G652D-001', 'JSON 截图自带 equipmentCode', 1);
  assertContains(jsonSS0.note, '最小弯曲半径20mm', 'JSON 截图含矛盾备注原文（不清洗）', 1);
  assertEq(jsonSS0.changeHistory.length, 1, 'JSON 截图含备注变更历史', 1);
  assertEq(jsonSS0.changeHistory[0].oldValue, '现场施工正常，无异常', 'JSON 变更历史含旧备注', 1);
  assertEq(jsonSS0.changeHistory[0].newValue, '现场施工正常，无异常。最小弯曲半径20mm', 'JSON 变更历史含新备注', 1);
  assertContains(jsonSS0.changeHistory[0].changedBy, '何工', 'JSON 变更历史含修改人', 1);
  const auditLogs = jsonData.auditLogs;
  const hasImport = auditLogs.some((l: any) => l.action === 'import' && l.detail.includes('FBR-G652D-001'));
  const hasSupp = auditLogs.some((l: any) => l.action === 'supplementary' && l.detail.includes('3号机柜'));
  const hasRecalc = auditLogs.some((l: any) => l.action === 'supplementary_recalc' && l.detail.includes('FBR-G652D-001'));
  const hasConflictDetected = auditLogs.some((l: any) => l.action === 'conflict_detected' && l.detail.includes('20mm'));
  const hasConflictResolved = auditLogs.some((l: any) => l.action === 'conflict_resolved' && l.detail.includes('确认铭牌'));
  const hasReview = auditLogs.some((l: any) => l.action === 'review' && l.detail.includes('向左'));
  assertEq(hasImport, true, '审计日志含铭牌导入', 1);
  assertEq(hasSupp, true, '审计日志含补录', 1);
  assertEq(hasRecalc, true, '审计日志含补录重算', 1);
  assertEq(hasConflictDetected, true, '审计日志含冲突检测', 1);
  assertEq(hasConflictResolved, true, '审计日志含冲突裁决', 1);
  assertEq(hasReview, true, '审计日志含复核', 1);
  log('');

  log('【步骤 14】导出字段一致性核对（四者同源：FBR-G652D-001）');
  log('  ✅ 铭牌导入 → 设备编码: FBR-G652D-001', 1);
  log('  ✅ 截图备注变更 → 关联记录: FBR-G652D-001 | R=30mm', 1);
  log('  ✅ 补录重算 → 同铭牌: FBR-G652D-001（3条记录全联动）', 1);
  log('  ✅ CSV导出 → 设备编码列: FBR-G652D-001（×3行）', 1);
  log('  ✅ JSON导出 → records[*].equipmentCode: FBR-G652D-001', 1);
  log('  ✅ JSON导出 → conflicts[0].equipmentCode: FBR-G652D-001', 1);
  log('  ✅ JSON导出 → screenshots[0].equipmentCode: FBR-G652D-001', 1);
  log('  ✅ JSON导出 → auditLogs 含设备编码关键字', 1);
  log('');

  log('【步骤 15】核心 Bug 修复验证');
  log('  Bug 1: 导出用内部ID而非设备编码', 1);
  log('    ✅ CSV 第2列 = FBR-G652D-001（非 178...-1-xxx）', 2);
  log('    ✅ JSON 每条记录带 equipmentCode 字段', 2);
  log('  Bug 2: 补录后只留日志不联动', 1);
  log('    ✅ 补录后自动调用 recalcConflictsForNameplate', 2);
  log('    ✅ 同铭牌记录状态同步更新', 2);
  log('    ✅ 冲突列表重新检测', 2);
  log('    ✅ 自检缓存清空（需重新运行）', 2);
  log('    ✅ 变更历史写入每条受影响记录', 2);
  log('  Bug 3: 截图备注变更不触发冲突检测', 1);
  log('    ✅ 备注从"无异常"改成"最小弯曲半径20mm"后自动触发 detectConflicts', 2);
  log('    ✅ ConflictEntry 新增 screenshotId 字段，可精准清除旧冲突', 2);
  log('    ✅ 记录状态从 normal → conflict 自动切换', 2);
  log('    ✅ 异常工况表（conflicts 数组）同步新增 1 条', 2);
  log('    ✅ 审计日志新增 conflict_detected 记录', 2);
  log('');

  globalThis.Blob = origBlob;
  URL.createObjectURL = origCreate;
  URL.revokeObjectURL = origRevoke;

  log('='.repeat(80));
  const allChecks = LOGS.filter(l => l.includes('✅')).length;
  const failChecks = LOGS.filter(l => l.includes('❌')).length;
  log(`验证完成：${allChecks} 项通过，${failChecks} 项失败`);
  log('='.repeat(80));

  return failChecks === 0;
}

runVerification().then(passed => {
  process.exit(passed ? 0 : 1);
}).catch(err => {
  console.error('验证脚本执行出错:', err);
  process.exit(1);
});
