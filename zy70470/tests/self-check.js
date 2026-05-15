const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🔍 开始器熔断手册自检程序...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   错误: ${error.message}`);
    failed++;
  }
}

function ensureFileExists(filepath) {
  try {
    fs.accessSync(filepath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

console.log('📁 1. 项目文件结构检查\n');

test('package.json 存在', () => {
  assert.strictEqual(ensureFileExists(path.join(__dirname, '..', 'package.json')), true);
});

test('入口文件 src/index.js 存在', () => {
  assert.strictEqual(ensureFileExists(path.join(__dirname, '..', 'src', 'index.js')), true);
});

test('数据模型 CircuitBreakerRecord.js 存在', () => {
  assert.strictEqual(ensureFileExists(path.join(__dirname, '..', 'src', 'models', 'CircuitBreakerRecord.js')), true);
});

test('数据存储 Store.js 存在', () => {
  assert.strictEqual(ensureFileExists(path.join(__dirname, '..', 'src', 'models', 'Store.js')), true);
});

test('样例数据 sample-data.js 存在', () => {
  assert.strictEqual(ensureFileExists(path.join(__dirname, '..', 'src', 'data', 'sample-data.js')), true);
});

test('输出格式化服务 OutputFormatter.js 存在', () => {
  assert.strictEqual(ensureFileExists(path.join(__dirname, '..', 'src', 'services', 'OutputFormatter.js')), true);
});

test('路由文件 index.js 存在', () => {
  assert.strictEqual(ensureFileExists(path.join(__dirname, '..', 'src', 'routes', 'index.js')), true);
});

console.log('\n📊 2. 数据模型功能测试\n');

const CircuitBreakerRecord = require('../src/models/CircuitBreakerRecord');

test('创建熔断记录实例', () => {
  const record = new CircuitBreakerRecord({
    title: '测试记录',
    type: 'test',
    description: '这是一条测试记录'
  });
  assert.strictEqual(record.title, '测试记录');
  assert.strictEqual(record.type, 'test');
});

test('自动生成ID', () => {
  const record = new CircuitBreakerRecord({ title: '测试', type: 'test' });
  assert.ok(record.id.startsWith('REC-'));
});

test('添加候选处理动作', () => {
  const record = new CircuitBreakerRecord({ title: '测试', type: 'test' });
  record.addCandidateAction({
    type: 'rollback',
    description: '回滚测试',
    targetResources: ['TEST-001'],
    suggestedBy: 'tester',
    riskLevel: 'low',
    justification: '测试用'
  });
  assert.strictEqual(record.candidateActions.length, 1);
  assert.ok(record.candidateActions[0].id.startsWith('ACT-'));
});

test('添加人工修正记录', () => {
  const record = new CircuitBreakerRecord({ title: '测试', type: 'test' });
  record.addManualCorrection({
    fieldPath: 'status',
    oldValue: 'pending',
    newValue: 'resolved',
    correctedBy: 'admin@test.com',
    reason: '测试修正',
    sourceEvidence: 'TEST-EVID-001'
  });
  assert.strictEqual(record.manualCorrections.length, 1);
  assert.ok(record.fieldMetadata['status']);
});

test('转换为JSON', () => {
  const record = new CircuitBreakerRecord({ title: '测试', type: 'test' });
  const json = record.toJSON();
  assert.strictEqual(json.title, '测试');
  assert.ok(json.id);
});

console.log('\n💾 3. 数据存储功能测试\n');

const store = require('../src/models/Store');

test('初始化样例数据', () => {
  const records = store.getAllRecords();
  assert.strictEqual(records.length, 3);
});

test('获取所有记录', () => {
  const records = store.getAllRecords();
  assert.ok(Array.isArray(records));
  assert.strictEqual(records.length, 3);
});

test('按ID获取记录', () => {
  const record = store.getRecordById('REC-20240515-GRAY-001');
  assert.ok(record);
  assert.strictEqual(record.title, '跨天灰度发布备忘-用户中心v2.3.0');
});

test('获取不存在的记录返回null', () => {
  const record = store.getRecordById('NON-EXISTENT');
  assert.strictEqual(record, null);
});

test('包含权限误放大样例', () => {
  const records = store.getAllRecords();
  const permRecord = records.find(r => r.type === 'permission_escalation');
  assert.ok(permRecord);
  assert.strictEqual(permRecord.severity, 'critical');
});

test('包含物业报修单样例', () => {
  const records = store.getAllRecords();
  const facRecord = records.find(r => r.type === 'facility_repair');
  assert.ok(facRecord);
  assert.strictEqual(facRecord.manualCorrections.length, 2);
});

test('创建新记录', () => {
  const newRecord = store.createRecord({
    title: '新增测试记录',
    type: 'test_type',
    description: '测试创建功能'
  });
  assert.ok(newRecord.id);
  assert.strictEqual(newRecord.title, '新增测试记录');
});

test('生成清理/回滚候选清单', () => {
  const cleanupList = store.generateCandidateCleanupList('REC-20240514-PERM-007');
  assert.ok(cleanupList);
  assert.strictEqual(cleanupList.recordId, 'REC-20240514-PERM-007');
  assert.ok(cleanupList.items.length > 0);
  assert.ok(cleanupList.highRiskCount >= 0);
});

test('候选清单包含风险评分', () => {
  const cleanupList = store.generateCandidateCleanupList('REC-20240515-GRAY-001');
  cleanupList.items.forEach(item => {
    assert.ok(typeof item.riskScore === 'number');
    assert.ok(item.riskScore >= 0 && item.riskScore <= 10);
  });
});

test('候选清单标记高风险资源', () => {
  const cleanupList = store.generateCandidateCleanupList('REC-20240514-PERM-007');
  const highRiskItems = cleanupList.items.filter(i => i.riskScore >= 8);
  assert.ok(highRiskItems.length > 0);
});

test('候选清单包含前置条件', () => {
  const cleanupList = store.generateCandidateCleanupList('REC-20240515-GRAY-001');
  const dbItem = cleanupList.items.find(i => i.resourceType === 'database');
  if (dbItem) {
    assert.ok(dbItem.prerequisites.includes('create_snapshot'));
  }
});

console.log('\n📝 4. 输出格式功能测试\n');

const OutputFormatter = require('../src/services/OutputFormatter');

test('JSON格式化输出', () => {
  const records = store.getAllRecords();
  const jsonOutput = OutputFormatter.toJSON(records);
  assert.strictEqual(jsonOutput.count, records.length);
  assert.ok(jsonOutput.generatedAt);
  assert.strictEqual(jsonOutput.version, '1.0');
});

test('Markdown格式化输出', () => {
  const records = store.getAllRecords();
  const mdOutput = OutputFormatter.toMarkdown(records);
  assert.ok(mdOutput.startsWith('# 器熔断手册'));
  assert.ok(mdOutput.includes('跨天灰度发布备忘'));
  assert.ok(mdOutput.includes('权限误放大告警'));
});

test('单条记录Markdown输出', () => {
  const record = store.getRecordById('REC-20240513-FAC-042');
  const mdOutput = OutputFormatter.toMarkdown(record);
  assert.ok(mdOutput.includes('人工修正记录'));
  assert.ok(mdOutput.includes('字段路径'));
  assert.ok(mdOutput.includes('来源证据'));
});

test('生成下载文件名', () => {
  const record = store.getRecordById('REC-20240515-GRAY-001');
  const filename = OutputFormatter.generateDownloadFilename(record, 'md');
  assert.ok(filename.includes('REC-20240515-GRAY-001'));
  assert.ok(filename.endsWith('.md'));
});

console.log('\n🔐 5. 边界情况和安全特性测试\n');

test('人工修正保留字段来源', () => {
  const record = store.getRecordById('REC-20240513-FAC-042');
  assert.ok(record.fieldMetadata['status']);
  assert.ok(record.fieldMetadata['status'].source);
  assert.ok(record.fieldMetadata['status'].justification);
});

test('人工修正不覆盖原值', () => {
  const record = store.getRecordById('REC-20240513-FAC-042');
  const correction = record.manualCorrections[0];
  assert.ok(correction.oldValue);
  assert.ok(correction.newValue);
  assert.notStrictEqual(correction.oldValue, correction.newValue);
});

test('高风险资源需要验证标记', () => {
  const cleanupList = store.generateCandidateCleanupList('REC-20240514-PERM-007');
  cleanupList.items.forEach(item => {
    if (item.riskScore >= 8) {
      assert.strictEqual(item.verificationRequired, true);
    }
  });
});

test('生产环境资源有额外前置条件', () => {
  const cleanupList = store.generateCandidateCleanupList('REC-20240515-GRAY-001');
  const prodItems = cleanupList.items.filter(i => 
    store.getRecordById('REC-20240515-GRAY-001').affectedResources.find(
      r => r.id === i.resourceId && r.environment === 'production'
    )
  );
  prodItems.forEach(item => {
    assert.ok(item.prerequisites.includes('notify_stakeholders'));
    assert.ok(item.prerequisites.includes('backup_current_state'));
  });
});

console.log('\n📋 6. API路由完整性检查\n');

const routes = require('../src/routes/index');

test('路由栈已定义', () => {
  assert.ok(routes.stack);
  assert.ok(routes.stack.length > 0);
});

test('包含records GET路由', () => {
  const route = routes.stack.find(l => 
    l.route && l.route.path === '/records' && l.route.methods.get
  );
  assert.ok(route);
});

test('包含cleanup-list路由', () => {
  const route = routes.stack.find(l => 
    l.route && l.route.path.includes('cleanup-list')
  );
  assert.ok(route);
});

test('包含export路由', () => {
  const route = routes.stack.find(l => 
    l.route && l.route.path.includes('export')
  );
  assert.ok(route);
});

test('包含manual-corrections路由', () => {
  const route = routes.stack.find(l => 
    l.route && l.route.path.includes('manual-corrections')
  );
  assert.ok(route);
});

console.log('\n' + '='.repeat(50));
console.log(`📊 测试结果: 通过 ${passed} 项, 失败 ${failed} 项`);
console.log('='.repeat(50));

if (failed === 0) {
  console.log('\n🎉 所有自检通过！系统功能完整可用。');
  console.log('\n📚 包含的真实样例:');
  console.log('  1. ✅ 跨天灰度发布备忘 - 用户中心v2.3.0会话异常');
  console.log('  2. ✅ 权限误放大告警 - 运营部临时权限升级');
  console.log('  3. ✅ 物业报修单 - 咖啡机状态人工修正');
  console.log('\n🔑 核心特性验证:');
  console.log('  ✅ 清理/回滚候选清单生成');
  console.log('  ✅ 风险评分机制 (0-10分)');
  console.log('  ✅ 高风险资源标记');
  console.log('  ✅ 前置条件检查');
  console.log('  ✅ 人工修正审计痕迹');
  console.log('  ✅ 字段来源跟踪');
  console.log('  ✅ JSON/Markdown多格式输出');
  console.log('  ✅ 文件下载接口');
  process.exit(0);
} else {
  console.log(`\n⚠️  发现 ${failed} 项问题，请检查后重试。`);
  process.exit(1);
}