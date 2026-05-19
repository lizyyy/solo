const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.db');
const db = new sqlite3.Database(dbPath);

const sampleRecords = [
  {
    room_number: '101',
    cleaner_name: '张三',
    checkin_date: '2024-01-15',
    checkout_date: '2024-01-16',
    start_time: '2024-01-16 10:00:00',
    end_time: '2024-01-16 11:30:00',
    photo_count: 6,
    photo_urls: '',
    status: 'passed',
    exception_types: null,
    score: 100,
    deduction_amount: 0,
    rework_count: 0,
    is_reworked: 0
  },
  {
    room_number: '102',
    cleaner_name: '李四',
    checkin_date: '2024-01-15',
    checkout_date: '2024-01-16',
    start_time: '2024-01-16 10:00:00',
    end_time: '2024-01-16 11:30:00',
    photo_count: 3,
    photo_urls: '',
    status: 'blocked',
    exception_types: 'missing_photos',
    score: 100,
    deduction_amount: 0,
    rework_count: 0,
    is_reworked: 0
  },
  {
    room_number: '103',
    cleaner_name: '张三',
    checkin_date: '2024-01-15',
    checkout_date: '2024-01-16',
    start_time: '2024-01-16 10:00:00',
    end_time: '2024-01-16 12:40:00',
    photo_count: 5,
    photo_urls: '',
    status: 'blocked',
    exception_types: 'timeout',
    score: 80,
    deduction_amount: 0,
    rework_count: 0,
    is_reworked: 0
  },
  {
    room_number: '201',
    cleaner_name: '王五',
    checkin_date: '2024-01-14',
    checkout_date: '2024-01-15',
    start_time: '2024-01-15 09:00:00',
    end_time: '2024-01-15 10:30:00',
    photo_count: 5,
    photo_urls: '',
    status: 'blocked',
    exception_types: 'rework',
    score: 100,
    deduction_amount: 50,
    rework_count: 1,
    is_reworked: 0
  },
  {
    room_number: '201',
    cleaner_name: '王五',
    checkin_date: '2024-01-14',
    checkout_date: '2024-01-15',
    start_time: '2024-01-15 14:00:00',
    end_time: '2024-01-15 15:00:00',
    photo_count: 5,
    photo_urls: '',
    status: 'passed',
    exception_types: null,
    score: 100,
    deduction_amount: 0,
    rework_count: 1,
    is_reworked: 1,
    parent_record_id: 4
  },
  {
    room_number: '202',
    cleaner_name: '李四',
    checkin_date: '2024-01-15',
    checkout_date: '2024-01-16',
    start_time: '2024-01-16 09:30:00',
    end_time: '2024-01-16 11:45:00',
    photo_count: 2,
    photo_urls: '',
    status: 'blocked',
    exception_types: 'missing_photos,timeout',
    score: 70,
    deduction_amount: 0,
    rework_count: 0,
    is_reworked: 0
  },
  {
    room_number: '301',
    cleaner_name: '赵六',
    checkin_date: '2024-01-16',
    checkout_date: '2024-01-17',
    start_time: '2024-01-17 10:00:00',
    end_time: '2024-01-17 11:20:00',
    photo_count: 5,
    photo_urls: '',
    status: 'audited',
    exception_types: null,
    score: 100,
    deduction_amount: 0,
    rework_count: 0,
    is_reworked: 0,
    auditor_name: '运营主管',
    audit_time: '2024-01-17 14:00:00',
    audit_remark: '保洁质量良好，照片齐全'
  },
  {
    room_number: '302',
    cleaner_name: '张三',
    checkin_date: '2024-01-16',
    checkout_date: '2024-01-17',
    start_time: '2024-01-17 09:00:00',
    end_time: '2024-01-17 09:50:00',
    photo_count: 5,
    photo_urls: '',
    status: 'passed',
    exception_types: null,
    score: 100,
    deduction_amount: 0,
    rework_count: 0,
    is_reworked: 0
  }
];

db.serialize(() => {
  const stmt = db.prepare(`
    INSERT INTO cleaning_records (
      room_number, cleaner_name, checkin_date, checkout_date,
      start_time, end_time, photo_count, photo_urls,
      status, exception_types, score, deduction_amount,
      rework_count, is_reworked, parent_record_id,
      auditor_name, audit_time, audit_remark,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now", "localtime"), datetime("now", "localtime"))
  `);

  sampleRecords.forEach(record => {
    stmt.run(
      record.room_number,
      record.cleaner_name,
      record.checkin_date,
      record.checkout_date,
      record.start_time,
      record.end_time,
      record.photo_count,
      record.photo_urls,
      record.status,
      record.exception_types,
      record.score,
      record.deduction_amount,
      record.rework_count,
      record.is_reworked,
      record.parent_record_id || null,
      record.auditor_name || null,
      record.audit_time || null,
      record.audit_remark || null
    );
  });

  stmt.finalize();

  const auditStmt = db.prepare(`
    INSERT INTO audit_logs (record_id, action, operator, reason, details, created_at)
    VALUES (?, ?, ?, ?, ?, datetime("now", "localtime"))
  `);

  auditStmt.run(2, 'create', '李四', '缺图拦截：照片数量不足，当前3张，要求至少5张', JSON.stringify({ validation: { status: 'blocked' } }));
  auditStmt.run(3, 'create', '张三', '超时扣分：用时100分钟，超时40分钟，扣20分', JSON.stringify({ validation: { status: 'blocked' } }));
  auditStmt.run(4, 'create', '王五', '返工影响：返工1次，扣款50元', JSON.stringify({ validation: { status: 'blocked' } }));
  auditStmt.run(6, 'create', '李四', '缺图拦截：照片数量不足，当前2张，要求至少5张；超时扣分：用时135分钟，超时75分钟，扣30分', JSON.stringify({ validation: { status: 'blocked' } }));
  auditStmt.finalize();

  console.log('✅ 样例数据导入成功！');
  console.log('');
  console.log('📊 数据统计：');
  console.log('  - 保洁记录: 8条');
  console.log('  - 正常通过: 3条 (101, 201返工, 302)');
  console.log('  - 缺图拦截: 2条 (102, 202)');
  console.log('  - 超时扣分: 2条 (103, 202)');
  console.log('  - 返工扣款: 1条 (201)');
  console.log('  - 已审核: 1条 (301)');
  console.log('');
  console.log('👤 保洁员: 张三, 李四, 王五, 赵六');
  console.log('');
});

db.close();
