const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/trial-extension.db');
const db = new sqlite3.Database(DB_PATH);

console.log('开始导入验收数据...\n');

db.serialize(() => {
  db.run('BEGIN TRANSACTION');

  const tenants = [
    { tenant_id: 'T001', tenant_name: '北京科技创新有限公司', industry: '互联网', contact_person: '张三', contact_phone: '13800138001' },
    { tenant_id: 'T002', tenant_name: '上海金融服务集团', industry: '金融', contact_person: '李四', contact_phone: '13800138002' },
    { tenant_id: 'T003', tenant_name: '广州制造业股份公司', industry: '制造业', contact_person: '王五', contact_phone: '13800138003' },
    { tenant_id: 'T004', tenant_name: '深圳教育科技有限公司', industry: '教育', contact_person: '赵六', contact_phone: '13800138004' }
  ];

  const tenantStmt = db.prepare(`INSERT INTO tenants 
    (tenant_id, tenant_name, industry, contact_person, contact_phone, created_at) 
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`);

  tenants.forEach(t => {
    tenantStmt.run(t.tenant_id, t.tenant_name, t.industry, t.contact_person, t.contact_phone);
    console.log(`✓ 已创建租户: ${t.tenant_name} (${t.tenant_id})`);
  });
  tenantStmt.finalize();

  console.log('');

  const extensions = [
    {
      extension_no: 'EXT001',
      tenant_id: 'T001',
      original_trial_end_date: '2024-03-01',
      requested_extension_days: 30,
      new_trial_end_date: '2024-03-31',
      extension_reason: '客户需求调研尚未完成，需要更多时间进行POC验证',
      sales_notes: '客户决策链较长，预计下月可确认签约',
      salesperson_id: 'S001',
      salesperson_name: '销售小王',
      status: 'extension_approved',
      approver_id: 'M001',
      approver_name: '销售经理',
      approval_comment: '同意延期，请持续跟进客户需求',
      approved_at: '2024-02-28 10:30:00'
    },
    {
      extension_no: 'EXT002',
      tenant_id: 'T002',
      original_trial_end_date: '2024-02-15',
      requested_extension_days: 15,
      new_trial_end_date: '2024-03-01',
      extension_reason: '客户内部审批流程正在进行中',
      sales_notes: '已收到客户预付款意向',
      salesperson_id: 'S002',
      salesperson_name: '销售小李',
      status: 'extension_pending',
      approver_id: null,
      approver_name: null,
      approval_comment: null,
      approved_at: null
    },
    {
      extension_no: 'EXT003',
      tenant_id: 'T003',
      original_trial_end_date: '2024-01-31',
      requested_extension_days: 60,
      new_trial_end_date: '2024-03-31',
      extension_reason: '客户项目延期，需继续使用系统支持项目',
      sales_notes: '高价值客户，年预算50万以上',
      salesperson_id: 'S001',
      salesperson_name: '销售小王',
      status: 'converted',
      approver_id: 'M001',
      approver_name: '销售经理',
      approval_comment: '已签署正式合同',
      approved_at: '2024-02-15 14:00:00'
    },
    {
      extension_no: 'EXT004',
      tenant_id: 'T004',
      original_trial_end_date: '2024-03-15',
      requested_extension_days: 7,
      new_trial_end_date: '2024-03-22',
      extension_reason: '关键用户出差，需延后一周完成评估',
      sales_notes: '',
      salesperson_id: 'S003',
      salesperson_name: '销售小张',
      status: 'trial_active',
      approver_id: null,
      approver_name: null,
      approval_comment: null,
      approved_at: null
    }
  ];

  const extStmt = db.prepare(`INSERT INTO trial_extensions 
    (extension_no, tenant_id, original_trial_end_date, requested_extension_days, 
     new_trial_end_date, extension_reason, sales_notes, salesperson_id, salesperson_name, 
     status, approver_id, approver_name, approval_comment, approved_at, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`);

  extensions.forEach(e => {
    extStmt.run(
      e.extension_no, e.tenant_id, e.original_trial_end_date, e.requested_extension_days,
      e.new_trial_end_date, e.extension_reason, e.sales_notes, e.salesperson_id, e.salesperson_name,
      e.status, e.approver_id, e.approver_name, e.approval_comment, e.approved_at
    );
    console.log(`✓ 已创建申请: ${e.extension_no} - ${e.status}`);
  });
  extStmt.finalize();

  console.log('');

  const history = [
    { extension_id: 1, action: 'CREATE', old_status: null, new_status: 'extension_pending', operator_id: 'S001', operator_name: '销售小王', comment: '创建延期申请' },
    { extension_id: 1, action: 'APPROVE', old_status: 'extension_pending', new_status: 'extension_approved', operator_id: 'M001', operator_name: '销售经理', comment: '同意延期，请持续跟进客户需求' },
    { extension_id: 2, action: 'CREATE', old_status: null, new_status: 'extension_pending', operator_id: 'S002', operator_name: '销售小李', comment: '创建延期申请' },
    { extension_id: 3, action: 'CREATE', old_status: null, new_status: 'extension_pending', operator_id: 'S001', operator_name: '销售小王', comment: '创建延期申请' },
    { extension_id: 3, action: 'APPROVE', old_status: 'extension_pending', new_status: 'extension_approved', operator_id: 'M001', operator_name: '销售经理', comment: '同意延期' },
    { extension_id: 3, action: 'CONVERT', old_status: 'extension_approved', new_status: 'converted', operator_id: 'S001', operator_name: '销售小王', comment: '已签署正式合同，转为付费客户' },
    { extension_id: 4, action: 'CREATE', old_status: null, new_status: 'trial_active', operator_id: 'S003', operator_name: '销售小张', comment: '新租户试用开始' }
  ];

  const histStmt = db.prepare(`INSERT INTO extension_history 
    (extension_id, action, old_status, new_status, operator_id, operator_name, comment, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`);

  history.forEach(h => {
    histStmt.run(h.extension_id, h.action, h.old_status, h.new_status, h.operator_id, h.operator_name, h.comment);
  });
  histStmt.finalize();
  console.log(`✓ 已创建 ${history.length} 条历史记录`);

  console.log('');

  const importRecords = [
    { batch_no: 'BATCH001', row_number: 1, raw_data: '{"tenant_id":"T001","extension_reason":"测试"}', error_message: null, status: 'success' },
    { batch_no: 'BATCH001', row_number: 2, raw_data: '{"tenant_id":"INVALID","extension_reason":"坏数据"}', error_message: '租户不存在，请先创建租户信息', status: 'failed' },
    { batch_no: 'BATCH001', row_number: 3, raw_data: '{"missing_fields":true}', error_message: '缺少必填字段: tenant_id, extension_reason, salesperson_id', status: 'failed' }
  ];

  const importStmt = db.prepare(`INSERT INTO import_records 
    (batch_no, row_number, raw_data, error_message, status, created_at) 
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`);

  importRecords.forEach(r => {
    importStmt.run(r.batch_no, r.row_number, r.raw_data, r.error_message, r.status);
  });
  importStmt.finalize();
  console.log(`✓ 已创建 ${importRecords.length} 条导入记录 (含坏行)`);

  console.log('');

  db.run('COMMIT', (err) => {
    if (err) {
      console.error('导入失败:', err);
      db.run('ROLLBACK');
    } else {
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║                    验收数据导入完成！                        ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log('║  ✓ 租户数据: 4 条                                         ║');
      console.log('║  ✓ 延期申请: 4 条                                         ║');
      console.log('║  ✓ 历史记录: 7 条                                         ║');
      console.log('║  ✓ 导入记录: 3 条 (含 2 条坏行)                            ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log('║  完整流转案例: EXT003 (T003)                               ║');
      console.log('║    创建申请 → 审批通过 → 已转正                             ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log('║  冲突拦截测试: EXT002 (T002) 处于 extension_pending        ║');
      console.log('║    对 T002 再次提交申请将被拦截并返回所需材料               ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log('║  坏行数据: BATCH001 包含 2 条导入失败记录                  ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
    }
    db.close();
  });
});
