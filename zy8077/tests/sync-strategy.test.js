const { InspectionModel, SyncQueueItem, SyncLog } = require('../js/models.js');
const { ConflictResolver, Conflict } = require('../js/conflict-strategy.js');
const { MockApiService } = require('../js/mock-api.js');
const { sampleData } = require('../js/sample-data.js');

console.log('=== 离线巡检表同步策略测试 ===\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    console.log(`测试: ${name}`);
    fn();
    console.log('  ✓ 通过\n');
    testsPassed++;
  } catch (error) {
    console.log(`  ✗ 失败: ${error.message}\n`);
    testsFailed++;
  }
}

async function asyncTest(name, fn) {
  try {
    console.log(`测试: ${name}`);
    await fn();
    console.log('  ✓ 通过\n');
    testsPassed++;
  } catch (error) {
    console.log(`  ✗ 失败: ${error.message}\n`);
    testsFailed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

console.log('--- 1. 数据模型测试 ---\n');

test('创建巡检单模型', () => {
  const inspection = new InspectionModel('test_001', {
    deviceId: 'DEV-001',
    deviceName: '测试设备',
    inspector: '测试员'
  });
  assert(inspection.id === 'test_001', 'ID不匹配');
  assert(inspection.deviceId === 'DEV-001', '设备编号不匹配');
  assert(inspection.deviceName === '测试设备', '设备名称不匹配');
  assert(inspection.inspector === '测试员', '巡检员不匹配');
});

test('巡检单序列化与反序列化', () => {
  const original = new InspectionModel('test_002', {
    notes: '测试备注',
    abnormalItems: ['异常1', '异常2'],
    photos: ['photo1']
  });
  const json = original.toJSON();
  const restored = InspectionModel.fromJSON(json);
  assert(restored.notes === original.notes, '备注不匹配');
  assert(restored.abnormalItems.length === original.abnormalItems.length, '异常项数量不匹配');
  assert(restored.photos.length === original.photos.length, '照片数量不匹配');
});

console.log('--- 2. 冲突解决策略测试 ---\n');

test('检测冲突', () => {
  const resolver = new ConflictResolver();
  const local = { id: 'test', notes: '本地备注', version: 1, lastModified: Date.now() };
  const server = { id: 'test', notes: '服务器备注', version: 2, lastModified: Date.now() - 1000 };
  const conflicts = resolver.detectConflicts(local, server);
  assert(conflicts.length === 1, '应该检测到1个冲突');
  assert(conflicts[0].field === 'notes', '冲突字段应该是notes');
});

test('最后写入优先策略 - 本地更新', () => {
  const resolver = new ConflictResolver('last-write-wins');
  const local = { id: 'test', notes: '本地新备注', version: 1, lastModified: Date.now() };
  const server = { id: 'test', notes: '服务器旧备注', version: 2, lastModified: Date.now() - 1000 };
  resolver.conflicts = resolver.detectConflicts(local, server);
  const resolved = resolver.resolveLastWriteWins(local, server, resolver.conflicts);
  assert(resolved.notes === '本地新备注', '应该使用本地数据');
});

test('最后写入优先策略 - 服务器更新', () => {
  const resolver = new ConflictResolver('last-write-wins');
  const local = { id: 'test', notes: '本地旧备注', version: 1, lastModified: Date.now() - 1000 };
  const server = { id: 'test', notes: '服务器新备注', version: 2, lastModified: Date.now() };
  resolver.conflicts = resolver.detectConflicts(local, server);
  const resolved = resolver.resolveLastWriteWins(local, server, resolver.conflicts);
  assert(resolved.notes === '服务器新备注', '应该使用服务器数据');
});

test('本地优先策略', () => {
  const resolver = new ConflictResolver('local-wins');
  const local = { id: 'test', notes: '本地备注', version: 1, lastModified: Date.now() - 1000 };
  const server = { id: 'test', notes: '服务器备注', version: 2, lastModified: Date.now() };
  resolver.conflicts = resolver.detectConflicts(local, server);
  const resolved = resolver.resolveLocalWins(local, server, resolver.conflicts);
  assert(resolved.notes === '本地备注', '应该使用本地数据');
});

test('服务器优先策略', () => {
  const resolver = new ConflictResolver('server-wins');
  const local = { id: 'test', notes: '本地备注', version: 1, lastModified: Date.now() };
  const server = { id: 'test', notes: '服务器备注', version: 2, lastModified: Date.now() - 1000 };
  resolver.conflicts = resolver.detectConflicts(local, server);
  const resolved = resolver.resolveServerWins(local, server, resolver.conflicts);
  assert(resolved.notes === '服务器备注', '应该使用服务器数据');
});

test('多字段冲突检测', () => {
  const resolver = new ConflictResolver();
  const local = { 
    id: 'test', 
    notes: '本地备注', 
    status: 'completed',
    inspector: '张三',
    version: 1, 
    lastModified: Date.now() 
  };
  const server = { 
    id: 'test', 
    notes: '服务器备注', 
    status: 'pending',
    inspector: '李四',
    version: 2, 
    lastModified: Date.now() - 1000 
  };
  const conflicts = resolver.detectConflicts(local, server);
  assert(conflicts.length >= 3, '应该检测到多个冲突');
});

console.log('--- 3. Mock API 服务测试 ---\n');

asyncTest('创建巡检单', async () => {
  const api = new MockApiService();
  api.setLatency(0);
  const inspection = new InspectionModel('api_test_001', { deviceName: 'API测试设备' });
  const created = await api.createInspection(inspection.toJSON());
  assert(created.id === 'api_test_001', 'ID不匹配');
  assert(created.deviceName === 'API测试设备', '设备名称不匹配');
});

asyncTest('获取巡检单', async () => {
  const api = new MockApiService();
  api.setLatency(0);
  const inspection = new InspectionModel('api_test_002', { deviceName: '获取测试' });
  await api.createInspection(inspection.toJSON());
  const fetched = await api.getInspection('api_test_002');
  assert(fetched.deviceName === '获取测试', '设备名称不匹配');
});

asyncTest('更新巡检单', async () => {
  const api = new MockApiService();
  api.setLatency(0);
  const inspection = new InspectionModel('api_test_003', { deviceName: '更新前' });
  await api.createInspection(inspection.toJSON());
  const updated = await api.updateInspection({ id: 'api_test_003', deviceName: '更新后' });
  assert(updated.deviceName === '更新后', '设备名称应该已更新');
  assert(updated.version > 1, '版本号应该递增');
});

asyncTest('删除巡检单', async () => {
  const api = new MockApiService();
  api.setLatency(0);
  const inspection = new InspectionModel('api_test_004', { deviceName: '删除测试' });
  await api.createInspection(inspection.toJSON());
  const result = await api.deleteInspection('api_test_004');
  assert(result.success === true, '删除应该成功');
  try {
    await api.getInspection('api_test_004');
    assert(false, '获取已删除的巡检单应该失败');
  } catch (e) {
    assert(e.status === 404, '应该返回404错误');
  }
});

asyncTest('离线模式操作', async () => {
  const api = new MockApiService();
  api.setLatency(0);
  api.setOnline(false);
  try {
    const inspection = new InspectionModel('api_test_005', { deviceName: '离线测试' });
    await api.createInspection(inspection.toJSON());
    assert(false, '离线模式应该无法创建');
  } catch (e) {
    assert(e.status === 0, '应该返回网络错误');
  }
  api.setOnline(true);
});

test('加载示例数据', () => {
  const api = new MockApiService();
  api.loadSampleData(sampleData);
  const snapshot = api.getSnapshot();
  assert(snapshot.length === 2, '应该有2条示例数据');
  assert(snapshot[0].id === 'inspection_001', '第一条数据ID不匹配');
  assert(snapshot[1].id === 'inspection_002', '第二条数据ID不匹配');
});

console.log('--- 4. 集成测试 ---\n');

asyncTest('完整同步流程 - 创建、更新、冲突解决', async () => {
  const api = new MockApiService();
  api.setLatency(0);
  const resolver = new ConflictResolver('last-write-wins');
  
  const original = new InspectionModel('integration_001', {
    deviceName: '集成测试设备',
    notes: '原始备注',
    version: 1
  });
  
  await api.createInspection(original.toJSON());
  
  const localUpdate = {
    ...original.toJSON(),
    notes: '本地修改的备注',
    lastModified: Date.now(),
    version: 2
  };
  
  const serverUpdate = {
    ...original.toJSON(),
    notes: '服务器修改的备注',
    lastModified: Date.now() - 1000,
    version: 2
  };
  
  await api.updateInspection(serverUpdate);
  
  const conflicts = resolver.detectConflicts(localUpdate, serverUpdate);
  assert(conflicts.length === 1, '应该检测到冲突');
  
  const resolved = resolver.resolveLastWriteWins(localUpdate, serverUpdate, conflicts);
  assert(resolved.notes === '本地修改的备注', '应该使用本地数据（时间更新）');
  
  const finalResult = await api.updateInspection(resolved);
  assert(finalResult.notes === '本地修改的备注', '最终数据应该正确');
});

test('队列项创建', () => {
  const inspection = new InspectionModel('queue_test_001');
  const queueItem = new SyncQueueItem('queue_001', 'update', inspection.toJSON());
  assert(queueItem.id === 'queue_001', '队列项ID不匹配');
  assert(queueItem.action === 'update', '操作类型不匹配');
  assert(queueItem.data.id === 'queue_test_001', '数据ID不匹配');
  assert(queueItem.status === 'pending', '初始状态应该是pending');
});

test('同步日志创建', () => {
  const log = new SyncLog('测试日志消息', 'success');
  assert(log.message === '测试日志消息', '日志消息不匹配');
  assert(log.type === 'success', '日志类型不匹配');
  assert(log.timestamp > 0, '时间戳应该有效');
});

asyncTest('版本控制和递增', async () => {
  const api = new MockApiService();
  api.setLatency(0);
  const inspection = new InspectionModel('version_test_001', { version: 1 });
  const created = await api.createInspection(inspection.toJSON());
  assert(created.version === 1, '初始版本应该是1');
  
  const updated1 = await api.updateInspection({ id: 'version_test_001', notes: '更新1' });
  assert(updated1.version === 2, '第一次更新后版本应该是2');
  
  const updated2 = await api.updateInspection({ id: 'version_test_001', notes: '更新2' });
  assert(updated2.version === 3, '第二次更新后版本应该是3');
});

asyncTest('服务器快照功能', async () => {
  const api = new MockApiService();
  api.setLatency(0);
  
  const inspection1 = new InspectionModel('snapshot_001', { deviceName: '设备1' });
  const inspection2 = new InspectionModel('snapshot_002', { deviceName: '设备2' });
  
  await api.createInspection(inspection1.toJSON());
  await api.createInspection(inspection2.toJSON());
  
  const snapshot = api.getSnapshot();
  assert(snapshot.length === 2, '快照应该包含2条数据');
  assert(snapshot.some(i => i.id === 'snapshot_001'), '应该包含第一条数据');
  assert(snapshot.some(i => i.id === 'snapshot_002'), '应该包含第二条数据');
});

test('冲突对象创建', () => {
  const local = { id: 'test', notes: '本地' };
  const server = { id: 'test', notes: '服务器' };
  const conflict = new Conflict(local, server, 'notes');
  assert(conflict.localData === local, '本地数据不匹配');
  assert(conflict.serverData === server, '服务器数据不匹配');
  assert(conflict.field === 'notes', '字段不匹配');
  assert(conflict.resolved === false, '初始状态应该是未解决');
});

(async function runAllTests() {
  console.log('\n=== 测试结果 ===');
  console.log(`通过: ${testsPassed}`);
  console.log(`失败: ${testsFailed}`);
  console.log(`总计: ${testsPassed + testsFailed}`);

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 所有测试通过！');
  }
})();
