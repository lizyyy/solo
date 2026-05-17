const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

process.env.DB_PATH = path.join(__dirname, '../data/test-auth-permissions.db');
const dbPath = process.env.DB_PATH;
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

console.log('🧹 清理并初始化测试数据库...');

const db = new sqlite3.Database(dbPath);
const STATUS = {
  PENDING_CONFIRM: 'pending_confirm',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked'
};

const initPromise = new Promise((resolve, reject) => {
  db.serialize(() => {
    db.run(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        email TEXT,
        department TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE permission_packages (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        permissions TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE temp_permissions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        permission_package_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL,
        valid_from INTEGER,
        valid_to INTEGER,
        applied_by TEXT NOT NULL,
        confirmed_by TEXT,
        confirmed_at INTEGER,
        revoked_by TEXT,
        revoked_at INTEGER,
        revoked_reason TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (permission_package_id) REFERENCES permission_packages(id)
      )
    `);

    db.run(`
      CREATE TABLE permission_history (
        id TEXT PRIMARY KEY,
        temp_permission_id TEXT NOT NULL,
        action TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        operator TEXT NOT NULL,
        remark TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (temp_permission_id) REFERENCES temp_permissions(id)
      )
    `);

    const now = Date.now();
    const stmtUsers = db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)');
    const users = [
      ['u001', 'admin', '系统管理员', 'admin@example.com', '技术部', now, now],
      ['u002', 'zhangsan', '张三', 'zhangsan@example.com', '财务部', now, now],
      ['u003', 'lisi', '李四', 'lisi@example.com', '运营部', now, now],
      ['u004', 'wangwu', '王五', 'wangwu@example.com', '市场部', now, now],
      ['u005', 'zhaoliu', '赵六', 'zhaoliu@example.com', '人力资源部', now, now]
    ];
    users.forEach(u => stmtUsers.run(...u));
    stmtUsers.finalize();

    const stmtPkgs = db.prepare('INSERT INTO permission_packages VALUES (?, ?, ?, ?, ?, ?, ?)');
    const packages = [
      ['p001', 'FINANCE_VIEW', '财务数据查看', '查看财务报表', JSON.stringify(['finance:view', 'finance:report']), now, now],
      ['p002', 'USER_MANAGE', '用户管理', '用户增删改查', JSON.stringify(['user:create', 'user:read', 'user:update', 'user:delete']), now, now],
      ['p003', 'SYSTEM_CONFIG', '系统配置', '系统参数配置', JSON.stringify(['system:config', 'system:log']), now, now],
      ['p004', 'DATA_EXPORT', '数据导出', '批量数据导出', JSON.stringify(['data:export', 'data:download']), now, now],
      ['p005', 'AUDIT_VIEW', '审计日志查看', '查看审计日志', JSON.stringify(['audit:view', 'audit:export']), now, now]
    ];
    packages.forEach(p => stmtPkgs.run(...p));
    stmtPkgs.finalize();

    const oneDay = 24 * 60 * 60 * 1000;
    db.run('INSERT INTO temp_permissions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      'tp001', 'u002', 'p001', '月度财务报表审计', STATUS.ACTIVE, now - oneDay, now + 6 * oneDay,
      'u002', 'u001', now - oneDay, null, null, null, now - oneDay, now);

    db.run('INSERT INTO temp_permissions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      'tp002', 'u003', 'p004', '运营数据导出分析', STATUS.PENDING_CONFIRM, now, now + 14 * oneDay,
      'u003', null, null, null, null, null, now, now);

    db.run('INSERT INTO temp_permissions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      'tp003', 'u004', 'p002', '招聘期间用户管理', STATUS.REVOKED, now - 10 * oneDay, now + 4 * oneDay,
      'u004', 'u001', now - 10 * oneDay, 'u001', now - 2 * oneDay, '招聘完成', now - 10 * oneDay, now - 2 * oneDay);

    db.run('INSERT INTO temp_permissions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      'tp004', 'u005', 'p003', '员工入职配置', STATUS.EXPIRED, now - 30 * oneDay, now - 20 * oneDay,
      'u005', 'u001', now - 30 * oneDay, null, null, null, now - 30 * oneDay, now - 30 * oneDay);

    db.close((err) => {
      if (err) reject(err);
      else {
        console.log('✅ 测试数据库已初始化\n');
        resolve();
      }
    });
  });
});

let permissionService;

async function init() {
  await initPromise;
  permissionService = require('../src/services/permissionService');
}

async function testCompleteFlow() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 测试 1: 临时权限完整流转 (申请 → 确认 → 生效 → 回收)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  console.log('1️⃣  申请临时权限...');
  const applied = await permissionService.applyTempPermission(
    'u002',
    'p003',
    '年终审计需要系统配置权限',
    now,
    now + 7 * oneDay,
    'u002'
  );
  console.log('   ✅ 申请成功, ID:', applied.id);
  console.log('   📋 当前状态:', applied.status);
  console.log('');

  console.log('2️⃣  查看操作历史...');
  let history = await permissionService.getHistory(applied.id);
  console.log('   📜 历史记录数:', history.length);
  history.forEach((h, i) => {
    console.log(`      ${i + 1}. 动作:${h.action} | 状态:${h.old_status}→${h.new_status} | 操作人:${h.operator}`);
  });
  console.log('');

  console.log('3️⃣  二次确认权限...');
  const confirmed = await permissionService.confirmTempPermission(applied.id, 'u001');
  console.log('   ✅ 确认成功');
  console.log('   📋 当前状态:', confirmed.status);
  console.log('   👤 确认人:', confirmed.confirmed_by);
  console.log('');

  console.log('4️⃣  再次查看历史...');
  history = await permissionService.getHistory(applied.id);
  console.log('   📜 历史记录数:', history.length);
  history.forEach((h, i) => {
    console.log(`      ${i + 1}. 动作:${h.action} | 状态:${h.old_status || '无'}→${h.new_status} | 操作人:${h.operator}`);
  });
  console.log('');

  console.log('5️⃣  查看权限详情...');
  const detail = await permissionService.getTempPermissionDetail(applied.id);
  console.log('   👤 用户:', detail.user.name, '-', detail.user.department);
  console.log('   📦 权限包:', detail.permission_package.name);
  console.log('   🔑 权限列表:', detail.permission_package.permissions.join(', '));
  console.log('   📅 有效期:', new Date(detail.valid_from).toLocaleDateString(), '→', new Date(detail.valid_to).toLocaleDateString());
  console.log('');

  console.log('6️⃣  回收权限...');
  const revoked = await permissionService.revokeTempPermission(applied.id, 'u001', '审计工作提前完成');
  console.log('   ✅ 回收成功');
  console.log('   📋 当前状态:', revoked.status);
  console.log('   📝 回收原因:', revoked.revoked_reason);
  console.log('');

  console.log('7️⃣  最终历史记录...');
  history = await permissionService.getHistory(applied.id);
  console.log('   📜 历史记录数:', history.length);
  history.forEach((h, i) => {
    console.log(`      ${i + 1}. 动作:${h.action} | 状态:${h.old_status || '无'}→${h.new_status} | 操作人:${h.operator}`);
  });
  console.log('');
  console.log('✅ 完整流转测试通过!\n');
}

async function testConflictFlow() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 测试 2: 状态流转冲突验证');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  console.log('1️⃣  创建待确认的权限申请...');
  const applied = await permissionService.applyTempPermission(
    'u003', 'p004', '临时数据导出', now, now + 3 * oneDay, 'u003'
  );
  console.log('   ✅ 创建成功, 状态:', applied.status);
  console.log('');

  console.log('2️⃣  尝试对已生效权限再次确认 (应该失败)...');
  await permissionService.confirmTempPermission(applied.id, 'u001');
  try {
    await permissionService.confirmTempPermission(applied.id, 'u001');
    console.log('   ❌ 错误: 重复确认应该失败');
  } catch (e) {
    console.log('   ✅ 正确拒绝重复确认:', e.message);
  }
  console.log('');

  console.log('3️⃣  尝试回收待确认的权限 (应该失败)...');
  const applied2 = await permissionService.applyTempPermission(
    'u004', 'p001', '测试冲突', now, now + oneDay, 'u004'
  );
  try {
    await permissionService.revokeTempPermission(applied2.id, 'u001', '测试');
    console.log('   ❌ 错误: 待确认状态不应该可以回收');
  } catch (e) {
    console.log('   ✅ 正确拒绝回收待确认权限:', e.message);
  }
  console.log('');

  console.log('4️⃣  尝试对已回收的权限再次回收 (应该失败)...');
  const perm = await permissionService.applyTempPermission('u005', 'p002', '测试', now, now + oneDay, 'u005');
  await permissionService.confirmTempPermission(perm.id, 'u001');
  await permissionService.revokeTempPermission(perm.id, 'u001', '测试回收');
  try {
    await permissionService.revokeTempPermission(perm.id, 'u001', '再次回收');
    console.log('   ❌ 错误: 已回收状态不应该可以再次回收');
  } catch (e) {
    console.log('   ✅ 正确拒绝回收已回收权限:', e.message);
  }
  console.log('');

  console.log('✅ 冲突验证测试通过!\n');
}

async function testListAndExport() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 测试 3: 列表、筛选和导出');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('1️⃣  查询全部临时权限...');
  const allList = await permissionService.listTempPermissions();
  console.log('   📊 总记录数:', allList.length);
  allList.forEach((item, i) => {
    console.log(`      ${i + 1}. ${item.user.name} - ${item.permission_package.name} [${item.status}]`);
  });
  console.log('');

  console.log('2️⃣  按状态筛选 (生效中)...');
  const activeList = await permissionService.listTempPermissions({ status: STATUS.ACTIVE });
  console.log('   📊 生效中记录数:', activeList.length);
  console.log('');

  console.log('3️⃣  按用户筛选 (u002)...');
  const userList = await permissionService.listTempPermissions({ user_id: 'u002' });
  console.log('   📊 用户 u002 记录数:', userList.length);
  console.log('');

  console.log('4️⃣  CSV导出数据...');
  const csvData = await permissionService.exportToCSV();
  console.log('   📊 导出记录数:', csvData.length);
  if (csvData.length > 0) {
    console.log('   📝 首条数据:', JSON.stringify(csvData[0], null, 2).split('\n').map(l => '      ' + l).join('\n').trim());
  }
  console.log('');

  console.log('✅ 列表导出测试通过!\n');
}

async function testBatchImport() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 测试 4: 批量导入 - 行级错误处理');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  const testRecords = [
    { user_id: 'u002', package_id: 'p001', reason: '财务部常规审计', valid_from: now, valid_to: now + 30 * oneDay },
    { user_id: 'u999', package_id: 'p002', reason: '不存在的用户', valid_from: now, valid_to: now + 7 * oneDay },
    { user_id: 'u003', package_id: 'p999', reason: '不存在的权限包', valid_from: now, valid_to: now + 7 * oneDay },
    { user_id: 'u004', package_id: 'p003', reason: '缺少valid_to字段', valid_from: now },
    { user_id: 'u005', package_id: 'p004', reason: '时间顺序错误', valid_from: now + 7 * oneDay, valid_to: now },
    { user_id: 'u001', package_id: 'p005', reason: '正常导入 - 审计日志查看', valid_from: now, valid_to: now + 14 * oneDay, status: 'expired' },
    { user_id: 'u002', package_id: 'p002', reason: '用户管理临时权限', valid_from: now, valid_to: now + 5 * oneDay },
  ];

  console.log('1️⃣  准备批量导入数据...');
  console.log('   📋 总记录数:', testRecords.length);
  console.log('   🎯 预期: 成功 3 条, 失败 4 条');
  console.log('');

  console.log('2️⃣  执行批量导入...');
  const result = await permissionService.batchImport(testRecords, 'u001');
  console.log('');

  console.log('3️⃣  导入结果汇总:');
  console.log('   📊 总数:', result.total);
  console.log('   ✅ 成功:', result.success);
  console.log('   ❌ 失败:', result.failed);
  console.log('');

  console.log('4️⃣  详细结果:');
  result.details.forEach(d => {
    if (d.success) {
      console.log(`   ✅ 第${d.row}行: 成功, ID=${d.id}`);
    } else {
      console.log(`   ❌ 第${d.row}行: 失败 - ${d.error}`);
      console.log(`      记录: ${JSON.stringify(d.record)}`);
    }
  });
  console.log('');

  if (result.success === 3 && result.failed === 4) {
    console.log('✅ 批量导入测试通过! (成功3条,失败4条符合预期)\n');
  } else {
    console.log('❌ 批量导入测试结果不符合预期!\n');
  }
}

async function runAllTests() {
  try {
    await init();
    await testCompleteFlow();
    await testConflictFlow();
    await testListAndExport();
    await testBatchImport();

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🎉 所有测试完成!');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('💡 启动服务: npm start');
    console.log('💡 访问接口: http://localhost:3000/api/temp-permissions\n');

    process.exit(0);
  } catch (e) {
    console.error('❌ 测试失败:', e);
    process.exit(1);
  }
}

runAllTests();
