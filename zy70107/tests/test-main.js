const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const testDbPath = path.join(dataDir, 'test.db');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function cleanTestDb() {
  ensureDataDir();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
}

function runTests() {
  console.log('========================================');
  console.log('渔船出港申报 API 测试套件');
  console.log('========================================\n');

  const tests = [
    { name: '基础数据管理', fn: testBaseDataManagement },
    { name: '出港核验（船员+油料+禁渔区）', fn: testDeclarationValidation },
    { name: '完整主流程：申报→审核→出港→返港→完成', fn: testFullWorkflow },
    { name: '临时返港→再次出港→最终返港', fn: testTemporaryReturn },
    { name: '人工状态修正及历史追溯', fn: testManualCorrection },
    { name: '状态流转规则校验', fn: testStatusTransition },
    { name: '导出数据一致性', fn: testExportConsistency }
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    cleanTestDb();
    
    process.env.TEST_DB_PATH = testDbPath;
    
    delete require.cache[require.resolve('../src/database')];
    delete require.cache[require.resolve('../src/services/baseDataService')];
    delete require.cache[require.resolve('../src/services/declarationService')];
    
    try {
      test.fn();
      console.log(`✅ 测试通过: ${test.name}`);
      passed++;
    } catch (err) {
      console.log(`❌ 测试失败: ${test.name}`);
      console.log(`   错误: ${err.message}`);
      failed++;
    }
  });

  cleanTestDb();

  console.log('\n========================================');
  console.log(`测试结果: 通过 ${passed} / ${tests.length}, 失败 ${failed}`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

function testBaseDataManagement() {
  const baseDataService = require('../src/services/baseDataService');
  
  const boat = baseDataService.createBoat({
    name: '测试渔船1号',
    registration_number: 'TEST001',
    crew_capacity: 5,
    fuel_tank_capacity: 1000
  });
  assert(boat.id, '渔船创建失败');
  assert.strictEqual(boat.name, '测试渔船1号');
  
  const crew1 = baseDataService.createCrew({
    name: '张三',
    id_card: '110101199001011234',
    certificate_number: 'CERT001'
  });
  assert(crew1.id, '船员创建失败');

  const zone = baseDataService.createNoFishingZone({
    name: '渤海湾禁渔区',
    description: '春季禁渔',
    coordinates: [{ lat: 38.0, lng: 121.0 }]
  });
  assert(zone.id, '禁渔区创建失败');

  const boats = baseDataService.listBoats();
  assert.strictEqual(boats.length, 1);
}

function testDeclarationValidation() {
  const baseDataService = require('../src/services/baseDataService');
  const declarationService = require('../src/services/declarationService');
  
  const boat = baseDataService.createBoat({
    name: '测试渔船2号',
    registration_number: 'TEST002',
    crew_capacity: 3,
    fuel_tank_capacity: 200
  });
  
  const crew1 = baseDataService.createCrew({
    name: '李四',
    id_card: '110101199001011235',
    certificate_number: 'CERT002'
  });
  
  const crew2 = baseDataService.createCrew({
    name: '王五',
    id_card: '110101199001011236',
    certificate_number: 'CERT003'
  });

  assert.throws(() => {
    declarationService.createDeclaration({
      boat_id: boat.id,
      departure_time: '2026-05-11T06:00:00.000Z',
      expected_return_time: '2026-05-12T18:00:00.000Z',
      fuel_amount: 300
    });
  }, /超过油箱容量/);

  assert.throws(() => {
    declarationService.createDeclaration({
      boat_id: boat.id,
      departure_time: '2026-05-12T18:00:00.000Z',
      expected_return_time: '2026-05-12T18:00:00.000Z',
      fuel_amount: -1
    });
  }, /大于0/);

  const decl = declarationService.createDeclaration({
    boat_id: boat.id,
    departure_time: '2026-05-11T06:00:00.000Z',
    expected_return_time: '2026-05-12T18:00:00.000Z',
    fuel_amount: 150,
    crew_ids: [crew1.id, crew2.id]
  });
  
  assert(decl.id, '申报创建失败');
  assert.strictEqual(decl.status, 'pending');
  assert.strictEqual(decl.crew.length, 2);
  const crewNames = decl.crew.map(c => c.name);
  assert(crewNames.includes('李四'), '船员列表应包含李四');
  assert(crewNames.includes('王五'), '船员列表应包含王五');
}

function testFullWorkflow() {
  const baseDataService = require('../src/services/baseDataService');
  const declarationService = require('../src/services/declarationService');
  
  const boat = baseDataService.createBoat({
    name: '测试渔船3号',
    registration_number: 'TEST003',
    crew_capacity: 5,
    fuel_tank_capacity: 500
  });
  
  const crew1 = baseDataService.createCrew({
    name: '赵六',
    id_card: '110101199001011237',
    certificate_number: 'CERT004'
  });
  
  const decl = declarationService.createDeclaration({
    boat_id: boat.id,
    departure_time: '2026-05-11T06:00:00.000Z',
    expected_return_time: '2026-05-12T18:00:00.000Z',
    fuel_amount: 300,
    crew_ids: [crew1.id]
  });
  
  const approved = declarationService.approveDeclaration(decl.id);
  assert.strictEqual(approved.status, 'approved');
  
  const atSea = declarationService.recordDeparture(decl.id);
  assert.strictEqual(atSea.status, 'out_at_sea');
  assert.strictEqual(atSea.fuel_records.length, 1);
  
  const returned = declarationService.recordReturn(decl.id, {
    actual_return_time: '2026-05-12T16:00:00.000Z',
    return_reason: '渔获满载',
    is_temporary: false
  });
  assert.strictEqual(returned.status, 'returned');
  assert.strictEqual(returned.return_receipts.length, 1);
  
  const completed = declarationService.completeDeclaration(decl.id);
  assert.strictEqual(completed.status, 'completed');
  
  const history = completed.status_history;
  assert(history.length >= 5, '状态历史记录不完整');
  assert(history.some(h => h.change_reason === '创建申报'));
  assert(history.some(h => h.change_reason === '审核通过'));
  assert(history.some(h => h.change_reason === '已出港'));
  assert(history.some(h => h.change_reason === '已返港'));
  assert(history.some(h => h.change_reason === '申报完成'));
}

function testTemporaryReturn() {
  const baseDataService = require('../src/services/baseDataService');
  const declarationService = require('../src/services/declarationService');
  
  const boat = baseDataService.createBoat({
    name: '测试渔船4号',
    registration_number: 'TEST004',
    crew_capacity: 5,
    fuel_tank_capacity: 500
  });
  
  const decl = declarationService.createDeclaration({
    boat_id: boat.id,
    departure_time: '2026-05-11T06:00:00.000Z',
    expected_return_time: '2026-05-12T18:00:00.000Z',
    fuel_amount: 300
  });
  
  declarationService.approveDeclaration(decl.id);
  declarationService.recordDeparture(decl.id);
  
  const tempReturn = declarationService.recordReturn(decl.id, {
    actual_return_time: '2026-05-11T14:00:00.000Z',
    return_reason: '补充物资',
    is_temporary: true
  });
  assert.strictEqual(tempReturn.status, 'temporary_return');
  
  const reDeparture = declarationService.recordReDeparture(decl.id);
  assert.strictEqual(reDeparture.status, 'out_at_sea_again');
  
  const finalReturn = declarationService.recordReturn(decl.id, {
    actual_return_time: '2026-05-12T17:00:00.000Z',
    return_reason: '渔获完成',
    is_temporary: false
  });
  assert.strictEqual(finalReturn.status, 'returned');
  
  const history = finalReturn.status_history;
  assert(history.some(h => h.change_reason === '临时返港'));
  assert(history.some(h => h.change_reason === '再次出港'));
}

function testManualCorrection() {
  const baseDataService = require('../src/services/baseDataService');
  const declarationService = require('../src/services/declarationService');
  
  const boat = baseDataService.createBoat({
    name: '测试渔船5号',
    registration_number: 'TEST005',
    crew_capacity: 5,
    fuel_tank_capacity: 500
  });
  
  const decl = declarationService.createDeclaration({
    boat_id: boat.id,
    departure_time: '2026-05-11T06:00:00.000Z',
    expected_return_time: '2026-05-12T18:00:00.000Z',
    fuel_amount: 300
  });
  
  declarationService.approveDeclaration(decl.id);
  declarationService.recordDeparture(decl.id);
  
  const corrected = declarationService.manualCorrectStatus(
    decl.id,
    'temporary_return',
    '执法人员A',
    '误操作修正：实际已临时返港'
  );
  
  assert.strictEqual(corrected.status, 'temporary_return');
  
  const history = corrected.status_history;
  const correctionRecord = history.find(h => h.change_type === 'manual_correction');
  assert(correctionRecord, '人工修正记录不存在');
  assert.strictEqual(correctionRecord.changed_by, '执法人员A');
  assert.strictEqual(correctionRecord.change_reason, '误操作修正：实际已临时返港');
  assert.strictEqual(correctionRecord.old_status, 'out_at_sea');
  assert.strictEqual(correctionRecord.new_status, 'temporary_return');
  
  const stats = declarationService.getStatistics();
  assert.strictEqual(stats.manually_corrected_count, 1);
}

function testStatusTransition() {
  const baseDataService = require('../src/services/baseDataService');
  const declarationService = require('../src/services/declarationService');
  
  const boat = baseDataService.createBoat({
    name: '测试渔船6号',
    registration_number: 'TEST006',
    crew_capacity: 5,
    fuel_tank_capacity: 500
  });
  
  const decl = declarationService.createDeclaration({
    boat_id: boat.id,
    departure_time: '2026-05-12T18:00:00.000Z',
    expected_return_time: '2026-05-12T18:00:00.000Z',
    fuel_amount: 300
  });
  
  assert.throws(() => {
    declarationService.recordDeparture(decl.id);
  }, /不允许变更为/);
  
  declarationService.approveDeclaration(decl.id);
  declarationService.recordDeparture(decl.id);
  declarationService.recordReturn(decl.id, {
    actual_return_time: '2026-05-12T18:00:00.000Z',
    return_reason: '完成',
    is_temporary: false
  });
  declarationService.completeDeclaration(decl.id);
  
  assert.throws(() => {
    declarationService.manualCorrectStatus(decl.id, 'completed', '管理员', '测试');
  }, /新状态与当前状态相同/);
}

function testExportConsistency() {
  const baseDataService = require('../src/services/baseDataService');
  const declarationService = require('../src/services/declarationService');
  
  const boat1 = baseDataService.createBoat({
    name: '测试渔船7号',
    registration_number: 'TEST007',
    crew_capacity: 5,
    fuel_tank_capacity: 500
  });
  
  const boat2 = baseDataService.createBoat({
    name: '测试渔船8号',
    registration_number: 'TEST008',
    crew_capacity: 3,
    fuel_tank_capacity: 300
  });
  
  const decl1 = declarationService.createDeclaration({
    boat_id: boat1.id,
    departure_time: '2026-05-11T06:00:00.000Z',
    expected_return_time: '2026-05-12T18:00:00.000Z',
    fuel_amount: 300
  });
  
  const decl2 = declarationService.createDeclaration({
    boat_id: boat2.id,
    departure_time: '2026-05-13T08:00:00.000Z',
    expected_return_time: '2026-05-14T20:00:00.000Z',
    fuel_amount: 200
  });
  
  const exported = declarationService.exportDeclarations();
  
  assert.strictEqual(exported.length, 2);
  assert(exported[0]['申报编号']);
  assert(exported[0]['渔船名称']);
  assert(exported[0]['申报油料']);
  assert(exported[0]['当前状态']);
  
  const filtered = declarationService.exportDeclarations({
    status: 'pending'
  });
  assert.strictEqual(filtered.length, 2);
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
