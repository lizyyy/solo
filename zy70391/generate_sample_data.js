const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

db.init();

const dbInstance = db.getDb();

console.log('正在生成示例数据...');

const applicants = [
  'zhangsan@company.com',
  'lisi@company.com', 
  'wangwu@company.com',
  'zhaoliu@company.com',
  'qianqi@company.com'
];

const approvers = [
  'manager@company.com',
  'lead@company.com',
  'director@company.com'
];

const reasons = [
  '生产数据库问题排查',
  '日志异常分析',
  '紧急修复部署',
  '性能调优',
  '数据核对'
];

function createPermission(applicant, permissionType, days, validToOffset = 0) {
  const id = uuidv4();
  const now = new Date();
  const validFrom = moment(now).toISOString();
  const validTo = moment(now).add(days, 'days').toISOString();
  
  const stmt = dbInstance.prepare(`
    INSERT INTO permissions (
      id, applicant, permission_type, reason, requested_days,
      valid_from, valid_to, status, created_at, updated_at,
      original_valid_to
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    applicant,
    permissionType,
    reasons[Math.floor(Math.random() * reasons.length)],
    days,
    validFrom,
    validTo,
    'authorized',
    now.toISOString(),
    now.toISOString(),
    validTo
  );
  
  return id;
}

function logAudit(action, actor, permissionId, details) {
  const stmt = dbInstance.prepare(`
    INSERT INTO audit_logs (id, permission_id, action, actor, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    uuidv4(),
    permissionId,
    action,
    actor,
    JSON.stringify(details),
    new Date().toISOString()
  );
}

console.log('1. 创建数据库只读权限（7天，正常有效）');
const dbPermId = createPermission(applicants[0], 'DB_READ_ONLY', 7);
logAudit('CREATE_PERMISSION', 'system', dbPermId, { applicant: applicants[0], permissionType: 'DB_READ_ONLY' });
logAudit('APPROVE_PERMISSION', approvers[0], dbPermId, { comment: '同意，排障需要' });
logAudit('AUTHORIZE_PERMISSION', 'admin@company.com', dbPermId, {});
console.log(`   权限ID: ${dbPermId}`);

console.log('2. 创建日志查询权限（即将到期，1天后到期）');
const logPermId = createPermission(applicants[1], 'LOG_QUERY', 1);
logAudit('CREATE_PERMISSION', 'system', logPermId, { applicant: applicants[1], permissionType: 'LOG_QUERY' });
logAudit('APPROVE_PERMISSION', approvers[1], logPermId, {});
logAudit('AUTHORIZE_PERMISSION', 'admin@company.com', logPermId, {});
console.log(`   权限ID: ${logPermId}`);

console.log('3. 创建发布操作权限（已延期）');
const deployPermId = createPermission(applicants[2], 'DEPLOY_OPERATION', 3);
logAudit('CREATE_PERMISSION', 'system', deployPermId, { applicant: applicants[2], permissionType: 'DEPLOY_OPERATION' });
logAudit('APPROVE_PERMISSION', approvers[2], deployPermId, {});
logAudit('AUTHORIZE_PERMISSION', 'admin@company.com', deployPermId, {});

const extensionStmt = dbInstance.prepare(`
  INSERT INTO extensions (
    id, permission_id, applicant, additional_days, reason,
    status, original_valid_to, new_valid_to, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const extensionId = uuidv4();
const originalValidTo = moment().add(3, 'days').toISOString();
const newValidTo = moment().add(5, 'days').toISOString();

extensionStmt.run(
  extensionId,
  deployPermId,
  applicants[2],
  2,
  '修复尚未完成',
  'approved',
  originalValidTo,
  newValidTo,
  new Date().toISOString(),
  new Date().toISOString()
);

const updateStmt = dbInstance.prepare(`
  UPDATE permissions 
  SET valid_to = ?, extension_count = 1
  WHERE id = ?
`);
updateStmt.run(newValidTo, deployPermId);

logAudit('REQUEST_EXTENSION', applicants[2], deployPermId, { additionalDays: 2 });
logAudit('APPROVE_EXTENSION', approvers[0], deployPermId, { extensionId });
console.log(`   权限ID: ${deployPermId}`);
console.log(`   延期申请ID: ${extensionId}`);

console.log('4. 创建已过期的权限（用于测试到期扫描）');
const expiredPermId = uuidv4();
const expiredStmt = dbInstance.prepare(`
  INSERT INTO permissions (
    id, applicant, permission_type, reason, requested_days,
    valid_from, valid_to, status, created_at, updated_at,
    original_valid_to
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

expiredStmt.run(
  expiredPermId,
  applicants[3],
  'LOG_QUERY',
  '历史日志查询',
  1,
  moment().subtract(2, 'days').toISOString(),
  moment().subtract(1, 'days').toISOString(),
  'authorized',
  moment().subtract(3, 'days').toISOString(),
  moment().subtract(3, 'days').toISOString(),
  moment().subtract(1, 'days').toISOString()
);

logAudit('CREATE_PERMISSION', 'system', expiredPermId, { applicant: applicants[3] });
logAudit('APPROVE_PERMISSION', approvers[1], expiredPermId, {});
logAudit('AUTHORIZE_PERMISSION', 'admin@company.com', expiredPermId, {});
console.log(`   权限ID: ${expiredPermId}（已过期1天）`);

console.log('5. 创建另一个已过期权限（用于测试回收失败）');
const failedPermId = uuidv4();
expiredStmt.run(
  failedPermId,
  applicants[4],
  'DB_READ_ONLY',
  '数据库查询',
  1,
  moment().subtract(5, 'days').toISOString(),
  moment().subtract(3, 'days').toISOString(),
  'authorized',
  moment().subtract(6, 'days').toISOString(),
  moment().subtract(6, 'days').toISOString(),
  moment().subtract(3, 'days').toISOString()
);

logAudit('CREATE_PERMISSION', 'system', failedPermId, { applicant: applicants[4] });
logAudit('APPROVE_PERMISSION', approvers[0], failedPermId, {});
logAudit('AUTHORIZE_PERMISSION', 'admin@company.com', failedPermId, {});
console.log(`   权限ID: ${failedPermId}（已过期3天）`);

console.log('');
console.log('示例数据生成完成！');
console.log('');
console.log('总结:');
console.log('- 数据库只读权限（有效）: ' + dbPermId);
console.log('- 日志查询权限（1天后到期）: ' + logPermId);
console.log('- 发布操作权限（已延期，5天后到期）: ' + deployPermId);
console.log('- 日志查询权限（已过期1天，待自动回收）: ' + expiredPermId);
console.log('- 数据库只读权限（已过期3天，待自动回收）: ' + failedPermId);
console.log('');
console.log('接下来可以:');
console.log('1. 运行 curl 测试脚本: bash test_curl_examples.sh');
console.log('2. 执行到期扫描: curl -X POST http://localhost:3000/api/scan/expired');
console.log('3. 查看扫描汇总: curl http://localhost:3000/api/scan/summary');
