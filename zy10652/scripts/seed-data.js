const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'app.db');
const db = new sqlite3.Database(dbPath);

const applications = [
  { app_id: 'APP001', app_name: '电商开放平台', owner: '张三', status: 'normal' },
  { app_id: 'APP002', app_name: '支付网关', owner: '李四', status: 'downgrade_pending' },
  { app_id: 'APP003', app_name: '用户中心', owner: '王五', status: 'downgraded' },
  { app_id: 'APP004', app_name: '消息推送', owner: '赵六', status: 'restore_request' },
  { app_id: 'APP005', app_name: '物流查询', owner: '钱七', status: 'normal' }
];

const permissionItems = [
  { app_id: 'APP001', permission_key: 'trade.read', permission_name: '交易读取', original_level: 3, target_level: 1 },
  { app_id: 'APP001', permission_key: 'trade.write', permission_name: '交易写入', original_level: 3, target_level: 1 },
  { app_id: 'APP001', permission_key: 'user.info', permission_name: '用户信息', original_level: 2, target_level: 1 },
  { app_id: 'APP002', permission_key: 'payment.all', permission_name: '支付全权限', original_level: 4, target_level: 2 },
  { app_id: 'APP003', permission_key: 'user.profile', permission_name: '用户资料', original_level: 3, target_level: 1 },
  { app_id: 'APP004', permission_key: 'message.send', permission_name: '消息发送', original_level: 3, target_level: 2 }
];

const downgradeRecords = [
  { app_id: 'APP002', status: 'downgrade_pending', audit_opinion: '待审核', downgrade_reason: '接口调用频率异常', operator: '审核员A', old_token_high_permission: 0 },
  { app_id: 'APP003', status: 'downgraded', audit_opinion: '已审核通过', downgrade_reason: '存在安全漏洞', operator: '审核员B', old_token_high_permission: 1, conflict_detected: 1, conflict_details: '检测到2个高权限token未过期' },
  { app_id: 'APP004', status: 'restore_request', audit_opinion: '恢复申请中', downgrade_reason: '已修复安全问题', operator: '王五', old_token_high_permission: 0 }
];

const statusHistory = [
  { app_id: 'APP002', from_status: 'normal', to_status: 'downgrade_pending', operator: '审核员A', remark: '提交降级申请' },
  { app_id: 'APP003', from_status: 'normal', to_status: 'downgrade_pending', operator: '审核员B', remark: '提交降级申请' },
  { app_id: 'APP003', from_status: 'downgrade_pending', to_status: 'downgraded', operator: '审核员B', remark: '审核通过，执行降级' },
  { app_id: 'APP004', from_status: 'downgraded', to_status: 'restore_request', operator: '王五', remark: '提交恢复申请' }
];

db.serialize(() => {
  const stmtApp = db.prepare('INSERT OR IGNORE INTO applications (app_id, app_name, owner, status) VALUES (?, ?, ?, ?)');
  applications.forEach(app => {
    stmtApp.run(app.app_id, app.app_name, app.owner, app.status);
  });
  stmtApp.finalize();

  const stmtPerm = db.prepare('INSERT OR IGNORE INTO permission_items (app_id, permission_key, permission_name, original_level, target_level) VALUES (?, ?, ?, ?, ?)');
  permissionItems.forEach(perm => {
    stmtPerm.run(perm.app_id, perm.permission_key, perm.permission_name, perm.original_level, perm.target_level);
  });
  stmtPerm.finalize();

  const stmtRecord = db.prepare('INSERT OR IGNORE INTO downgrade_records (app_id, status, audit_opinion, downgrade_reason, operator, old_token_high_permission, conflict_detected, conflict_details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  downgradeRecords.forEach(rec => {
    stmtRecord.run(rec.app_id, rec.status, rec.audit_opinion, rec.downgrade_reason, rec.operator, rec.old_token_high_permission, rec.conflict_detected, rec.conflict_details);
  });
  stmtRecord.finalize();

  const stmtHistory = db.prepare('INSERT OR IGNORE INTO status_history (app_id, from_status, to_status, operator, remark) VALUES (?, ?, ?, ?, ?)');
  statusHistory.forEach(hist => {
    stmtHistory.run(hist.app_id, hist.from_status, hist.to_status, hist.operator, hist.remark);
  });
  stmtHistory.finalize();

  console.log('测试数据插入完成');
});

db.close();
