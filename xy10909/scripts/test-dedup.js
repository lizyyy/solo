const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = require('../src/database/db');
const { v4: uuidv4 } = require('uuid');
const accessControlService = require('../src/services/accessControlService');
const gateEventService = require('../src/services/gateEventService');

console.log('=================================');
console.log('重复事件去重功能 - 实际测试');
console.log('=================================\n');

async function cleanTestData() {
  const stmt = db.prepare("DELETE FROM gate_events WHERE event_no LIKE 'TEST-DEDUP-%'");
  await stmt.run();
  console.log('✓ 清理测试数据');
}

async function test1_crossMinuteMatch() {
  console.log('\n【测试1】跨分钟去重 (10:00:59 vs 10:01:02)');
  
  const testId = '110101199001011111';
  const event1 = {
    id: uuidv4(),
    event_no: 'TEST-DEDUP-001',
    person_type: 'employee',
    name: '测试员1',
    id_card: testId,
    gate_no: 'GATE01',
    direction: 'in',
    event_time: '2026-05-23T10:00:59.000Z',
    access_result: 'allowed',
    access_reason: '测试事件1',
    dedup_hash: 'test1'
  };
  
  const insertStmt = db.prepare(`
    INSERT INTO gate_events (id, event_no, person_type, name, id_card, gate_no, direction, event_time, access_result, access_reason, dedup_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  await insertStmt.run(
    event1.id,
    event1.event_no,
    event1.person_type,
    event1.name,
    event1.id_card,
    event1.gate_no,
    event1.direction,
    event1.event_time,
    event1.access_result,
    event1.access_reason,
    event1.dedup_hash
  );
  
  const duplicate = await accessControlService.checkDuplicateEvent(
    testId, 'GATE01', 'in', '2026-05-23T10:01:02.000Z'
  );
  
  if (duplicate) {
    console.log('  ✓ PASS: 10:01:02 的事件正确命中 10:00:59 的重复事件');
    console.log(`    匹配事件: ${duplicate.event_no}`);
    return true;
  } else {
    console.log('  ✗ FAIL: 跨分钟去重未命中');
    return false;
  }
}

async function test2_outsideWindow() {
  console.log('\n【测试2】超过5秒窗口不命中 (10:00:00 vs 10:00:06)');
  
  const testId = '110101199001012222';
  const event1 = {
    id: uuidv4(),
    event_no: 'TEST-DEDUP-002',
    person_type: 'employee',
    name: '测试员2',
    id_card: testId,
    gate_no: 'GATE02',
    direction: 'out',
    event_time: '2026-05-23T10:00:00.000Z',
    access_result: 'allowed',
    access_reason: '测试事件2',
    dedup_hash: 'test2'
  };
  
  const insertStmt = db.prepare(`
    INSERT INTO gate_events (id, event_no, person_type, name, id_card, gate_no, direction, event_time, access_result, access_reason, dedup_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  await insertStmt.run(
    event1.id,
    event1.event_no,
    event1.person_type,
    event1.name,
    event1.id_card,
    event1.gate_no,
    event1.direction,
    event1.event_time,
    event1.access_result,
    event1.access_reason,
    event1.dedup_hash
  );
  
  const duplicate = await accessControlService.checkDuplicateEvent(
    testId, 'GATE02', 'out', '2026-05-23T10:00:06.000Z'
  );
  
  if (!duplicate) {
    console.log('  ✓ PASS: 超过5秒窗口的事件正确不命中');
    return true;
  } else {
    console.log('  ✗ FAIL: 超过5秒窗口错误命中');
    return false;
  }
}

async function test3_differentDirection() {
  console.log('\n【测试3】不同方向不视为重复');
  
  const testId = '110101199001013333';
  const event1 = {
    id: uuidv4(),
    event_no: 'TEST-DEDUP-003',
    person_type: 'employee',
    name: '测试员3',
    id_card: testId,
    gate_no: 'GATE03',
    direction: 'in',
    event_time: '2026-05-23T11:00:00.000Z',
    access_result: 'allowed',
    access_reason: '测试事件3',
    dedup_hash: 'test3'
  };
  
  const insertStmt = db.prepare(`
    INSERT INTO gate_events (id, event_no, person_type, name, id_card, gate_no, direction, event_time, access_result, access_reason, dedup_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  await insertStmt.run(
    event1.id,
    event1.event_no,
    event1.person_type,
    event1.name,
    event1.id_card,
    event1.gate_no,
    event1.direction,
    event1.event_time,
    event1.access_result,
    event1.access_reason,
    event1.dedup_hash
  );
  
  const duplicate = await accessControlService.checkDuplicateEvent(
    testId, 'GATE03', 'out', '2026-05-23T11:00:02.000Z'
  );
  
  if (!duplicate) {
    console.log('  ✓ PASS: 不同方向正确不视为重复');
    return true;
  } else {
    console.log('  ✗ FAIL: 不同方向错误命中');
    return false;
  }
}

async function test4_noInsertOnDuplicate() {
  console.log('\n【测试4】检测到重复时不插入新记录');
  
  const testId = '110101199001014444';
  const event1 = {
    id: uuidv4(),
    event_no: 'TEST-DEDUP-004',
    person_type: 'employee',
    name: '测试员4',
    id_card: testId,
    gate_no: 'GATE04',
    direction: 'in',
    event_time: '2026-05-23T12:00:00.000Z',
    access_result: 'allowed',
    access_reason: '测试事件4',
    dedup_hash: 'test4'
  };
  
  const insertStmt = db.prepare(`
    INSERT INTO gate_events (id, event_no, person_type, name, id_card, gate_no, direction, event_time, access_result, access_reason, dedup_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  await insertStmt.run(
    event1.id,
    event1.event_no,
    event1.person_type,
    event1.name,
    event1.id_card,
    event1.gate_no,
    event1.direction,
    event1.event_time,
    event1.access_result,
    event1.access_reason,
    event1.dedup_hash
  );
  
  const countStmt = db.prepare("SELECT COUNT(*) as cnt FROM gate_events WHERE id_card = ?");
  const countBefore = (await countStmt.get(testId)).cnt;
  
  const result = await gateEventService.createEvent({
    personnel_id: uuidv4(),
    person_type: 'employee',
    name: '测试员4',
    id_card: testId,
    gate_no: 'GATE04',
    direction: 'in',
    event_time: '2026-05-23T12:00:03.000Z'
  });
  
  const countAfter = (await countStmt.get(testId)).cnt;
  
  let pass = true;
  if (result.is_duplicate) {
    console.log('  ✓ PASS: 正确返回 is_duplicate=true');
  } else {
    console.log('  ✗ FAIL: 未返回 is_duplicate=true');
    pass = false;
  }
  
  if (countBefore === countAfter) {
    console.log('  ✓ PASS: 数据库记录数未增加，真正去重');
  } else {
    console.log(`  ✗ FAIL: 数据库记录从 ${countBefore} 增加到 ${countAfter}，未真正去重`);
    pass = false;
  }
  
  if (result.original_event && result.original_event.id === event1.id) {
    console.log('  ✓ PASS: 正确返回原始事件引用');
  } else {
    console.log('  ✗ FAIL: 未正确返回原始事件引用');
    pass = false;
  }
  
  return pass;
}

async function runAllTests() {
  await cleanTestData();
  
  const results = [];
  results.push(await test1_crossMinuteMatch());
  results.push(await test2_outsideWindow());
  results.push(await test3_differentDirection());
  results.push(await test4_noInsertOnDuplicate());
  
  console.log('\n=================================');
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  if (passed === total) {
    console.log(`✓ 全部 ${total} 个测试通过！`);
    console.log('=================================');
    console.log('\n核心去重功能验证:');
    console.log('  ✓ 跨分钟5秒内事件正确去重');
    console.log('  ✓ 超过5秒窗口事件正确不命中');
    console.log('  ✓ 不同方向不视为重复');
    console.log('  ✓ 检测到重复时不插入新记录，真正去重');
    console.log('  ✓ 返回 is_duplicate 标记和原始事件引用');
    process.exit(0);
  } else {
    console.log(`✗ ${total - passed}/${total} 个测试失败`);
    console.log('=================================');
    process.exit(1);
  }
}

(async () => {
  await runAllTests();
  await db.close();
})();
