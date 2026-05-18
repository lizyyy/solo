const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const dbPath = path.join(__dirname, '../../data/database.db');
const db = new sqlite3.Database(dbPath);

const stores = [
  { id: 's001', code: 'BJ-CY-001', name: '北京朝阳门店', region: '华北区', address: '北京市朝阳区建国路88号', manager_name: '张伟', manager_phone: '138******01' },
  { id: 's002', code: 'BJ-HD-002', name: '北京海淀门店', region: '华北区', address: '北京市海淀区中关村大街1号', manager_name: '李娜', manager_phone: '138******02' },
  { id: 's003', code: 'SH-PD-003', name: '上海浦东门店', region: '华东区', address: '上海市浦东新区陆家嘴环路1000号', manager_name: '王强', manager_phone: '138******03' },
  { id: 's004', code: 'SZ-NS-004', name: '深圳南山门店', region: '华南区', address: '深圳市南山区科技园南路16号', manager_name: '刘芳', manager_phone: '138******04' }
];

const employees = [
  { id: 'e001', code: 'EMP2024001', name: '张小明', phone: '139******01', id_card: '1****************4', position: '资深店员', store_id: 's001', store_name: '北京朝阳门店', status: 'active' },
  { id: 'e002', code: 'EMP2024002', name: '李小华', phone: '139******02', id_card: '1****************8', position: '店长', store_id: 's001', store_name: '北京朝阳门店', status: 'active' },
  { id: 'e003', code: 'EMP2024003', name: '王小丽', phone: '139******03', id_card: '3****************2', position: '资深店员', store_id: 's002', store_name: '北京海淀门店', status: 'active' },
  { id: 'e004', code: 'EMP2024004', name: '赵小龙', phone: '139******04', id_card: '3****************6', position: '店员', store_id: 's002', store_name: '北京海淀门店', status: 'active' },
  { id: 'e005', code: 'EMP2024005', name: '陈小燕', phone: '139******05', id_card: '4****************0', position: '副店长', store_id: 's003', store_name: '上海浦东门店', status: 'active' }
];

const shiftTemplates = [
  { id: 'st001', name: '早班', start_time: '07:00', end_time: '15:30', break_minutes: 60 },
  { id: 'st002', name: '中班', start_time: '11:00', end_time: '19:30', break_minutes: 60 },
  { id: 'st003', name: '晚班', start_time: '14:00', end_time: '22:30', break_minutes: 60 },
  { id: 'st004', name: '全天班', start_time: '09:00', end_time: '18:00', break_minutes: 90 },
  { id: 'st005', name: '通宵班', start_time: '22:00', end_time: '06:30', break_minutes: 60 }
];

const runSql = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const seedStores = async () => {
  for (const store of stores) {
    await runSql(
      'INSERT OR REPLACE INTO stores (id, code, name, region, address, manager_name, manager_phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [store.id, store.code, store.name, store.region, store.address, store.manager_name, store.manager_phone]
    );
  }
  console.log('✓ 门店数据插入完成');
};

const seedEmployees = async () => {
  for (const emp of employees) {
    await runSql(
      'INSERT OR REPLACE INTO employees (id, code, name, phone, id_card, position, store_id, store_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [emp.id, emp.code, emp.name, emp.phone, emp.id_card, emp.position, emp.store_id, emp.store_name, emp.status]
    );
  }
  console.log('✓ 员工数据插入完成');
};

const seedShiftTemplates = async () => {
  for (const st of shiftTemplates) {
    await runSql(
      'INSERT OR REPLACE INTO shift_templates (id, name, start_time, end_time, break_minutes, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [st.id, st.name, st.start_time, st.end_time, st.break_minutes]
    );
  }
  console.log('✓ 班次模板插入完成');
};

const createHistoryRecord = (transferId, operationType, oldStatus, newStatus, operatorId, operatorName, operationFrom, note, createdAt) => {
  return runSql(
    'INSERT INTO transfer_history (id, transfer_id, operation_type, old_status, new_status, operator_id, operator_name, operation_from, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), transferId, operationType, oldStatus, newStatus, operatorId, operatorName, operationFrom, note, createdAt]
  );
};

const seedAcceptanceData = async () => {
  const today = moment().format('YYYY-MM-DD');
  const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');
  const nextWeek = moment().add(7, 'days').format('YYYY-MM-DD');

  const fullFlowId = uuidv4();
  const fullFlowNo = `TR${moment().format('YYYYMMDD')}0001`;
  
  await runSql(
    'INSERT INTO transfer_shifts (id, transfer_no, employee_id, employee_code, employee_name, original_store_id, original_store_code, original_store_name, target_store_id, target_store_code, target_store_name, shift_date, shift_template_id, shift_template_name, shift_start_time, shift_end_time, status, remark, created_by, created_by_name, created_from, created_at, updated_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      fullFlowId, fullFlowNo,
      'e001', 'EMP2024001', '张小明',
      's001', 'BJ-CY-001', '北京朝阳门店',
      's002', 'BJ-HD-002', '北京海淀门店',
      nextWeek, 'st001', '早班', '07:00', '15:30',
      'archived', '国庆高峰期支援海淀门店',
      'm001', '张经理', 'Web后台',
      moment().subtract(2, 'hours').toDate(), moment().subtract(2, 'hours').toDate(), moment().toDate()
    ]
  );

  await createHistoryRecord(fullFlowId, 'create', null, 'pending_confirmation', 'm001', '张经理', 'Web后台', '创建借调记录-国庆高峰期支援', moment().subtract(2, 'hours').toDate());
  await createHistoryRecord(fullFlowId, 'update_status', 'pending_confirmation', 'transferred', 'm002', '李店长', '门店终端', '确认可以借调，已安排好住宿', moment().subtract(1, 'hours').toDate());
  await createHistoryRecord(fullFlowId, 'archive', 'transferred', 'archived', 'm001', '张经理', 'Web后台', '借调完成已归档', moment().toDate());

  const conflictId = uuidv4();
  const conflictNo = `TR${moment().format('YYYYMMDD')}0002`;
  
  await runSql(
    'INSERT INTO transfer_shifts (id, transfer_no, employee_id, employee_code, employee_name, original_store_id, original_store_code, original_store_name, target_store_id, target_store_code, target_store_name, shift_date, shift_template_id, shift_template_name, shift_start_time, shift_end_time, status, conflict_note, remark, created_by, created_by_name, created_from, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      conflictId, conflictNo,
      'e003', 'EMP2024003', '王小丽',
      's002', 'BJ-HD-002', '北京海淀门店',
      's001', 'BJ-CY-001', '北京朝阳门店',
      tomorrow, 'st002', '中班', '11:00', '19:30',
      'conflict_pending',
      '检测到时间冲突：与 中班(11:00-19:30) 重叠',
      '朝阳店做618活动急需人手',
      'm003', '王主管', '移动端',
      moment().subtract(30, 'minutes').toDate(), moment().subtract(30, 'minutes').toDate()
    ]
  );

  await createHistoryRecord(conflictId, 'create', null, 'conflict_pending', 'm003', '王主管', '移动端', '创建时检测到冲突: 检测到时间冲突：与 中班(11:00-19:30) 重叠', moment().subtract(30, 'minutes').toDate());

  const badRecordId = uuidv4();
  const batchNo = `BATCH${moment().format('YYYYMMDD')}001`;
  const badRecordData = {
    '员工姓名': '不存在的员工',
    '员工工号': 'EMP999999',
    '原门店': '未知门店',
    '目标门店': '北京朝阳门店',
    '班次日期': '2024-13-01',
    '班次名称': '早班'
  };

  await runSql(
    'INSERT INTO import_bad_records (id, batch_no, row_number, raw_data, error_message, imported_by, imported_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [
      badRecordId, batchNo, 5,
      JSON.stringify(badRecordData),
      '员工不存在; 原门店不存在; 班次日期格式错误',
      'admin'
    ]
  );

  const pendingId = uuidv4();
  const pendingNo = `TR${moment().format('YYYYMMDD')}0003`;
  
  await runSql(
    'INSERT INTO transfer_shifts (id, transfer_no, employee_id, employee_code, employee_name, original_store_id, original_store_code, original_store_name, target_store_id, target_store_code, target_store_name, shift_date, shift_template_id, shift_template_name, shift_start_time, shift_end_time, status, remark, created_by, created_by_name, created_from, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      pendingId, pendingNo,
      'e005', 'EMP2024005', '陈小燕',
      's003', 'SH-PD-003', '上海浦东门店',
      's004', 'SZ-NS-004', '深圳南山门店',
      today, 'st003', '晚班', '14:00', '22:30',
      'pending_confirmation', '新店开业支援',
      'm004', '赵总监', 'Web后台',
      moment().toDate(), moment().toDate()
    ]
  );

  await createHistoryRecord(pendingId, 'create', null, 'pending_confirmation', 'm004', '赵总监', 'Web后台', '创建借调记录-新店开业支援', moment().toDate());
  
  console.log('✓ 验收数据插入完成');
};

const runSeed = async () => {
  try {
    console.log('开始插入种子数据...\n');
    
    await seedStores();
    await seedEmployees();
    await seedShiftTemplates();
    await seedAcceptanceData();
    
    console.log('\n所有种子数据插入成功!');
    console.log('\n验收数据说明:');
    console.log('1. 完整流转: 张小明 朝阳→海淀 早班 (待确认→已借调→已归档)');
    console.log('2. 冲突记录: 王小丽 海淀→朝阳 中班 (冲突待判-原门店仍排同一时段)');
    console.log('3. 导入坏行: 第5行数据存在3处错误(员工不存在/门店不存在/日期格式错)');
    console.log('4. 待确认记录: 陈小燕 浦东→南山 晚班 (待确认状态)');
    
    db.close();
    process.exit(0);
  } catch (err) {
    console.error('种子数据插入失败:', err);
    db.close();
    process.exit(1);
  }
};

runSeed();
