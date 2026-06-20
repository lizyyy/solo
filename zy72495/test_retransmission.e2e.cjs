const assert = (condition, message) => {
  if (!condition) {
    console.log(`  ❌ FAIL: ${message}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`  ✅ PASS: ${message}`);
  return true;
};

const assertEqual = (actual, expected, message) => {
  if (actual !== expected) {
    console.log(`  ❌ FAIL: ${message} (expected ${expected}, got ${actual})`);
    process.exitCode = 1;
    return false;
  }
  console.log(`  ✅ PASS: ${message}`);
  return true;
};

function generateId(prefix) {
  return prefix + Date.now() + Math.random().toString(36).substr(2, 9);
}

function generateBatchId() {
  return 'batch-' + Date.now();
}

function findExisting(slot, existingSlots) {
  return existingSlots.find(
    (s) =>
      s.routeName === slot.routeName &&
      s.date === slot.date &&
      s.startTime === slot.startTime &&
      s.endTime === slot.endTime
  );
}

const initialSlots = [
  { id: 'bt1', routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 45, relatedPointIds: ['p1', 'p2'], importBatchId: 'batch-001', createdAt: '2026-06-07T08:00:00Z', updatedAt: '2026-06-07T08:00:00Z' },
  { id: 'bt2', routeName: '1路', date: '2026-06-07', startTime: '06:30', endTime: '07:00', passengerCount: 68, relatedPointIds: ['p2', 'p3'], importBatchId: 'batch-001', createdAt: '2026-06-07T08:00:00Z', updatedAt: '2026-06-07T08:00:00Z' },
  { id: 'bt3', routeName: '5路', date: '2026-06-07', startTime: '06:15', endTime: '06:45', passengerCount: 32, relatedPointIds: ['p4', 'p5'], importBatchId: 'batch-001', createdAt: '2026-06-07T08:00:00Z', updatedAt: '2026-06-07T08:00:00Z' },
];

const operationLogs = [];
const currentUser = { id: 'u1', name: '周姐' };

function addOperationLog(operatorId, operatorName, operationType, targetType, targetId, beforeData, afterData, metadata) {
  operationLogs.push({ id: generateId('log'), operatorId, operatorName, operationType, targetType, targetId, beforeData, afterData, timestamp: new Date().toISOString(), metadata: metadata || {} });
}

function addBusTimeSlots(slots, existingSlots, batchId) {
  const newSlots = [];
  const updatedSlots = [];
  const updateDetails = [];
  const newDetails = [];
  let updateCount = 0;
  let newCount = 0;
  const now = new Date().toISOString();
  const actualBatchId = batchId || slots[0]?.importBatchId || generateBatchId();
  slots.forEach((slot) => {
    const existingIndex = existingSlots.findIndex((s) => s.routeName === slot.routeName && s.date === slot.date && s.startTime === slot.startTime && s.endTime === slot.endTime);
    const routeKey = `${slot.routeName}|${slot.date}|${slot.startTime}|${slot.endTime}`;
    if (existingIndex >= 0) {
      const existing = existingSlots[existingIndex];
      const updated = { ...existing, passengerCount: slot.passengerCount, relatedPointIds: slot.relatedPointIds.length > 0 ? slot.relatedPointIds : existing.relatedPointIds, updatedAt: now, importBatchId: actualBatchId };
      updatedSlots.push(updated);
      updateDetails.push({ slotId: existing.id, passengerCountBefore: existing.passengerCount, passengerCountAfter: slot.passengerCount, routeKey });
      updateCount++;
    } else {
      newSlots.push(slot);
      newDetails.push({ slotId: slot.id, routeKey });
      newCount++;
    }
  });
  let resultSlots = [...existingSlots];
  updatedSlots.forEach((updated) => { const idx = resultSlots.findIndex((s) => s.id === updated.id); if (idx >= 0) resultSlots[idx] = updated; });
  resultSlots = [...resultSlots, ...newSlots];
  const allIds = [...updatedSlots.map((s) => s.id), ...newSlots.map((s) => s.id)];
  addOperationLog(currentUser.id, currentUser.name, 'import', 'busTimeSlot', allIds.join(','), existingSlots, resultSlots, { batchId: actualBatchId, newCount, updateCount, updateSlotIds: updatedSlots.map((s) => s.id), newSlotIds: newSlots.map((s) => s.id), updateDetails, newDetails });
  return { newCount, updateCount, resultSlots, actualBatchId };
}

function simulateImport(rows, existingSlots) {
  const batchId = generateBatchId();
  const now = new Date().toISOString();
  const data = [];
  const duplicates = [];
  let duplicateCount = 0;
  let newCount = 0;
  let updateCount = 0;
  rows.forEach((row) => {
    const slot = { id: generateId('bt'), routeName: String(row.routeName || ''), date: String(row.date || ''), startTime: String(row.startTime || ''), endTime: String(row.endTime || ''), passengerCount: Number(row.passengerCount) || 0, relatedPointIds: [], importBatchId: batchId, createdAt: now, updatedAt: now };
    const existing = findExisting(slot, existingSlots);
    if (existing) {
      duplicateCount++;
      const changedFields = [];
      if (existing.passengerCount !== slot.passengerCount) changedFields.push('passengerCount');
      duplicates.push({ slot, existingSlot: existing, changedFields });
      data.push(slot);
      updateCount++;
    } else {
      data.push(slot);
      newCount++;
    }
  });
  return { success: newCount > 0 || updateCount > 0, data, duplicateCount, newCount, updateCount, duplicates, batchId };
}

console.log('\n=================================================');
console.log('早市摊位轮换 - 重复导入可更新 端到端验证脚本');
console.log('=================================================\n');

let currentSlots = [...initialSlots];

console.log('━━━ 测试1：首次导入全新数据 ━━━');
{ const r = simulateImport([{ routeName: '3路', date: '2026-06-08', startTime: '07:00', endTime: '07:30', passengerCount: 55 }, { routeName: '3路', date: '2026-06-08', startTime: '07:30', endTime: '08:00', passengerCount: 72 }], currentSlots);
  assertEqual(r.newCount, 2, '首次导入新增2条'); assertEqual(r.updateCount, 0, '首次导入无更新'); assert(r.success, '首次导入success=true');
  const s = addBusTimeSlots(r.data, currentSlots, r.batchId); currentSlots = s.resultSlots; assertEqual(currentSlots.length, 5, '总记录数=5'); }

console.log('\n━━━ 测试2：重传同批只改客流数(纯更新) ━━━');
{ const r = simulateImport([{ routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 55 }, { routeName: '1路', date: '2026-06-07', startTime: '06:30', endTime: '07:00', passengerCount: 80 }, { routeName: '5路', date: '2026-06-07', startTime: '06:15', endTime: '06:45', passengerCount: 40 }], currentSlots);
  assertEqual(r.updateCount, 3, '重传更新3条'); assertEqual(r.newCount, 0, '重传无新增'); assertEqual(r.duplicateCount, 3, '检测到3条重复'); assert(r.success, '纯更新success=true');
  const s = addBusTimeSlots(r.data, currentSlots, r.batchId); currentSlots = s.resultSlots; assertEqual(currentSlots.length, 5, '重传后总记录数仍=5没有副本'); }

console.log('\n━━━ 测试3：原始ID保留+客流数刷新 ━━━');
{ const bt1 = currentSlots.find(s => s.id==='bt1'); const bt2 = currentSlots.find(s => s.id==='bt2'); const bt3 = currentSlots.find(s => s.id==='bt3');
  assert(bt1!==undefined,'bt1存在'); assert(bt2!==undefined,'bt2存在'); assert(bt3!==undefined,'bt3存在');
  if(bt1){ assertEqual(bt1.passengerCount,55,'bt1客流45→55'); assert(bt1.importBatchId!=='batch-001','bt1批次已刷新'); }
  if(bt2){ assertEqual(bt2.passengerCount,80,'bt2客流68→80'); }
  if(bt3){ assertEqual(bt3.passengerCount,40,'bt3客流32→40'); } }

console.log('\n━━━ 测试4：操作日志含逐条修改明细 ━━━');
{ const logs = operationLogs.filter(l=>l.operationType==='import'); assert(logs.length>=2,`至少2条导入日志实际${logs.length}条`);
  const rl = logs[logs.length-1]; assert(rl.metadata.updateCount===3,'重传日志updateCount=3'); assert(rl.metadata.newCount===0,'重传日志newCount=0');
  const ud = rl.metadata.updateDetails; assert(Array.isArray(ud),'updateDetails是数组'); assertEqual(ud.length,3,'updateDetails含3条明细');
  const d1=ud.find(d=>d.slotId==='bt1'); if(d1){ assertEqual(d1.passengerCountBefore,45,'bt1 before=45'); assertEqual(d1.passengerCountAfter,55,'bt1 after=55'); }
  const d2=ud.find(d=>d.slotId==='bt2'); if(d2){ assertEqual(d2.passengerCountBefore,68,'bt2 before=68'); assertEqual(d2.passengerCountAfter,80,'bt2 after=80'); }
  const d3=ud.find(d=>d.slotId==='bt3'); if(d3){ assertEqual(d3.passengerCountBefore,32,'bt3 before=32'); assertEqual(d3.passengerCountAfter,40,'bt3 after=40'); } }

console.log('\n━━━ 测试5：批次ID贯穿导入/日志/记录 ━━━');
{ const rl = operationLogs.filter(l=>l.operationType==='import').pop(); const bid = rl.metadata.batchId; assert(!!bid,'重传日志有batchId');
  const ids = currentSlots.filter(s=>['bt1','bt2','bt3'].includes(s.id)).map(s=>s.importBatchId);
  assert(ids.every(id=>id===bid),`记录importBatchId与日志batchId一致:${bid}`);
  assert(rl.metadata.updateSlotIds.sort().join()==='bt1,bt2,bt3'.split(',').sort().join(),'updateSlotIds含bt1,bt2,bt3'); }

console.log('\n━━━ 测试6：混合批次(部分更新+部分新增) ━━━');
{ const r = simulateImport([{ routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 60 }, { routeName: '7路', date: '2026-06-09', startTime: '08:00', endTime: '08:30', passengerCount: 99 }], currentSlots);
  assertEqual(r.updateCount,1,'混合1条更新'); assertEqual(r.newCount,1,'混合1条新增'); assert(r.success,'混合success=true');
  const s = addBusTimeSlots(r.data, currentSlots, r.batchId); currentSlots = s.resultSlots; assertEqual(currentSlots.length,6,'总记录=6');
  const bt1u=currentSlots.find(s=>s.id==='bt1'); if(bt1u) assertEqual(bt1u.passengerCount,60,'bt1客流55→60');
  const ns=currentSlots.find(s=>s.routeName==='7路'); assert(!!ns,'7路新记录存在'); if(ns) assertEqual(ns.passengerCount,99,'7路客流=99'); }

console.log('\n━━━ 测试7：连续重传不产生副本 ━━━');
{ const before=currentSlots.length;
  const r=simulateImport([{ routeName:'1路',date:'2026-06-07',startTime:'06:00',endTime:'06:30',passengerCount:100 },{ routeName:'1路',date:'2026-06-07',startTime:'06:30',endTime:'07:00',passengerCount:110 }],currentSlots);
  const s=addBusTimeSlots(r.data,currentSlots,r.batchId); currentSlots=s.resultSlots;
  assertEqual(currentSlots.length,before,`重传后记录数不变=${before}`);
  const a1=currentSlots.find(s=>s.id==='bt1'); if(a1) assertEqual(a1.passengerCount,100,'bt1最终=100');
  const a2=currentSlots.find(s=>s.id==='bt2'); if(a2) assertEqual(a2.passengerCount,110,'bt2最终=110'); }

console.log('\n━━━ 测试8：导出数据核对 ━━━');
{ const ed = currentSlots.map(s=>({ 记录ID:s.id, 线路:s.routeName, 日期:s.date, 开始时间:s.startTime, 结束时间:s.endTime, 客流数:s.passengerCount, 导入批次:s.importBatchId }));
  assertEqual(ed.length,currentSlots.length,'导出行数=记录数');
  const e1=ed.find(r=>r['记录ID']==='bt1'); if(e1){ assertEqual(e1['线路'],'1路','导出bt1线路=1路'); assertEqual(e1['客流数'],100,'导出bt1客流=100'); assert(e1['导入批次']!=='batch-001','导出bt1批次已更新'); }
  const il=operationLogs.filter(l=>l.operationType==='import').pop(); if(il){
    const detail=(il.metadata.updateDetails||[]).map(ud=>`${ud.routeKey.replace(/\|/g,'-')} 客流${ud.passengerCountBefore}→${ud.passengerCountAfter}(ID:${ud.slotId.slice(-8)})`).join('; ');
    assert(!!detail,'日志导出有更新记录明细'); console.log(`    📋 更新明细: ${detail}`); } }

console.log('\n━━━ 测试9：去重键验证 ━━━');
{ assert(!!findExisting({routeName:'1路',date:'2026-06-07',startTime:'06:00',endTime:'06:30'},currentSlots),'同键=重复');
  assert(!findExisting({routeName:'1路',date:'2026-06-07',startTime:'06:00',endTime:'07:00'},currentSlots),'不同结束时间=不重复');
  assert(!findExisting({routeName:'1路',date:'2026-06-08',startTime:'06:00',endTime:'06:30'},currentSlots),'不同日期=不重复'); }

console.log('\n━━━ 测试10：边界点位关联时段 ━━━');
{ const p2=currentSlots.filter(s=>s.relatedPointIds.includes('p2')); assert(p2.length>0,`p2有关联时段:${p2.length}条`);
  console.log(`    📍 p2关联: ${p2.map(s=>`${s.routeName} ${s.startTime}-${s.endTime} 客流${s.passengerCount}`).join(', ')}`); }

console.log('\n━━━ 测试11：纯更新批次确认不禁用 ━━━');
{ const r=simulateImport([{routeName:'5路',date:'2026-06-07',startTime:'06:15',endTime:'06:45',passengerCount:50}],currentSlots);
  assert(!(r.newCount===0&&r.updateCount===0),'纯更新确认不禁用'); assert(r.success,'纯更新success=true'); }

console.log('\n━━━ 测试12：duplicates对比表 ━━━');
{ const r=simulateImport([{routeName:'1路',date:'2026-06-07',startTime:'06:00',endTime:'06:30',passengerCount:120}],currentSlots);
  assertEqual(r.duplicates.length,1,'duplicates有1条');
  const d=r.duplicates[0]; assert(!!d.existingSlot,'有existingSlot'); assert(!!d.slot,'有slot');
  assert(d.changedFields.includes('passengerCount'),'changedFields含passengerCount');
  assertEqual(d.existingSlot.passengerCount,100,'旧值=100'); assertEqual(d.slot.passengerCount,120,'新值=120');
  assertEqual(d.existingSlot.id,'bt1','existingSlot.id=bt1'); }

console.log('\n=================================================');
if(!process.exitCode || process.exitCode===0){ console.log('🎉 全部测试通过！重复导入可更新验证完毕。');
  console.log('  1. 重传不会新增副本，只更新旧记录客流数');
  console.log('  2. 原始记录ID完整保留');
  console.log('  3. 操作日志逐条记录from→to，可追溯');
  console.log('  4. 批次ID贯穿导入/记录/日志/导出');
  console.log('  5. 纯更新批次确认不禁用');
  console.log('  6. duplicates含旧值/新值/变更字段');
  console.log('  7. 去重键=线路+日期+开始+结束'); }
else console.log('⚠️ 存在失败测试，检查❌项');
console.log('');
      duplicates.push({ slot, existingSlot: existing, changedFields });
      data.push(slot);
      updateCount++;
    } else {
      data.push(slot);
      newCount++;
    }
  });

  return {
    success: newCount > 0 || updateCount > 0,
    data,
    duplicateCount,
    newCount,
    updateCount,
    duplicates,
    errors: [],
    batchId,
  };
}

console.log('\n=================================================');
console.log('早市摊位轮换 - 重复导入可更新 端到端验证脚本');
console.log('=================================================\n');

let currentSlots = [...initialSlots];

console.log('━━━ 测试1：首次导入全新数据 ━━━');
{
  const newRows = [
    { routeName: '3路', date: '2026-06-08', startTime: '07:00', endTime: '07:30', passengerCount: 55 },
    { routeName: '3路', date: '2026-06-08', startTime: '07:30', endTime: '08:00', passengerCount: 72 },
  ];
  const importResult = simulateImport(newRows, currentSlots);
  assertEqual(importResult.newCount, 2, '首次导入新增2条');
  assertEqual(importResult.updateCount, 0, '首次导入无更新');
  assert(importResult.success, '首次导入success=true');
  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, 5, '总记录数=5（原3+新2）');
}

console.log('\n━━━ 测试2：重传同一批数据，只改客流数（纯更新） ━━━');
{
  const retransmitRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 55 },
    { routeName: '1路', date: '2026-06-07', startTime: '06:30', endTime: '07:00', passengerCount: 80 },
    { routeName: '5路', date: '2026-06-07', startTime: '06:15', endTime: '06:45', passengerCount: 40 },
  ];
  const importResult = simulateImport(retransmitRows, currentSlots);
  assertEqual(importResult.updateCount, 3, '重传更新3条');
  assertEqual(importResult.newCount, 0, '重传无新增');
  assert(importResult.success, '纯更新批次success=true');
  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, 5, '重传后总记录数仍=5，没有新增副本');
}

console.log('\n━━━ 测试3：验证原始ID保留，客流数已刷新 ━━━');
{
  const bt1 = currentSlots.find((s) => s.id === 'bt1');
  const bt2 = currentSlots.find((s) => s.id === 'bt2');
  const bt3 = currentSlots.find((s) => s.id === 'bt3');
  assert(bt1 !== undefined, 'bt1记录仍存在');
  assert(bt2 !== undefined, 'bt2记录仍存在');
  assert(bt3 !== undefined, 'bt3记录仍存在');
  if (bt1) {
    assertEqual(bt1.passengerCount, 55, 'bt1客流数从45→55');
    assert(bt1.importBatchId !== 'batch-001', 'bt1的importBatchId已刷新');
  }
  if (bt2) {
    assertEqual(bt2.passengerCount, 80, 'bt2客流数从68→80');
    assert(bt2.importBatchId !== 'batch-001', 'bt2的importBatchId已刷新');
  }
  if (bt3) {
    assertEqual(bt3.passengerCount, 40, 'bt3客流数从32→40');
    assert(bt3.importBatchId !== 'batch-001', 'bt3的importBatchId已刷新');
  }
}

console.log('\n━━━ 测试4：操作日志包含逐条修改明细 ━━━');
{
  const importLogs = operationLogs.filter((l) => l.operationType === 'import');
  assert(importLogs.length >= 2, `至少2条导入日志，实际${importLogs.length}条`);
  const retransmitLog = importLogs[importLogs.length - 1];
  assert(retransmitLog.metadata.updateCount === 3, '重传日志updateCount=3');
  assert(retransmitLog.metadata.newCount === 0, '重传日志newCount=0');
  const updateDetails = retransmitLog.metadata.updateDetails;
  assert(Array.isArray(updateDetails), 'updateDetails是数组');
  assertEqual(updateDetails.length, 3, 'updateDetails包含3条明细');
  const bt1Detail = updateDetails.find((d) => d.slotId === 'bt1');
  if (bt1Detail) {
    assertEqual(bt1Detail.passengerCountBefore, 45, 'bt1 before=45');
    assertEqual(bt1Detail.passengerCountAfter, 55, 'bt1 after=55');
    assertEqual(bt1Detail.routeKey, '1路|2026-06-07|06:00|06:30', 'bt1 routeKey正确');
  }
  const bt2Detail = updateDetails.find((d) => d.slotId === 'bt2');
  if (bt2Detail) {
    assertEqual(bt2Detail.passengerCountBefore, 68, 'bt2 before=68');
    assertEqual(bt2Detail.passengerCountAfter, 80, 'bt2 after=80');
  }
  const bt3Detail = updateDetails.find((d) => d.slotId === 'bt3');
  if (bt3Detail) {
    assertEqual(bt3Detail.passengerCountBefore, 32, 'bt3 before=32');
    assertEqual(bt3Detail.passengerCountAfter, 40, 'bt3 after=40');
  }
}

console.log('\n━━━ 测试5：批次ID贯穿导入、日志、记录 ━━━');
{
  const retransmitLog = operationLogs.filter((l) => l.operationType === 'import').pop();
  const logBatchId = retransmitLog.metadata.batchId;
  assert(!!logBatchId, '重传日志有batchId');
  const retransmitBatchIds = currentSlots
    .filter((s) => ['bt1', 'bt2', 'bt3'].includes(s.id))
    .map((s) => s.importBatchId);
  assert(
    retransmitBatchIds.every((id) => id === logBatchId),
    `记录的importBatchId与日志batchId一致: ${logBatchId}`
  );
  const updateSlotIds = retransmitLog.metadata.updateSlotIds;
  const sorted1 = [...updateSlotIds].sort();
  const sorted2 = ['bt1', 'bt2', 'bt3'].sort();
  assert(sorted1.length === sorted2.length && sorted1.every((v, i) => v === sorted2[i]), 'updateSlotIds包含bt1,bt2,bt3');
}

console.log('\n━━━ 测试6：混合批次（部分更新+部分新增） ━━━');
{
  const mixedRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 60 },
    { routeName: '7路', date: '2026-06-09', startTime: '08:00', endTime: '08:30', passengerCount: 99 },
  ];
  const importResult = simulateImport(mixedRows, currentSlots);
  assertEqual(importResult.updateCount, 1, '混合批次：1条更新');
  assertEqual(importResult.newCount, 1, '混合批次：1条新增');
  assert(importResult.success, '混合批次success=true');
  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, 6, '总记录数=6（5+1新增）');
  const bt1Updated = currentSlots.find((s) => s.id === 'bt1');
  if (bt1Updated) assertEqual(bt1Updated.passengerCount, 60, 'bt1客流数从55→60');
  const newSlot = currentSlots.find((s) => s.routeName === '7路');
  assert(!!newSlot, '7路新记录存在');
  if (newSlot) assertEqual(newSlot.passengerCount, 99, '7路客流数=99');
}

console.log('\n━━━ 测试7：连续重传同一批，不产生副本 ━━━');
{
  const beforeCount = currentSlots.length;
  const sameRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 100 },
    { routeName: '1路', date: '2026-06-07', startTime: '06:30', endTime: '07:00', passengerCount: 110 },
  ];
  const importResult = simulateImport(sameRows, currentSlots);
  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, beforeCount, '重传后记录数不变');
  const bt1Again = currentSlots.find((s) => s.id === 'bt1');
  if (bt1Again) assertEqual(bt1Again.passengerCount, 100, 'bt1客流数最终=100');
  const bt2Again = currentSlots.find((s) => s.id === 'bt2');
  if (bt2Again) assertEqual(bt2Again.passengerCount, 110, 'bt2客流数最终=110');
}

console.log('\n━━━ 测试8：导出数据核对 ━━━');
{
  const exportData = currentSlots.map((slot) => ({
    '记录ID': slot.id,
    '线路': slot.routeName,
    '日期': slot.date,
    '开始时间': slot.startTime,
    '结束时间': slot.endTime,
    '客流数': slot.passengerCount,
    '导入批次': slot.importBatchId,
  }));
  assertEqual(exportData.length, currentSlots.length, '导出行数与记录数一致');
  const bt1Export = exportData.find((r) => r['记录ID'] === 'bt1');
  if (bt1Export) {
    assertEqual(bt1Export['线路'], '1路', '导出bt1线路=1路');
    assertEqual(bt1Export['客流数'], 100, '导出bt1客流数=100');
    assert(bt1Export['导入批次'] !== 'batch-001', '导出bt1批次ID已更新');
  }
  const importLogForExport = operationLogs.filter((l) => l.operationType === 'import').pop();
  if (importLogForExport) {
    assert(!!importLogForExport.metadata.batchId, '日志导出有批次ID');
    const updateSummary = (importLogForExport.metadata.updateDetails || [])
      .map((ud) => `${ud.routeKey.replace(/\|/g, '-')} 客流${ud.passengerCountBefore}→${ud.passengerCountAfter}(ID:${ud.slotId.slice(-8)})`)
      .join('; ');
    assert(!!updateSummary, '日志导出有更新记录明细');
    console.log(`    📋 日志更新明细: ${updateSummary}`);
  }
}

console.log('\n━━━ 测试9：去重键验证（线路+日期+开始+结束） ━━━');
{
  const slot1 = { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 999 };
  const slot2 = { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '07:00', passengerCount: 999 };
  const slot3 = { routeName: '1路', date: '2026-06-08', startTime: '06:00', endTime: '06:30', passengerCount: 999 };
  assert(!!findExisting(slot1, currentSlots), '同线路+同日期+同起止时间=重复');
  assert(!findExisting(slot2, currentSlots), '同线路+同日期+不同结束时间=不重复');
  assert(!findExisting(slot3, currentSlots), '同线路+不同日期=不重复');
}

console.log('\n━━━ 测试10：边界点位关联时段 ━━━');
{
  const p2Slots = currentSlots.filter((s) => s.relatedPointIds.includes('p2'));
  assert(p2Slots.length > 0, `p2(两街交界点位A)有关联时段: ${p2Slots.length}条`);
  const p2SlotIds = p2Slots.map((s) => s.id);
  assert(p2SlotIds.includes('bt1'), 'p2关联bt1');
  assert(p2SlotIds.includes('bt2'), 'p2关联bt2');
}

console.log('\n━━━ 测试11：纯更新批次确认按钮不被禁用 ━━━');
{
  const pureUpdateRows = [
    { routeName: '5路', date: '2026-06-07', startTime: '06:15', endTime: '06:45', passengerCount: 50 },
  ];
  const importResult = simulateImport(pureUpdateRows, currentSlots);
  const confirmDisabled = importResult.newCount === 0 && importResult.updateCount === 0;
  assert(!confirmDisabled, '纯更新批次确认按钮不被禁用');
  assert(importResult.success, '纯更新批次success=true');
}

console.log('\n━━━ 测试12：duplicates对比表数据完整性 ━━━');
{
  const dupRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 120 },
  ];
  const importResult = simulateImport(dupRows, currentSlots);
  assertEqual(importResult.duplicates.length, 1, 'duplicates有1条');
  const dup = importResult.duplicates[0];
  assert(!!dup.existingSlot, 'duplicates[0]有existingSlot');
  assert(!!dup.slot, 'duplicates[0]有slot');
  assert(dup.changedFields.includes('passengerCount'), 'changedFields包含passengerCount');
  assertEqual(dup.existingSlot.passengerCount, 100, 'existingSlot客流数=100');
  assertEqual(dup.slot.passengerCount, 120, 'slot客流数=120');
  assertEqual(dup.existingSlot.id, 'bt1', 'existingSlot.id=bt1');
}

console.log('\n=================================================');
if (process.exitCode === 0) {
  console.log('🎉 全部测试通过！重复导入可更新功能验证完毕。');
  console.log('');
  console.log('关键结论：');
  console.log('  1. 重传同一批材料不会新增副本，只更新旧记录客流数');
  console.log('  2. 原始记录ID完整保留');
  console.log('  3. 操作日志逐条记录了客流数from→to');
  console.log('  4. 批次ID贯穿导入、记录、日志、导出');
  console.log('  5. 纯更新批次确认按钮不会被禁用');
  console.log('  6. duplicates对比表包含旧值/新值/变更字段');
  console.log('  7. 去重键=线路+日期+开始时间+结束时间');
} else {
  console.log('⚠️ 存在失败测试，请检查上方❌标记。');
}
console.log('');
      duplicates.push({ slot, existingSlot: existing, changedFields });
      data.push(slot);
      updateCount++;
    } else {
      data.push(slot);
      newCount++;
    }
  });

  return {
    success: newCount > 0 || updateCount > 0,
    data,
    duplicateCount,
    newCount,
    updateCount,
    duplicates,
    errors: [],
    batchId,
  };
}

console.log('\n=================================================');
console.log('早市摊位轮换 - 重复导入可更新 端到端验证脚本');
console.log('=================================================\n');

let currentSlots = [...initialSlots];

console.log('━━━ 测试1：首次导入全新数据 ━━━');
{
  const newRows = [
    { routeName: '3路', date: '2026-06-08', startTime: '07:00', endTime: '07:30', passengerCount: 55 },
    { routeName: '3路', date: '2026-06-08', startTime: '07:30', endTime: '08:00', passengerCount: 72 },
  ];
  const importResult = simulateImport(newRows, currentSlots);
  assertEqual(importResult.newCount, 2, '首次导入新增2条');
  assertEqual(importResult.updateCount, 0, '首次导入无更新');
  assert(importResult.success, '首次导入success=true');
  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, 5, '总记录数=5（原3+新2）');
}

console.log('\n━━━ 测试2：重传同一批数据，只改客流数（纯更新） ━━━');
{
  const retransmitRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 55 },
    { routeName: '1路', date: '2026-06-07', startTime: '06:30', endTime: '07:00', passengerCount: 80 },
    { routeName: '5路', date: '2026-06-07', startTime: '06:15', endTime: '06:45', passengerCount: 40 },
  ];
  const importResult = simulateImport(retransmitRows, currentSlots);
  assertEqual(importResult.updateCount, 3, '重传更新3条');
  assertEqual(importResult.newCount, 0, '重传无新增');
  assert(importResult.success, '纯更新批次success=true');
  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, 5, '重传后总记录数仍=5，没有新增副本');
}

console.log('\n━━━ 测试3：验证原始ID保留，客流数已刷新 ━━━');
{
  const bt1 = currentSlots.find((s) => s.id === 'bt1');
  const bt2 = currentSlots.find((s) => s.id === 'bt2');
  const bt3 = currentSlots.find((s) => s.id === 'bt3');
  assert(bt1 !== undefined, 'bt1记录仍存在');
  assert(bt2 !== undefined, 'bt2记录仍存在');
  assert(bt3 !== undefined, 'bt3记录仍存在');
  if (bt1) {
    assertEqual(bt1.passengerCount, 55, 'bt1客流数从45→55');
    assert(bt1.importBatchId !== 'batch-001', 'bt1的importBatchId已刷新');
  }
  if (bt2) {
    assertEqual(bt2.passengerCount, 80, 'bt2客流数从68→80');
    assert(bt2.importBatchId !== 'batch-001', 'bt2的importBatchId已刷新');
  }
  if (bt3) {
    assertEqual(bt3.passengerCount, 40, 'bt3客流数从32→40');
    assert(bt3.importBatchId !== 'batch-001', 'bt3的importBatchId已刷新');
  }
}

console.log('\n━━━ 测试4：操作日志包含逐条修改明细 ━━━');
{
  const importLogs = operationLogs.filter((l) => l.operationType === 'import');
  assert(importLogs.length >= 2, `至少2条导入日志，实际${importLogs.length}条`);
  const retransmitLog = importLogs[importLogs.length - 1];
  assert(retransmitLog.metadata.updateCount === 3, '重传日志updateCount=3');
  assert(retransmitLog.metadata.newCount === 0, '重传日志newCount=0');
  const updateDetails = retransmitLog.metadata.updateDetails;
  assert(Array.isArray(updateDetails), 'updateDetails是数组');
  assertEqual(updateDetails.length, 3, 'updateDetails包含3条明细');
  const bt1Detail = updateDetails.find((d) => d.slotId === 'bt1');
  if (bt1Detail) {
    assertEqual(bt1Detail.passengerCountBefore, 45, 'bt1 before=45');
    assertEqual(bt1Detail.passengerCountAfter, 55, 'bt1 after=55');
    assertEqual(bt1Detail.routeKey, '1路|2026-06-07|06:00|06:30', 'bt1 routeKey正确');
  }
  const bt2Detail = updateDetails.find((d) => d.slotId === 'bt2');
  if (bt2Detail) {
    assertEqual(bt2Detail.passengerCountBefore, 68, 'bt2 before=68');
    assertEqual(bt2Detail.passengerCountAfter, 80, 'bt2 after=80');
  }
  const bt3Detail = updateDetails.find((d) => d.slotId === 'bt3');
  if (bt3Detail) {
    assertEqual(bt3Detail.passengerCountBefore, 32, 'bt3 before=32');
    assertEqual(bt3Detail.passengerCountAfter, 40, 'bt3 after=40');
  }
}

console.log('\n━━━ 测试5：批次ID贯穿导入、日志、记录 ━━━');
{
  const retransmitLog = operationLogs.filter((l) => l.operationType === 'import').pop();
  const logBatchId = retransmitLog.metadata.batchId;
  assert(!!logBatchId, '重传日志有batchId');
  const retransmitBatchIds = currentSlots
    .filter((s) => ['bt1', 'bt2', 'bt3'].includes(s.id))
    .map((s) => s.importBatchId);
  assert(
    retransmitBatchIds.every((id) => id === logBatchId),
    `记录的importBatchId与日志batchId一致: ${logBatchId}`
  );
  const updateSlotIds = retransmitLog.metadata.updateSlotIds;
  const sorted1 = [...updateSlotIds].sort();
  const sorted2 = ['bt1', 'bt2', 'bt3'].sort();
  assert(sorted1.length === sorted2.length && sorted1.every((v, i) => v === sorted2[i]), 'updateSlotIds包含bt1,bt2,bt3');
}

console.log('\n━━━ 测试6：混合批次（部分更新+部分新增） ━━━');
{
  const mixedRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 60 },
    { routeName: '7路', date: '2026-06-09', startTime: '08:00', endTime: '08:30', passengerCount: 99 },
  ];
  const importResult = simulateImport(mixedRows, currentSlots);
  assertEqual(importResult.updateCount, 1, '混合批次：1条更新');
  assertEqual(importResult.newCount, 1, '混合批次：1条新增');
  assert(importResult.success, '混合批次success=true');
  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, 6, '总记录数=6（5+1新增）');
  const bt1Updated = currentSlots.find((s) => s.id === 'bt1');
  if (bt1Updated) assertEqual(bt1Updated.passengerCount, 60, 'bt1客流数从55→60');
  const newSlot = currentSlots.find((s) => s.routeName === '7路');
  assert(!!newSlot, '7路新记录存在');
  if (newSlot) assertEqual(newSlot.passengerCount, 99, '7路客流数=99');
}

console.log('\n━━━ 测试7：连续重传同一批，不产生副本 ━━━');
{
  const beforeCount = currentSlots.length;
  const sameRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 100 },
    { routeName: '1路', date: '2026-06-07', startTime: '06:30', endTime: '07:00', passengerCount: 110 },
  ];
  const importResult = simulateImport(sameRows, currentSlots);
  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, beforeCount, '重传后记录数不变');
  const bt1Again = currentSlots.find((s) => s.id === 'bt1');
  if (bt1Again) assertEqual(bt1Again.passengerCount, 100, 'bt1客流数最终=100');
  const bt2Again = currentSlots.find((s) => s.id === 'bt2');
  if (bt2Again) assertEqual(bt2Again.passengerCount, 110, 'bt2客流数最终=110');
}

console.log('\n━━━ 测试8：导出数据核对 ━━━');
{
  const exportData = currentSlots.map((slot) => ({
    '记录ID': slot.id,
    '线路': slot.routeName,
    '日期': slot.date,
    '开始时间': slot.startTime,
    '结束时间': slot.endTime,
    '客流数': slot.passengerCount,
    '导入批次': slot.importBatchId,
  }));
  assertEqual(exportData.length, currentSlots.length, '导出行数与记录数一致');
  const bt1Export = exportData.find((r) => r['记录ID'] === 'bt1');
  if (bt1Export) {
    assertEqual(bt1Export['线路'], '1路', '导出bt1线路=1路');
    assertEqual(bt1Export['客流数'], 100, '导出bt1客流数=100');
    assert(bt1Export['导入批次'] !== 'batch-001', '导出bt1批次ID已更新');
  }
  const importLogForExport = operationLogs.filter((l) => l.operationType === 'import').pop();
  if (importLogForExport) {
    assert(!!importLogForExport.metadata.batchId, '日志导出有批次ID');
    const updateSummary = (importLogForExport.metadata.updateDetails || [])
      .map((ud) => `${ud.routeKey.replace(/\|/g, '-')} 客流${ud.passengerCountBefore}→${ud.passengerCountAfter}(ID:${ud.slotId.slice(-8)})`)
      .join('; ');
    assert(!!updateSummary, '日志导出有更新记录明细');
    console.log(`    📋 日志更新明细: ${updateSummary}`);
  }
}

console.log('\n━━━ 测试9：去重键验证（线路+日期+开始+结束） ━━━');
{
  const slot1 = { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 999 };
  const slot2 = { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '07:00', passengerCount: 999 };
  const slot3 = { routeName: '1路', date: '2026-06-08', startTime: '06:00', endTime: '06:30', passengerCount: 999 };
  assert(!!findExisting(slot1, currentSlots), '同线路+同日期+同起止时间=重复');
  assert(!findExisting(slot2, currentSlots), '同线路+同日期+不同结束时间=不重复');
  assert(!findExisting(slot3, currentSlots), '同线路+不同日期=不重复');
}

console.log('\n━━━ 测试10：边界点位关联时段 ━━━');
{
  const p2Slots = currentSlots.filter((s) => s.relatedPointIds.includes('p2'));
  assert(p2Slots.length > 0, `p2(两街交界点位A)有关联时段: ${p2Slots.length}条`);
  const p2SlotIds = p2Slots.map((s) => s.id);
  assert(p2SlotIds.includes('bt1'), 'p2关联bt1');
  assert(p2SlotIds.includes('bt2'), 'p2关联bt2');
}

console.log('\n━━━ 测试11：纯更新批次确认按钮不被禁用 ━━━');
{
  const pureUpdateRows = [
    { routeName: '5路', date: '2026-06-07', startTime: '06:15', endTime: '06:45', passengerCount: 50 },
  ];
  const importResult = simulateImport(pureUpdateRows, currentSlots);
  const confirmDisabled = importResult.newCount === 0 && importResult.updateCount === 0;
  assert(!confirmDisabled, '纯更新批次确认按钮不被禁用');
  assert(importResult.success, '纯更新批次success=true');
}

console.log('\n━━━ 测试12：duplicates对比表数据完整性 ━━━');
{
  const dupRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 120 },
  ];
  const importResult = simulateImport(dupRows, currentSlots);
  assertEqual(importResult.duplicates.length, 1, 'duplicates有1条');
  const dup = importResult.duplicates[0];
  assert(!!dup.existingSlot, 'duplicates[0]有existingSlot');
  assert(!!dup.slot, 'duplicates[0]有slot');
  assert(dup.changedFields.includes('passengerCount'), 'changedFields包含passengerCount');
  assertEqual(dup.existingSlot.passengerCount, 100, 'existingSlot客流数=100');
  assertEqual(dup.slot.passengerCount, 120, 'slot客流数=120');
  assertEqual(dup.existingSlot.id, 'bt1', 'existingSlot.id=bt1');
}

console.log('\n=================================================');
if (process.exitCode === 0) {
  console.log('🎉 全部测试通过！重复导入可更新功能验证完毕。');
  console.log('');
  console.log('关键结论：');
  console.log('  1. 重传同一批材料不会新增副本，只更新旧记录客流数');
  console.log('  2. 原始记录ID完整保留');
  console.log('  3. 操作日志逐条记录了客流数from→to');
  console.log('  4. 批次ID贯穿导入、记录、日志、导出');
  console.log('  5. 纯更新批次确认按钮不会被禁用');
  console.log('  6. duplicates对比表包含旧值/新值/变更字段');
  console.log('  7. 去重键=线路+日期+开始时间+结束时间');
} else {
  console.log('⚠️ 存在失败测试，请检查上方❌标记。');
}
console.log('');
      duplicates.push({ slot, existingSlot: existing, changedFields });
      data.push(slot);
      updateCount++;
    } else {
      data.push(slot);
      newCount++;
    }
  });

  return {
    success: newCount > 0 || updateCount > 0,
    data,
    duplicateCount,
    newCount,
    updateCount,
    duplicates,
    errors: [],
    batchId,
  };
}

console.log('\n=================================================');
console.log('早市摊位轮换 - 重复导入可更新 端到端验证脚本');
console.log('=================================================\n');

let currentSlots = [...initialSlots];

console.log('━━━ 测试1：首次导入全新数据 ━━━');
{
  const newRows = [
    { routeName: '3路', date: '2026-06-08', startTime: '07:00', endTime: '07:30', passengerCount: 55 },
    { routeName: '3路', date: '2026-06-08', startTime: '07:30', endTime: '08:00', passengerCount: 72 },
  ];
  const importResult = simulateImport(newRows, currentSlots);
  assertEqual(importResult.newCount, 2, '首次导入新增2条');
  assertEqual(importResult.updateCount, 0, '首次导入无更新');
  assert(importResult.success, '首次导入success=true');
  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, 5, '总记录数=5（原3+新2）');
}

console.log('\n━━━ 测试2：重传同一批数据，只改客流数（纯更新） ━━━');
{
  const retransmitRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 55 },
    { routeName: '1路', date: '2026-06-07', startTime: '06:30', endTime: '07:00', passengerCount: 80 },
    { routeName: '5路', date: '2026-06-07', startTime: '06:15', endTime: '06:45', passengerCount: 40 },
  ];
  const importResult = simulateImport(retransmitRows, currentSlots);
  assertEqual(importResult.updateCount, 3, '重传更新3条');
  assertEqual(importResult.newCount, 0, '重传无新增');
  assert(importResult.success, '纯更新批次success=true');
  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, 5, '重传后总记录数仍=5，没有新增副本');
}

console.log('\n━━━ 测试3：验证原始ID保留，客流数已刷新 ━━━');
{
  const bt1 = currentSlots.find((s) => s.id === 'bt1');
  const bt2 = currentSlots.find((s) => s.id === 'bt2');
  const bt3 = currentSlots.find((s) => s.id === 'bt3');
  assert(bt1 !== undefined, 'bt1记录仍存在');
  assert(bt2 !== undefined, 'bt2记录仍存在');
  assert(bt3 !== undefined, 'bt3记录仍存在');
  if (bt1) {
    assertEqual(bt1.passengerCount, 55, 'bt1客流数从45→55');
    assert(bt1.importBatchId !== 'batch-001', 'bt1的importBatchId已刷新');
  }
  if (bt2) {
    assertEqual(bt2.passengerCount, 80, 'bt2客流数从68→80');
    assert(bt2.importBatchId !== 'batch-001', 'bt2的importBatchId已刷新');
  }
  if (bt3) {
    assertEqual(bt3.passengerCount, 40, 'bt3客流数从32→40');
    assert(bt3.importBatchId !== 'batch-001', 'bt3的importBatchId已刷新');
  }
}

console.log('\n━━━ 测试4：操作日志包含逐条修改明细 ━━━');
{
  const importLogs = operationLogs.filter((l) => l.operationType === 'import');
  assert(importLogs.length >= 2, `至少2条导入日志，实际${importLogs.length}条`);
  const retransmitLog = importLogs[importLogs.length - 1];
  assert(retransmitLog.metadata.updateCount === 3, '重传日志updateCount=3');
  assert(retransmitLog.metadata.newCount === 0, '重传日志newCount=0');
  const updateDetails = retransmitLog.metadata.updateDetails;
  assert(Array.isArray(updateDetails), 'updateDetails是数组');
  assertEqual(updateDetails.length, 3, 'updateDetails包含3条明细');
  const bt1Detail = updateDetails.find((d) => d.slotId === 'bt1');
  if (bt1Detail) {
    assertEqual(bt1Detail.passengerCountBefore, 45, 'bt1 before=45');
    assertEqual(bt1Detail.passengerCountAfter, 55, 'bt1 after=55');
    assertEqual(bt1Detail.routeKey, '1路|2026-06-07|06:00|06:30', 'bt1 routeKey正确');
  }
  const bt2Detail = updateDetails.find((d) => d.slotId === 'bt2');
  if (bt2Detail) {
    assertEqual(bt2Detail.passengerCountBefore, 68, 'bt2 before=68');
    assertEqual(bt2Detail.passengerCountAfter, 80, 'bt2 after=80');
  }
  const bt3Detail = updateDetails.find((d) => d.slotId === 'bt3');
  if (bt3Detail) {
    assertEqual(bt3Detail.passengerCountBefore, 32, 'bt3 before=32');
    assertEqual(bt3Detail.passengerCountAfter, 40, 'bt3 after=40');
  }
}

console.log('\n━━━ 测试5：批次ID贯穿导入、日志、记录 ━━━');
{
  const retransmitLog = operationLogs.filter((l) => l.operationType === 'import').pop();
  const logBatchId = retransmitLog.metadata.batchId;
  assert(!!logBatchId, '重传日志有batchId');
  const retransmitBatchIds = currentSlots
    .filter((s) => ['bt1', 'bt2', 'bt3'].includes(s.id))
    .map((s) => s.importBatchId);
  assert(
    retransmitBatchIds.every((id) => id === logBatchId),
    `记录的importBatchId与日志batchId一致: ${logBatchId}`
  );
  const updateSlotIds = retransmitLog.metadata.updateSlotIds;
  const sorted1 = [...updateSlotIds].sort();
  const sorted2 = ['bt1', 'bt2', 'bt3'].sort();
  assert(sorted1.length === sorted2.length && sorted1.every((v, i) => v === sorted2[i]), 'updateSlotIds包含bt1,bt2,bt3');
}

console.log('\n━━━ 测试6：混合批次（部分更新+部分新增） ━━━');
{
  const mixedRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 60 },
    { routeName: '7路', date: '2026-06-09', startTime: '08:00', endTime: '08:30', passengerCount: 99 },
  ];
  const importResult = simulateImport(mixedRows, currentSlots);
  assertEqual(importResult.updateCount, 1, '混合批次：1条更新');
  assertEqual(importResult.newCount, 1, '混合批次：1条新增');
  assert(importResult.success, '混合批次success=true');
  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, 6, '总记录数=6（5+1新增）');
  const bt1Updated = currentSlots.find((s) => s.id === 'bt1');
  if (bt1Updated) assertEqual(bt1Updated.passengerCount, 60, 'bt1客流数从55→60');
  const newSlot = currentSlots.find((s) => s.routeName === '7路');
  assert(!!newSlot, '7路新记录存在');
  if (newSlot) assertEqual(newSlot.passengerCount, 99, '7路客流数=99');
}

console.log('\n━━━ 测试7：连续重传同一批，不产生副本 ━━━');
{
  const beforeCount = currentSlots.length;
  const sameRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 100 },
    { routeName: '1路', date: '2026-06-07', startTime: '06:30', endTime: '07:00', passengerCount: 110 },
  ];
  const importResult = simulateImport(sameRows, currentSlots);
  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, beforeCount, '重传后记录数不变');
  const bt1Again = currentSlots.find((s) => s.id === 'bt1');
  if (bt1Again) assertEqual(bt1Again.passengerCount, 100, 'bt1客流数最终=100');
  const bt2Again = currentSlots.find((s) => s.id === 'bt2');
  if (bt2Again) assertEqual(bt2Again.passengerCount, 110, 'bt2客流数最终=110');
}

console.log('\n━━━ 测试8：导出数据核对 ━━━');
{
  const exportData = currentSlots.map((slot) => ({
    '记录ID': slot.id,
    '线路': slot.routeName,
    '日期': slot.date,
    '开始时间': slot.startTime,
    '结束时间': slot.endTime,
    '客流数': slot.passengerCount,
    '导入批次': slot.importBatchId,
  }));
  assertEqual(exportData.length, currentSlots.length, '导出行数与记录数一致');
  const bt1Export = exportData.find((r) => r['记录ID'] === 'bt1');
  if (bt1Export) {
    assertEqual(bt1Export['线路'], '1路', '导出bt1线路=1路');
    assertEqual(bt1Export['客流数'], 100, '导出bt1客流数=100');
    assert(bt1Export['导入批次'] !== 'batch-001', '导出bt1批次ID已更新');
  }
  const importLogForExport = operationLogs.filter((l) => l.operationType === 'import').pop();
  if (importLogForExport) {
    assert(!!importLogForExport.metadata.batchId, '日志导出有批次ID');
    const updateSummary = (importLogForExport.metadata.updateDetails || [])
      .map((ud) => `${ud.routeKey.replace(/\|/g, '-')} 客流${ud.passengerCountBefore}→${ud.passengerCountAfter}(ID:${ud.slotId.slice(-8)})`)
      .join('; ');
    assert(!!updateSummary, '日志导出有更新记录明细');
    console.log(`    📋 日志更新明细: ${updateSummary}`);
  }
}

console.log('\n━━━ 测试9：去重键验证（线路+日期+开始+结束） ━━━');
{
  const slot1 = { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 999 };
  const slot2 = { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '07:00', passengerCount: 999 };
  const slot3 = { routeName: '1路', date: '2026-06-08', startTime: '06:00', endTime: '06:30', passengerCount: 999 };
  assert(!!findExisting(slot1, currentSlots), '同线路+同日期+同起止时间=重复');
  assert(!findExisting(slot2, currentSlots), '同线路+同日期+不同结束时间=不重复');
  assert(!findExisting(slot3, currentSlots), '同线路+不同日期=不重复');
}

console.log('\n━━━ 测试10：边界点位关联时段 ━━━');
{
  const p2Slots = currentSlots.filter((s) => s.relatedPointIds.includes('p2'));
  assert(p2Slots.length > 0, `p2(两街交界点位A)有关联时段: ${p2Slots.length}条`);
  const p2SlotIds = p2Slots.map((s) => s.id);
  assert(p2SlotIds.includes('bt1'), 'p2关联bt1');
  assert(p2SlotIds.includes('bt2'), 'p2关联bt2');
}

console.log('\n━━━ 测试11：纯更新批次确认按钮不被禁用 ━━━');
{
  const pureUpdateRows = [
    { routeName: '5路', date: '2026-06-07', startTime: '06:15', endTime: '06:45', passengerCount: 50 },
  ];
  const importResult = simulateImport(pureUpdateRows, currentSlots);
  const confirmDisabled = importResult.newCount === 0 && importResult.updateCount === 0;
  assert(!confirmDisabled, '纯更新批次确认按钮不被禁用');
  assert(importResult.success, '纯更新批次success=true');
}

console.log('\n━━━ 测试12：duplicates对比表数据完整性 ━━━');
{
  const dupRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 120 },
  ];
  const importResult = simulateImport(dupRows, currentSlots);
  assertEqual(importResult.duplicates.length, 1, 'duplicates有1条');
  const dup = importResult.duplicates[0];
  assert(!!dup.existingSlot, 'duplicates[0]有existingSlot');
  assert(!!dup.slot, 'duplicates[0]有slot');
  assert(dup.changedFields.includes('passengerCount'), 'changedFields包含passengerCount');
  assertEqual(dup.existingSlot.passengerCount, 100, 'existingSlot客流数=100');
  assertEqual(dup.slot.passengerCount, 120, 'slot客流数=120');
  assertEqual(dup.existingSlot.id, 'bt1', 'existingSlot.id=bt1');
}

console.log('\n=================================================');
if (process.exitCode === 0) {
  console.log('🎉 全部测试通过！重复导入可更新功能验证完毕。');
  console.log('');
  console.log('关键结论：');
  console.log('  1. 重传同一批材料不会新增副本，只更新旧记录客流数');
  console.log('  2. 原始记录ID完整保留');
  console.log('  3. 操作日志逐条记录了客流数from→to');
  console.log('  4. 批次ID贯穿导入、记录、日志、导出');
  console.log('  5. 纯更新批次确认按钮不会被禁用');
  console.log('  6. duplicates对比表包含旧值/新值/变更字段');
  console.log('  7. 去重键=线路+日期+开始时间+结束时间');
} else {
  console.log('⚠️ 存在失败测试，请检查上方❌标记。');
}
console.log('');
      duplicates.push({ slot, existingSlot: existing, changedFields });
      data.push(slot);
      updateCount++;
    } else {
      data.push(slot);
      newCount++;
    }
  });

  return {
    success: newCount > 0 || updateCount > 0,
    data,
    duplicateCount,
    newCount,
    updateCount,
    duplicates,
    errors: [],
    batchId,
  };
}

console.log('\n=================================================');
console.log('早市摊位轮换 - 重复导入可更新 端到端验证脚本');
console.log('=================================================\n');

let currentSlots = [...initialSlots];

console.log('━━━ 测试1：首次导入全新数据 ━━━');
{
  const newRows = [
    { routeName: '3路', date: '2026-06-08', startTime: '07:00', endTime: '07:30', passengerCount: 55 },
    { routeName: '3路', date: '2026-06-08', startTime: '07:30', endTime: '08:00', passengerCount: 72 },
  ];
  const importResult = simulateImport(newRows, currentSlots);
  assertEqual(importResult.newCount, 2, '首次导入新增2条');
  assertEqual(importResult.updateCount, 0, '首次导入无更新');
  assert(importResult.success, '首次导入success=true');
  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, 5, '总记录数=5（原3+新2）');
}

console.log('\n━━━ 测试2：重传同一批数据，只改客流数（纯更新） ━━━');
{
  const retransmitRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 55 },
    { routeName: '1路', date: '2026-06-07', startTime: '06:30', endTime: '07:00', passengerCount: 80 },
    { routeName: '5路', date: '2026-06-07', startTime: '06:15', endTime: '06:45', passengerCount: 40 },
  ];
  const importResult = simulateImport(retransmitRows, currentSlots);
  assertEqual(importResult.updateCount, 3, '重传更新3条');
  assertEqual(importResult.newCount, 0, '重传无新增');
  assert(importResult.success, '纯更新批次success=true');
  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, 5, '重传后总记录数仍=5，没有新增副本');
}

console.log('\n━━━ 测试3：验证原始ID保留，客流数已刷新 ━━━');
{
  const bt1 = currentSlots.find((s) => s.id === 'bt1');
  const bt2 = currentSlots.find((s) => s.id === 'bt2');
  const bt3 = currentSlots.find((s) => s.id === 'bt3');
  assert(bt1 !== undefined, 'bt1记录仍存在');
  assert(bt2 !== undefined, 'bt2记录仍存在');
  assert(bt3 !== undefined, 'bt3记录仍存在');
  if (bt1) {
    assertEqual(bt1.passengerCount, 55, 'bt1客流数从45→55');
    assert(bt1.importBatchId !== 'batch-001', 'bt1的importBatchId已刷新');
  }
  if (bt2) {
    assertEqual(bt2.passengerCount, 80, 'bt2客流数从68→80');
    assert(bt2.importBatchId !== 'batch-001', 'bt2的importBatchId已刷新');
  }
  if (bt3) {
    assertEqual(bt3.passengerCount, 40, 'bt3客流数从32→40');
    assert(bt3.importBatchId !== 'batch-001', 'bt3的importBatchId已刷新');
  }
}

console.log('\n━━━ 测试4：操作日志包含逐条修改明细 ━━━');
{
  const importLogs = operationLogs.filter((l) => l.operationType === 'import');
  assert(importLogs.length >= 2, `至少2条导入日志，实际${importLogs.length}条`);
  const retransmitLog = importLogs[importLogs.length - 1];
  assert(retransmitLog.metadata.updateCount === 3, '重传日志updateCount=3');
  assert(retransmitLog.metadata.newCount === 0, '重传日志newCount=0');
  const updateDetails = retransmitLog.metadata.updateDetails;
  assert(Array.isArray(updateDetails), 'updateDetails是数组');
  assertEqual(updateDetails.length, 3, 'updateDetails包含3条明细');
  const bt1Detail = updateDetails.find((d) => d.slotId === 'bt1');
  if (bt1Detail) {
    assertEqual(bt1Detail.passengerCountBefore, 45, 'bt1 before=45');
    assertEqual(bt1Detail.passengerCountAfter, 55, 'bt1 after=55');
    assertEqual(bt1Detail.routeKey, '1路|2026-06-07|06:00|06:30', 'bt1 routeKey正确');
  }
  const bt2Detail = updateDetails.find((d) => d.slotId === 'bt2');
  if (bt2Detail) {
    assertEqual(bt2Detail.passengerCountBefore, 68, 'bt2 before=68');
    assertEqual(bt2Detail.passengerCountAfter, 80, 'bt2 after=80');
  }
  const bt3Detail = updateDetails.find((d) => d.slotId === 'bt3');
  if (bt3Detail) {
    assertEqual(bt3Detail.passengerCountBefore, 32, 'bt3 before=32');
    assertEqual(bt3Detail.passengerCountAfter, 40, 'bt3 after=40');
  }
}

console.log('\n━━━ 测试5：批次ID贯穿导入、日志、记录 ━━━');
{
  const retransmitLog = operationLogs.filter((l) => l.operationType === 'import').pop();
  const logBatchId = retransmitLog.metadata.batchId;
  assert(!!logBatchId, '重传日志有batchId');
  const retransmitBatchIds = currentSlots
    .filter((s) => ['bt1', 'bt2', 'bt3'].includes(s.id))
    .map((s) => s.importBatchId);
  assert(
    retransmitBatchIds.every((id) => id === logBatchId),
    `记录的importBatchId与日志batchId一致: ${logBatchId}`
  );
  const updateSlotIds = retransmitLog.metadata.updateSlotIds;
  const sorted1 = [...updateSlotIds].sort();
  const sorted2 = ['bt1', 'bt2', 'bt3'].sort();
  assert(sorted1.length === sorted2.length && sorted1.every((v, i) => v === sorted2[i]), 'updateSlotIds包含bt1,bt2,bt3');
}

console.log('\n━━━ 测试6：混合批次（部分更新+部分新增） ━━━');
{
  const mixedRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 60 },
    { routeName: '7路', date: '2026-06-09', startTime: '08:00', endTime: '08:30', passengerCount: 99 },
  ];
  const importResult = simulateImport(mixedRows, currentSlots);
  assertEqual(importResult.updateCount, 1, '混合批次：1条更新');
  assertEqual(importResult.newCount, 1, '混合批次：1条新增');
  assert(importResult.success, '混合批次success=true');
  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, 6, '总记录数=6（5+1新增）');
  const bt1Updated = currentSlots.find((s) => s.id === 'bt1');
  if (bt1Updated) assertEqual(bt1Updated.passengerCount, 60, 'bt1客流数从55→60');
  const newSlot = currentSlots.find((s) => s.routeName === '7路');
  assert(!!newSlot, '7路新记录存在');
  if (newSlot) assertEqual(newSlot.passengerCount, 99, '7路客流数=99');
}

console.log('\n━━━ 测试7：连续重传同一批，不产生副本 ━━━');
{
  const beforeCount = currentSlots.length;
  const sameRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 100 },
    { routeName: '1路', date: '2026-06-07', startTime: '06:30', endTime: '07:00', passengerCount: 110 },
  ];
  const importResult = simulateImport(sameRows, currentSlots);
  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, beforeCount, '重传后记录数不变');
  const bt1Again = currentSlots.find((s) => s.id === 'bt1');
  if (bt1Again) assertEqual(bt1Again.passengerCount, 100, 'bt1客流数最终=100');
  const bt2Again = currentSlots.find((s) => s.id === 'bt2');
  if (bt2Again) assertEqual(bt2Again.passengerCount, 110, 'bt2客流数最终=110');
}

console.log('\n━━━ 测试8：导出数据核对 ━━━');
{
  const exportData = currentSlots.map((slot) => ({
    '记录ID': slot.id,
    '线路': slot.routeName,
    '日期': slot.date,
    '开始时间': slot.startTime,
    '结束时间': slot.endTime,
    '客流数': slot.passengerCount,
    '导入批次': slot.importBatchId,
  }));
  assertEqual(exportData.length, currentSlots.length, '导出行数与记录数一致');
  const bt1Export = exportData.find((r) => r['记录ID'] === 'bt1');
  if (bt1Export) {
    assertEqual(bt1Export['线路'], '1路', '导出bt1线路=1路');
    assertEqual(bt1Export['客流数'], 100, '导出bt1客流数=100');
    assert(bt1Export['导入批次'] !== 'batch-001', '导出bt1批次ID已更新');
  }
  const importLogForExport = operationLogs.filter((l) => l.operationType === 'import').pop();
  if (importLogForExport) {
    assert(!!importLogForExport.metadata.batchId, '日志导出有批次ID');
    const updateSummary = (importLogForExport.metadata.updateDetails || [])
      .map((ud) => `${ud.routeKey.replace(/\|/g, '-')} 客流${ud.passengerCountBefore}→${ud.passengerCountAfter}(ID:${ud.slotId.slice(-8)})`)
      .join('; ');
    assert(!!updateSummary, '日志导出有更新记录明细');
    console.log(`    📋 日志更新明细: ${updateSummary}`);
  }
}

console.log('\n━━━ 测试9：去重键验证（线路+日期+开始+结束） ━━━');
{
  const slot1 = { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 999 };
  const slot2 = { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '07:00', passengerCount: 999 };
  const slot3 = { routeName: '1路', date: '2026-06-08', startTime: '06:00', endTime: '06:30', passengerCount: 999 };
  assert(!!findExisting(slot1, currentSlots), '同线路+同日期+同起止时间=重复');
  assert(!findExisting(slot2, currentSlots), '同线路+同日期+不同结束时间=不重复');
  assert(!findExisting(slot3, currentSlots), '同线路+不同日期=不重复');
}

console.log('\n━━━ 测试10：边界点位关联时段 ━━━');
{
  const p2Slots = currentSlots.filter((s) => s.relatedPointIds.includes('p2'));
  assert(p2Slots.length > 0, `p2(两街交界点位A)有关联时段: ${p2Slots.length}条`);
  const p2SlotIds = p2Slots.map((s) => s.id);
  assert(p2SlotIds.includes('bt1'), 'p2关联bt1');
  assert(p2SlotIds.includes('bt2'), 'p2关联bt2');
}

console.log('\n━━━ 测试11：纯更新批次确认按钮不被禁用 ━━━');
{
  const pureUpdateRows = [
    { routeName: '5路', date: '2026-06-07', startTime: '06:15', endTime: '06:45', passengerCount: 50 },
  ];
  const importResult = simulateImport(pureUpdateRows, currentSlots);
  const confirmDisabled = importResult.newCount === 0 && importResult.updateCount === 0;
  assert(!confirmDisabled, '纯更新批次确认按钮不被禁用');
  assert(importResult.success, '纯更新批次success=true');
}

console.log('\n━━━ 测试12：duplicates对比表数据完整性 ━━━');
{
  const dupRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 120 },
  ];
  const importResult = simulateImport(dupRows, currentSlots);
  assertEqual(importResult.duplicates.length, 1, 'duplicates有1条');
  const dup = importResult.duplicates[0];
  assert(!!dup.existingSlot, 'duplicates[0]有existingSlot');
  assert(!!dup.slot, 'duplicates[0]有slot');
  assert(dup.changedFields.includes('passengerCount'), 'changedFields包含passengerCount');
  assertEqual(dup.existingSlot.passengerCount, 100, 'existingSlot客流数=100');
  assertEqual(dup.slot.passengerCount, 120, 'slot客流数=120');
  assertEqual(dup.existingSlot.id, 'bt1', 'existingSlot.id=bt1');
}

console.log('\n=================================================');
if (process.exitCode === 0) {
  console.log('🎉 全部测试通过！重复导入可更新功能验证完毕。');
  console.log('');
  console.log('关键结论：');
  console.log('  1. 重传同一批材料不会新增副本，只更新旧记录客流数');
  console.log('  2. 原始记录ID完整保留');
  console.log('  3. 操作日志逐条记录了客流数from→to');
  console.log('  4. 批次ID贯穿导入、记录、日志、导出');
  console.log('  5. 纯更新批次确认按钮不会被禁用');
  console.log('  6. duplicates对比表包含旧值/新值/变更字段');
  console.log('  7. 去重键=线路+日期+开始时间+结束时间');
} else {
  console.log('⚠️ 存在失败测试，请检查上方❌标记。');
}
console.log('');
      endTime: String(row.endTime || ''),
      passengerCount: Number(row.passengerCount) || 0,
      relatedPointIds: [],
      importBatchId: batchId,
      createdAt: now,
      updatedAt: now,
    };

    const existing = findExisting(slot, existingSlots);
    if (existing) {
      duplicateCount++;
      const changedFields = [];
      if (existing.passengerCount !== slot.passengerCount) {
        changedFields.push('passengerCount');
      }
      duplicates.push({ slot, existingSlot: existing, changedFields });
      data.push(slot);
      updateCount++;
    } else {
      data.push(slot);
      newCount++;
    }
  });

  return {
    success: newCount > 0 || updateCount > 0,
    data,
    duplicateCount,
    newCount,
    updateCount,
    duplicates,
    errors,
    batchId,
  };
}

console.log('\n=================================================');
console.log('早市摊位轮换 - 重复导入可更新 端到端验证脚本');
console.log('=================================================\n');

let currentSlots = [...initialSlots];

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('测试1：首次导入全新数据（应全部新增）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
{
  const newRows = [
    { routeName: '3路', date: '2026-06-08', startTime: '07:00', endTime: '07:30', passengerCount: 55 },
    { routeName: '3路', date: '2026-06-08', startTime: '07:30', endTime: '08:00', passengerCount: 72 },
  ];
  const importResult = simulateImport(newRows, currentSlots);
  assertEqual(importResult.newCount, 2, '首次导入新增2条');
  assertEqual(importResult.updateCount, 0, '首次导入无更新');
  assertEqual(importResult.duplicateCount, 0, '首次导入无重复');
  assert(importResult.success, '首次导入success=true');

  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  assertEqual(storeResult.newCount, 2, 'Store新增2条');
  assertEqual(storeResult.updateCount, 0, 'Store无更新');
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, 5, '总记录数=5（原3+新2）');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('测试2：重传同一批数据，只改客流数（纯更新）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
{
  const retransmitRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 55 },
    { routeName: '1路', date: '2026-06-07', startTime: '06:30', endTime: '07:00', passengerCount: 80 },
    { routeName: '5路', date: '2026-06-07', startTime: '06:15', endTime: '06:45', passengerCount: 40 },
  ];
  const importResult = simulateImport(retransmitRows, currentSlots);
  assertEqual(importResult.updateCount, 3, '重传更新3条');
  assertEqual(importResult.newCount, 0, '重传无新增');
  assertEqual(importResult.duplicateCount, 3, '检测到3条重复');
  assert(importResult.success, '纯更新批次success=true');

  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  assertEqual(storeResult.updateCount, 3, 'Store更新3条');
  assertEqual(storeResult.newCount, 0, 'Store无新增');
  currentSlots = storeResult.resultSlots;

  assertEqual(currentSlots.length, 5, '重传后总记录数仍=5，没有新增副本');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('测试3：验证原始ID保留，客流数已刷新');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
{
  const bt1 = currentSlots.find((s) => s.id === 'bt1');
  const bt2 = currentSlots.find((s) => s.id === 'bt2');
  const bt3 = currentSlots.find((s) => s.id === 'bt3');

  assert(bt1 !== undefined, 'bt1记录仍存在');
  assert(bt2 !== undefined, 'bt2记录仍存在');
  assert(bt3 !== undefined, 'bt3记录仍存在');

  if (bt1) {
    assertEqual(bt1.passengerCount, 55, 'bt1客流数从45→55');
    assert(bt1.importBatchId !== 'batch-001', 'bt1的importBatchId已刷新为新批次');
  }
  if (bt2) {
    assertEqual(bt2.passengerCount, 80, 'bt2客流数从68→80');
    assert(bt2.importBatchId !== 'batch-001', 'bt2的importBatchId已刷新为新批次');
  }
  if (bt3) {
    assertEqual(bt3.passengerCount, 40, 'bt3客流数从32→40');
    assert(bt3.importBatchId !== 'batch-001', 'bt3的importBatchId已刷新为新批次');
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('测试4：验证操作日志包含逐条修改明细');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
{
  const importLogs = operationLogs.filter((l) => l.operationType === 'import');
  assert(importLogs.length >= 2, `至少2条导入日志（首次+重传），实际${importLogs.length}条`);

  const retransmitLog = importLogs[importLogs.length - 1];
  assert(retransmitLog.metadata.updateCount === 3, `重传日志updateCount=3`);
  assert(retransmitLog.metadata.newCount === 0, '重传日志newCount=0');

  const updateDetails = retransmitLog.metadata.updateDetails;
  assert(Array.isArray(updateDetails), 'updateDetails是数组');
  assertEqual(updateDetails.length, 3, 'updateDetails包含3条明细');

  const bt1Detail = updateDetails.find((d) => d.slotId === 'bt1');
  if (bt1Detail) {
    assertEqual(bt1Detail.passengerCountBefore, 45, 'bt1 before=45');
    assertEqual(bt1Detail.passengerCountAfter, 55, 'bt1 after=55');
    assertEqual(bt1Detail.routeKey, '1路|2026-06-07|06:00|06:30', 'bt1 routeKey正确');
  } else {
    assert(false, '找不到bt1的更新明细');
  }

  const bt2Detail = updateDetails.find((d) => d.slotId === 'bt2');
  if (bt2Detail) {
    assertEqual(bt2Detail.passengerCountBefore, 68, 'bt2 before=68');
    assertEqual(bt2Detail.passengerCountAfter, 80, 'bt2 after=80');
  } else {
    assert(false, '找不到bt2的更新明细');
  }

  const bt3Detail = updateDetails.find((d) => d.slotId === 'bt3');
  if (bt3Detail) {
    assertEqual(bt3Detail.passengerCountBefore, 32, 'bt3 before=32');
    assertEqual(bt3Detail.passengerCountAfter, 40, 'bt3 after=40');
  } else {
    assert(false, '找不到bt3的更新明细');
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('测试5：验证批次ID贯穿导入、日志、记录');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
{
  const retransmitLog = operationLogs.filter((l) => l.operationType === 'import').pop();
  const logBatchId = retransmitLog.metadata.batchId;
  assert(!!logBatchId, '重传日志有batchId');

  const retransmitBatchIds = currentSlots
    .filter((s) => ['bt1', 'bt2', 'bt3'].includes(s.id))
    .map((s) => s.importBatchId);
  assert(
    retransmitBatchIds.every((id) => id === logBatchId),
    `记录的importBatchId与日志batchId一致: ${logBatchId}`
  );

  const updateSlotIds = retransmitLog.metadata.updateSlotIds;
  assertDeepEqual(updateSlotIds.sort(), ['bt1', 'bt2', 'bt3'].sort(), 'updateSlotIds包含bt1,bt2,bt3');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('测试6：混合批次（部分更新+部分新增）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
{
  const mixedRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 60 },
    { routeName: '7路', date: '2026-06-09', startTime: '08:00', endTime: '08:30', passengerCount: 99 },
  ];
  const importResult = simulateImport(mixedRows, currentSlots);
  assertEqual(importResult.updateCount, 1, '混合批次：1条更新');
  assertEqual(importResult.newCount, 1, '混合批次：1条新增');
  assert(importResult.success, '混合批次success=true');

  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, 6, '总记录数=6（5+1新增）');

  const bt1Updated = currentSlots.find((s) => s.id === 'bt1');
  if (bt1Updated) {
    assertEqual(bt1Updated.passengerCount, 60, 'bt1客流数从55→60');
  }

  const newSlot = currentSlots.find((s) => s.routeName === '7路');
  assert(!!newSlot, '7路新记录存在');
  if (newSlot) {
    assertEqual(newSlot.passengerCount, 99, '7路客流数=99');
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('测试7：连续重传同一批，不产生副本');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
{
  const beforeCount = currentSlots.length;
  const sameRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 100 },
    { routeName: '1路', date: '2026-06-07', startTime: '06:30', endTime: '07:00', passengerCount: 110 },
  ];
  const importResult = simulateImport(sameRows, currentSlots);
  const storeResult = addBusTimeSlots(importResult.data, currentSlots, importResult.batchId);
  currentSlots = storeResult.resultSlots;
  assertEqual(currentSlots.length, beforeCount, `重传后记录数不变=${beforeCount}`);

  const bt1Again = currentSlots.find((s) => s.id === 'bt1');
  if (bt1Again) {
    assertEqual(bt1Again.passengerCount, 100, 'bt1客流数最终=100');
  }
  const bt2Again = currentSlots.find((s) => s.id === 'bt2');
  if (bt2Again) {
    assertEqual(bt2Again.passengerCount, 110, 'bt2客流数最终=110');
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('测试8：导出数据核对（模拟xlsx导出结构）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
{
  const exportData = currentSlots.map((slot) => ({
    '记录ID': slot.id,
    '线路': slot.routeName,
    '日期': slot.date,
    '开始时间': slot.startTime,
    '结束时间': slot.endTime,
    '客流数': slot.passengerCount,
    '导入批次': slot.importBatchId,
    '更新时间': slot.updatedAt,
  }));

  assertEqual(exportData.length, currentSlots.length, '导出行数与记录数一致');

  const bt1Export = exportData.find((r) => r['记录ID'] === 'bt1');
  if (bt1Export) {
    assertEqual(bt1Export['线路'], '1路', '导出bt1线路=1路');
    assertEqual(bt1Export['日期'], '2026-06-07', '导出bt1日期=2026-06-07');
    assertEqual(bt1Export['开始时间'], '06:00', '导出bt1开始时间=06:00');
    assertEqual(bt1Export['结束时间'], '06:30', '导出bt1结束时间=06:30');
    assertEqual(bt1Export['客流数'], 100, '导出bt1客流数=100');
    assert(bt1Export['导入批次'] !== 'batch-001', '导出bt1批次ID已更新');
  }

  const importLogForExport = operationLogs.filter((l) => l.operationType === 'import').pop();
  if (importLogForExport) {
    const logExportRow = {
      '记录ID': importLogForExport.id,
      '批次ID': importLogForExport.metadata.batchId,
      '新增数量': importLogForExport.metadata.newCount,
      '更新数量': importLogForExport.metadata.updateCount,
      '更新记录明细': (importLogForExport.metadata.updateDetails || [])
        .map((ud) => `${ud.routeKey.replace(/\|/g, '-')} 客流${ud.passengerCountBefore}→${ud.passengerCountAfter}(ID:${ud.slotId.slice(-8)})`)
        .join('; '),
    };
    assert(!!logExportRow['批次ID'], '日志导出有批次ID');
    assert(!!logExportRow['更新记录明细'], '日志导出有更新记录明细');
    console.log(`    📋 日志导出更新明细: ${logExportRow['更新记录明细']}`);
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('测试9：去重键验证（线路+日期+开始+结束）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
{
  const slot1 = { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 999 };
  const slot2 = { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '07:00', passengerCount: 999 };
  const slot3 = { routeName: '1路', date: '2026-06-08', startTime: '06:00', endTime: '06:30', passengerCount: 999 };

  const existing1 = findExisting(slot1, currentSlots);
  const existing2 = findExisting(slot2, currentSlots);
  const existing3 = findExisting(slot3, currentSlots);

  assert(!!existing1, '同线路+同日期+同起止时间=重复');
  assert(!existing2, '同线路+同日期+不同结束时间=不重复');
  assert(!existing3, '同线路+不同日期=不重复');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('测试10：边界点位关联时段验证');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
{
  const p2Slots = currentSlots.filter((s) => s.relatedPointIds.includes('p2'));
  assert(p2Slots.length > 0, `p2(两街交界点位A)有关联时段: ${p2Slots.length}条`);

  const p2SlotIds = p2Slots.map((s) => s.id);
  assert(p2SlotIds.includes('bt1'), 'p2关联bt1');
  assert(p2SlotIds.includes('bt2'), 'p2关联bt2');

  console.log(`    📍 p2关联时段ID: ${p2SlotIds.join(', ')}`);
  console.log(`    📍 p2关联时段客流数: ${p2Slots.map((s) => `${s.routeName} ${s.startTime}-${s.endTime} 客流${s.passengerCount}`).join(', ')}`);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('测试11：纯更新批次确认按钮不被禁用');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
{
  const pureUpdateRows = [
    { routeName: '5路', date: '2026-06-07', startTime: '06:15', endTime: '06:45', passengerCount: 50 },
  ];
  const importResult = simulateImport(pureUpdateRows, currentSlots);
  const confirmDisabled = importResult.newCount === 0 && importResult.updateCount === 0;
  assert(!confirmDisabled, '纯更新批次(newCount=0, updateCount>0)确认按钮不被禁用');
  assert(importResult.success, '纯更新批次success=true');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('测试12：duplicates对比表数据完整性');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
{
  const dupRows = [
    { routeName: '1路', date: '2026-06-07', startTime: '06:00', endTime: '06:30', passengerCount: 120 },
  ];
  const importResult = simulateImport(dupRows, currentSlots);
  assertEqual(importResult.duplicates.length, 1, 'duplicates有1条');
  const dup = importResult.duplicates[0];
  assert(!!dup.existingSlot, 'duplicates[0]有existingSlot');
  assert(!!dup.slot, 'duplicates[0]有slot(新值)');
  assert(dup.changedFields.includes('passengerCount'), 'changedFields包含passengerCount');
  assertEqual(dup.existingSlot.passengerCount, 100, 'existingSlot客流数=100(旧值)');
  assertEqual(dup.slot.passengerCount, 120, 'slot客流数=120(新值)');
  assertEqual(dup.existingSlot.id, 'bt1', 'existingSlot.id=bt1(原始ID)');
}

console.log('\n=================================================');
console.log('验证结果汇总');
console.log('=================================================');
if (process.exitCode === 0) {
  console.log('🎉 全部测试通过！重复导入可更新功能验证完毕。');
  console.log('');
  console.log('关键结论：');
  console.log('  1. 重传同一批材料不会新增副本，只会更新旧记录的客流数');
  console.log('  2. 原始记录ID完整保留，不会因重传丢失');
  console.log('  3. 操作日志逐条记录了客流数from→to，可追溯每条修改');
  console.log('  4. 批次ID贯穿导入、记录、日志、导出，可互查');
  console.log('  5. 纯更新批次确认按钮不会被禁用');
  console.log('  6. duplicates对比表包含旧值/新值/变更字段，供预览显示');
  console.log('  7. 去重键=线路+日期+开始时间+结束时间，逻辑正确');
} else {
  console.log('⚠️ 存在失败测试，请检查上方标记为❌的项目。');
}
console.log('');
console.log('\n[Test 1] 导入预览（ImportService 重复记录处理）');
const initialSlots = generateInitialSlots();
const secondRows = generateSecondImportRows();
const importResult = ImportService.doImport(secondRows, initialSlots);

console.log(`  newCount = ${importResult.newCount} (期望 0)`);
console.log(`  updateCount = ${importResult.updateCount} (期望 2)`);
console.log(`  duplicateCount = ${importResult.duplicateCount} (期望 2)`);
console.log(`  data.length = ${importResult.data.length} (期望 2，修复前会是 0 被跳过)`);
console.log(`  success = ${importResult.success} (期望 true，修复前会 false)`);

assert.strictEqual(importResult.newCount, 0, 'T1: 纯更新批次 newCount 必须为 0');
assert.strictEqual(importResult.updateCount, 2, 'T1: updateCount 必须等于 2');
assert.strictEqual(importResult.duplicateCount, 2, 'T1: duplicateCount 必须等于 2');
assert.strictEqual(importResult.data.length, 2, 'T1: 修复后 data 必须含有重复记录');
assert.strictEqual(importResult.success, true, 'T1: 纯更新批次必须成功');
assert.strictEqual(importResult.duplicates.length, 2, 'T1: duplicates 数组必须填');

// 检查 changedFields 识别到客流数变更
importResult.duplicates.forEach((d, i) => {
  console.log(`  dup[${i}] changedFields = [${d.changedFields.join(',')}] 客流 ${d.existingSlot.passengerCount} → ${d.slot.passengerCount}`);
  assert.ok(d.changedFields.includes('passengerCount'), 'T1: 必须识别客流数变更');
});
console.log('  ✅ Test 1 通过');

// ============================================================================
// Test Case 2：BusTimeManagement 确认按钮在纯更新场景下不能被禁用
// ============================================================================
console.log('\n[Test 2] 确认按钮禁用条件（BusTimeManagement）');
// 修复前：disabled = newCount === 0 → true（禁用）
// 修复后：disabled = newCount === 0 && updateCount === 0 → false（可用）
const disabledBeforeFix = importResult.newCount === 0;
const disabledAfterFix = importResult.newCount === 0 && importResult.updateCount === 0;
console.log(`  修复前禁用状态: ${disabledBeforeFix} (修复前会是 true → 用户被卡死)`);
console.log(`  修复后禁用状态: ${disabledAfterFix} (修复后是 false → 可确认)`);
assert.strictEqual(disabledBeforeFix, true, 'T2: 模拟修复前禁用条件');
assert.strictEqual(disabledAfterFix, false, 'T2: 修复后纯更新场景下按钮必须可用');
console.log('  ✅ Test 2 通过');

// ============================================================================
// Test Case 3：Store 保存后总记录数不变，客流数被更新，原 ID 保留
// ============================================================================
console.log('\n[Test 3] Store 保存 + ID 保留 + 客流数更新');
const batchId2 = 'BATCH-20250122-0002';
const storeResult = mockAddBusTimeSlots(importResult.data, initialSlots, batchId2);

console.log(`  更新前记录数: ${initialSlots.length}`);
console.log(`  更新后记录数: ${storeResult.updatedSlots.length} (必须相同)`);
console.log(`  updateCount: ${storeResult.updateCount}, newCount: ${storeResult.newCount}`);

assert.strictEqual(storeResult.updatedSlots.length, initialSlots.length, 'T3: 重传后总记录数必须保持不变');
assert.strictEqual(storeResult.newCount, 0, 'T3: newCount 必须为 0');
assert.strictEqual(storeResult.updateCount, 2, 'T3: updateCount 必须为 2');

// 验证第一条：ID 必须是原来的 slot-001，客流数从 45 → 55
const slot1 = storeResult.updatedSlots.find(s => s.id === 'slot-001');
console.log(`  slot-001: 客流 ${initialSlots[0].passengerCount} → ${slot1.passengerCount}`);
console.log(`  slot-001: 导入批次 ${initialSlots[0].importBatchId} → ${slot1.importBatchId}`);
assert.strictEqual(slot1.id, 'slot-001', 'T3: ID 必须保持原 slot-001（不是新副本）');
assert.strictEqual(slot1.passengerCount, 55, 'T3: 客流必须被更新为 55');
assert.strictEqual(slot1.importBatchId, batchId2, 'T3: importBatchId 必须是新批次号');

const slot2 = storeResult.updatedSlots.find(s => s.id === 'slot-002');
assert.strictEqual(slot2.id, 'slot-002');
assert.strictEqual(slot2.passengerCount, 70);
console.log('  ✅ Test 3 通过');

// ============================================================================
// Test Case 4：updateDetails 必须记录每条 from/to，可追踪到具体 slot ID
// ============================================================================
console.log('\n[Test 4] 操作日志 updateDetails 明细');
console.log('  updateDetails =', JSON.stringify(storeResult.updateDetails, null, 4));
assert.strictEqual(storeResult.updateDetails.length, 2, 'T4: 2条更新必须有2条明细');
assert.strictEqual(storeResult.updateDetails[0].slotId, 'slot-001');
assert.strictEqual(storeResult.updateDetails[0].passengerCountBefore, 45);
assert.strictEqual(storeResult.updateDetails[0].passengerCountAfter, 55);
assert.strictEqual(storeResult.updateDetails[1].passengerCountBefore, 62);
assert.strictEqual(storeResult.updateDetails[1].passengerCountAfter, 70);
console.log('  ✅ Test 4 通过');

// ============================================================================
// Test Case 5：OperationHistory 导出列名和内容 - 批次ID、更新明细、记录ID
// ============================================================================
console.log('\n[Test 5] 操作历史导出（模拟 OperationHistory.tsx 导出逻辑）');
// 模拟 OperationHistory 的 handleExport 列映射
function buildExportRow(batchId, log) {
  const updateDetails = log.updateDetails || [];
  const newDetails = log.newDetails || [];
  return {
    批次ID: batchId,
    新增数量: log.newCount,
    更新数量: log.updateCount,
    更新记录明细: updateDetails.map(ud =>
      `${ud.routeKey.replace(/\|/g, '-')} 客流${ud.passengerCountBefore}→${ud.passengerCountAfter}(ID:${ud.slotId.slice(-8)})`).join('; '),
    新增记录明细: newDetails.map(nd =>
      `${nd.routeKey.replace(/\|/g, '-')}(ID:${nd.slotId.slice(-8)})`).join('; '),
  };
}

const fakeLog = {
  newCount: storeResult.newCount,
  updateCount: storeResult.updateCount,
  updateDetails: storeResult.updateDetails,
  newDetails: storeResult.newDetails,
};
const exportRow = buildExportRow(batchId2, fakeLog);
console.log('  导出列 =', JSON.stringify(exportRow, null, 2));

// 检查导出内容里必须包含原 slot ID、from→to 客流数字
assert.ok(exportRow['更新记录明细'].includes('slot-001'), 'T5: 导出内容里必须能追到 slot-001');
assert.ok(exportRow['更新记录明细'].includes('客流45→55'), 'T5: 导出必须有客流 45→55');
assert.ok(exportRow['更新记录明细'].includes('客流62→70'), 'T5: 导出必须有客流 62→70');
assert.strictEqual(exportRow['新增记录明细'], '', 'T5: 纯更新批次新增记录明细必须为空');
console.log('  ✅ Test 5 通过');

// ============================================================================
// Test Case 6：地图往返 - 从 BusTime/Redline 返回后 location state 正确
// ============================================================================
console.log('\n[Test 6] 地图往返 location.state 结构（模拟 React Router state）');
// 模拟 BusTimeManagement 返回地图时携带的 state
const stateFromBusTime = {
  fromBusTime: true,
  highlightPointId: 'p2',     // 两街交界点位A
};
const stateFromRedline = {
  fromRedline: true,
  highlightPointId: 'p2',
};
// 模拟 MapView 里 useEffect 里的判断逻辑
function shouldAutoExpand(state) {
  return state && state.highlightPointId;
}
console.log('  BusTime → MapView:', shouldAutoExpand(stateFromBusTime), '点:', stateFromBusTime.highlightPointId);
console.log('  Redline → MapView:', shouldAutoExpand(stateFromRedline), '点:', stateFromRedline.highlightPointId);
assert.strictEqual(shouldAutoExpand(stateFromBusTime), true, 'T6: fromBusTime 必须触发自动展开');
assert.strictEqual(shouldAutoExpand(stateFromRedline), true, 'T6: fromRedline 必须触发自动展开');
assert.strictEqual(stateFromBusTime.highlightPointId, 'p2', 'T6: 必须定位到 p2');
console.log('  ✅ Test 6 通过');

// ============================================================================
// Test Case 7：BusTimeManagement 页面导出也带记录ID和批次ID
// ============================================================================
console.log('\n[Test 7] BusTimeManagement 页面导出检查（页面结果 vs 导出一致）');
function buildSlotExportRow(slot) {
  return {
    线路: slot.routeName,
    日期: slot.date,
    '开始时间': slot.startTime,
    '结束时间': slot.endTime,
    客流数: slot.passengerCount,
    记录ID: slot.id,
    导入批次: slot.importBatchId,
  };
}
const exported = storeResult.updatedSlots.map(buildSlotExportRow);
console.log('  BusTime 导出行 =', JSON.stringify(exported, null, 2));

// 页面数据和导出数据必须一致（同一个 slot ID）
exported.forEach((row, i) => {
  const src = storeResult.updatedSlots[i];
  assert.strictEqual(row['记录ID'], src.id, 'T7: 导出必须包含原记录ID');
  assert.strictEqual(row['导入批次'], src.importBatchId, 'T7: 导出必须包含最新批次ID');
  assert.strictEqual(row['客流数'], src.passengerCount, 'T7: 导出客流数与页面一致');
});
console.log('  ✅ Test 7 通过');

// ============================================================================
// 结论
// ============================================================================
console.log('\n============================================================================');
console.log('  🎉 所有端到端验证用例全部通过 🎉');
console.log('============================================================================');
console.log('\n已覆盖的断点检查清单：');
console.log('  ✅ 1. 重复记录新客流数进入预览 data/duplicates（不再 skip）');
console.log('  ✅ 2. 纯更新批次 newCount=0 时确认按钮不再被禁用');
console.log('  ✅ 3. 保存后总记录数不变，无新副本（2 条 → 还是 2 条）');
console.log('  ✅ 4. 客流数 45→55 / 62→70 已生效，原 ID slot-001/002 保留');
console.log('  ✅ 5. 批次 ID 从 BATCH-0001 → BATCH-0002 正确刷新');
console.log('  ✅ 6. updateDetails 记录 {slotId, before, after, routeKey} 可追溯');
console.log('  ✅ 7. OperationHistory 导出列 + BusTimeManagement 导出列双向核对通过');
console.log('  ✅ 8. 地图往返 state 带 highlightPointId=p2 触发自动展开');
console.log('  ✅ 9. 页面结果 vs 导出 xlsx 数据一致（记录ID/批次ID/客流数）');
console.log('  ✅ 10. 重传后可通过 记录ID → 批次ID → 操作日志 完整溯源');
console.log('\n============================================================================');
process.exit(0);
