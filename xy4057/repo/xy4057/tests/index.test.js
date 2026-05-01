const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('assert');
const { setupTestDatabase, cleanupTestDatabase, TEST_DB_PATH } = require('./test-setup');

const db = require('../src/database');
const models = require('../src/models');
const stateMachine = require('../src/stateMachine');
const { validate, schemas, businessRules } = require('../src/validation');
const importExport = require('../src/importExport');

const { v4: uuidv4 } = require('uuid');

let testDb = null;

before(() => {
  testDb = setupTestDatabase();
});

after(() => {
  if (testDb) {
    testDb.close();
  }
  cleanupTestDatabase();
});

describe('状态机测试', () => {
  test('应该验证所有状态都有效', () => {
    Object.values(stateMachine.STATUS).forEach(status => {
      assert.strictEqual(stateMachine.isValidStatus(status), true);
    });
    assert.strictEqual(stateMachine.isValidStatus('INVALID_STATUS'), false);
  });

  test('应该验证状态流转规则', () => {
    assert.strictEqual(
      stateMachine.canTransition(stateMachine.STATUS.PENDING_CLEANING, stateMachine.STATUS.PENDING_ASSEMBLY),
      true
    );
    assert.strictEqual(
      stateMachine.canTransition(stateMachine.STATUS.PENDING_CLEANING, stateMachine.STATUS.RELEASED),
      false
    );
    assert.strictEqual(
      stateMachine.canTransition(stateMachine.STATUS.RELEASED, stateMachine.STATUS.USED),
      true
    );
    assert.strictEqual(
      stateMachine.canTransition(stateMachine.STATUS.RELEASED, stateMachine.STATUS.RECALLED),
      true
    );
  });

  test('应该返回正确的状态标签', () => {
    assert.strictEqual(stateMachine.getStatusLabel(stateMachine.STATUS.PENDING_CLEANING), '待清洗');
    assert.strictEqual(stateMachine.getStatusLabel(stateMachine.STATUS.RELEASED), '已放行');
    assert.strictEqual(stateMachine.getStatusLabel(stateMachine.STATUS.RECALLED), '已召回');
  });
});

describe('数据模型测试', () => {
  test('应该创建和获取器械包', () => {
    const packageData = {
      package_number: `TEST-PKG-${Date.now()}`,
      name: '测试手术器械包',
      description: '用于测试的器械包',
      instruments: ['手术刀', '镊子', '止血钳']
    };

    const created = models.packages.create(packageData);
    assert.ok(created.id);
    assert.strictEqual(created.package_number, packageData.package_number);
    assert.strictEqual(created.current_status, stateMachine.STATUS.PENDING_CLEANING);

    const retrieved = models.packages.getById(created.id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.package_number, packageData.package_number);
    assert.deepStrictEqual(retrieved.instruments, packageData.instruments);
  });

  test('应该创建和获取灭菌锅次', () => {
    const cycleData = {
      cycle_number: `TEST-CYC-${Date.now()}`,
      sterilizer_id: 'STER-001',
      cycle_type: 'HIGH_TEMP',
      target_temperature: 134,
      target_duration: 180
    };

    const created = models.cycles.create(cycleData);
    assert.ok(created.id);
    assert.strictEqual(created.cycle_number, cycleData.cycle_number);
    assert.strictEqual(created.status, 'IN_PROGRESS');

    const retrieved = models.cycles.getById(created.id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.target_temperature, cycleData.target_temperature);
  });

  test('应该创建参数曲线点', () => {
    const cycleData = {
      cycle_number: `TEST-CYC-CURVE-${Date.now()}`,
      sterilizer_id: 'STER-001',
      cycle_type: 'HIGH_TEMP',
      target_temperature: 134,
      target_duration: 180
    };
    const cycle = models.cycles.create(cycleData);

    const curvePoint = {
      timestamp: new Date().toISOString(),
      temperature: 134.5,
      pressure: 200,
      humidity: 50
    };

    const created = models.curves.create(cycle.id, curvePoint);
    assert.ok(created.id);
    assert.strictEqual(created.cycle_id, cycle.id);

    const points = models.curves.getByCycle(cycle.id);
    assert.strictEqual(points.length, 1);
  });

  test('应该创建质检记录', () => {
    const pkg = models.packages.create({
      package_number: `TEST-PKG-QC-${Date.now()}`,
      name: '质检测试包'
    });

    const cycle = models.cycles.create({
      cycle_number: `TEST-CYC-QC-${Date.now()}`,
      sterilizer_id: 'STER-001',
      cycle_type: 'HIGH_TEMP',
      target_temperature: 134,
      target_duration: 180
    });

    const qcData = {
      cycle_id: cycle.id,
      package_id: pkg.id,
      check_type: 'BIOLOGICAL',
      result: 'PASS',
      notes: '测试质检记录',
      checked_by: '测试人员'
    };

    const created = models.qualityChecks.create(qcData);
    assert.ok(created.id);
    assert.strictEqual(created.result, 'PASS');
  });
});

describe('业务规则校验测试', () => {
  test('应该验证召回缺少原因', async () => {
    const result = await businessRules.checkRecallReason({ reason: '' });
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, 'MISSING_RECALL_REASON');

    const validResult = await businessRules.checkRecallReason({ reason: '温度曲线异常' });
    assert.strictEqual(validResult.valid, true);
  });

  test('应该验证锅次不合格时无法放行', async () => {
    const pkg = models.packages.create({
      package_number: `TEST-PKG-RELEASE-${Date.now()}`,
      name: '放行测试包'
    });

    const cycle = models.cycles.create({
      cycle_number: `TEST-CYC-RELEASE-${Date.now()}`,
      sterilizer_id: 'STER-001',
      cycle_type: 'HIGH_TEMP',
      target_temperature: 134,
      target_duration: 180
    });

    const result = await businessRules.canReleasePackage(pkg.id, cycle.id);
    assert.strictEqual(result.valid, false);
    
    const errors = result.errors.map(e => e.code);
    assert.ok(errors.includes('CYCLE_NOT_COMPLETED'));
  });

  test('应该验证重复领用', async () => {
    const pkg = models.packages.create({
      package_number: `TEST-PKG-USAGE-${Date.now()}`,
      name: '领用测试包'
    });

    let result = await businessRules.checkDuplicateUsage(pkg.id);
    assert.strictEqual(result.valid, true);

    models.usage.create({
      package_id: pkg.id,
      department: '外科手术室'
    });

    models.packages.updateStatus(pkg.id, stateMachine.STATUS.USED, {});

    result = await businessRules.checkDuplicateUsage(pkg.id);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.code, 'DUPLICATE_USAGE');
  });
});

describe('导入导出测试', () => {
  test('应该导入CSV器械包数据', async () => {
    const csvContent = `package_number,name,description,instruments
PKG-IMPORT-001,导入测试包1,测试导入功能,手术刀,镊子
PKG-IMPORT-002,导入测试包2,第二个测试包,止血钳,剪刀`;

    const result = await importExport.importCsvPackages(csvContent, '测试用户');
    
    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.success, 2);
    assert.strictEqual(result.failed, 0);
  });

  test('应该导出Markdown追溯报告', () => {
    const pkg = models.packages.create({
      package_number: `TEST-PKG-REPORT-${Date.now()}`,
      name: '报告测试包',
      description: '用于测试报告导出',
      instruments: ['手术刀', '镊子']
    });

    const report = importExport.exportMarkdownReport(pkg.id);
    
    assert.ok(report);
    assert.ok(report.includes('灭菌包追溯报告'));
    assert.ok(report.includes(pkg.name));
    assert.ok(report.includes(pkg.package_number));
  });

  test('应该导出JSON审计包', () => {
    const auditPackage = importExport.exportAuditPackage({});
    
    assert.ok(auditPackage);
    assert.ok(auditPackage.export_time);
    assert.ok(auditPackage.version);
    assert.strictEqual(typeof auditPackage.total_records, 'number');
    assert.ok(Array.isArray(auditPackage.logs));
  });
});

describe('参数校验测试', () => {
  test('应该验证器械包schema', () => {
    const validData = {
      package_number: 'PKG-VALID-001',
      name: '有效测试包',
      instruments: ['手术刀']
    };

    const result = validate(schemas.package, validData);
    assert.strictEqual(result.valid, true);

    const invalidData = {
      name: '缺少包编号'
    };

    const invalidResult = validate(schemas.package, invalidData);
    assert.strictEqual(invalidResult.valid, false);
  });

  test('应该验证锅次schema', () => {
    const validData = {
      cycle_number: 'CYC-VALID-001',
      sterilizer_id: 'STER-001',
      cycle_type: 'HIGH_TEMP',
      target_temperature: 134,
      target_duration: 180
    };

    const result = validate(schemas.cycle, validData);
    assert.strictEqual(result.valid, true);

    const invalidData = {
      cycle_number: 'CYC-INVALID-001',
      cycle_type: 'INVALID_TYPE'
    };

    const invalidResult = validate(schemas.cycle, invalidData);
    assert.strictEqual(invalidResult.valid, false);
  });
});

describe('状态流转拦截测试', () => {
  test('应该拦截无效的状态流转', () => {
    const pkg = models.packages.create({
      package_number: `TEST-PKG-TRANS-${Date.now()}`,
      name: '流转测试包'
    });

    const result = stateMachine.validateTransition(
      pkg,
      stateMachine.STATUS.RELEASED,
      {}
    );

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.code === 'INVALID_TRANSITION'));
  });

  test('应该允许有效的状态流转', () => {
    const pkg = models.packages.create({
      package_number: `TEST-PKG-VALID-TRANS-${Date.now()}`,
      name: '有效流转测试包'
    });

    const result = stateMachine.validateTransition(
      pkg,
      stateMachine.STATUS.PENDING_ASSEMBLY,
      {}
    );

    assert.strictEqual(result.valid, true);
  });
});

describe('审计日志测试', () => {
  test('应该记录审计日志', () => {
    const entityId = uuidv4();
    
    const log = models.audit.log(
      'TEST_ACTION',
      'TEST_ENTITY',
      entityId,
      { test: 'data' },
      '测试用户'
    );

    assert.ok(log.id);
    assert.strictEqual(log.action, 'TEST_ACTION');
    assert.strictEqual(log.entity_type, 'TEST_ENTITY');
    assert.strictEqual(log.entity_id, entityId);
    assert.deepStrictEqual(log.details, { test: 'data' });
  });

  test('应该查询审计日志', () => {
    const entityId = uuidv4();
    
    models.audit.log(
      'QUERY_TEST',
      'QUERY_ENTITY',
      entityId,
      { query: 'test' },
      '查询用户'
    );

    const logs = models.audit.getAll({
      entity_type: 'QUERY_ENTITY',
      entity_id: entityId
    });

    assert.ok(Array.isArray(logs));
    assert.ok(logs.length > 0);
  });
});

describe('参数曲线质量分析测试', () => {
  test('应该分析合格的温度曲线', () => {
    const cycle = models.cycles.create({
      cycle_number: `TEST-CYC-QUALITY-${Date.now()}`,
      sterilizer_id: 'STER-001',
      cycle_type: 'HIGH_TEMP',
      target_temperature: 134,
      target_duration: 180
    });

    const now = new Date();
    const points = [
      { timestamp: new Date(now.getTime() - 60000).toISOString(), temperature: 134.0 },
      { timestamp: new Date(now.getTime() - 30000).toISOString(), temperature: 134.5 },
      { timestamp: now.toISOString(), temperature: 133.8 }
    ];

    points.forEach(p => models.curves.create(cycle.id, p));

    const analysis = models.curves.analyzeQuality(cycle.id, 134, 2);
    assert.strictEqual(analysis.isQualified, true);
  });

  test('应该分析不合格的温度曲线（温度过低）', () => {
    const cycle = models.cycles.create({
      cycle_number: `TEST-CYC-FAIL-${Date.now()}`,
      sterilizer_id: 'STER-001',
      cycle_type: 'HIGH_TEMP',
      target_temperature: 134,
      target_duration: 180
    });

    const now = new Date();
    const points = [
      { timestamp: new Date(now.getTime() - 60000).toISOString(), temperature: 130.0 },
      { timestamp: new Date(now.getTime() - 30000).toISOString(), temperature: 131.0 },
      { timestamp: now.toISOString(), temperature: 130.5 }
    ];

    points.forEach(p => models.curves.create(cycle.id, p));

    const analysis = models.curves.analyzeQuality(cycle.id, 134, 2);
    assert.strictEqual(analysis.isQualified, false);
    assert.ok(analysis.reason.includes('温度低于'));
  });
});

console.log('\n' + '='.repeat(60));
console.log('  测试文件已准备就绪');
console.log('  运行命令: npm test 或 node --test tests/');
console.log('='.repeat(60) + '\n');
