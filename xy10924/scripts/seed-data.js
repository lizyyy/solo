const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '..', 'data', 'database.db');
const db = new sqlite3.Database(dbPath);

const customerId1 = uuidv4();
const customerId2 = uuidv4();
const workerId1 = uuidv4();
const workerId2 = uuidv4();
const workerId3 = uuidv4();
const scheduleId1 = uuidv4();
const scheduleId2 = uuidv4();
const depositId1 = uuidv4();
const depositId2 = uuidv4();
const evaluationId1 = uuidv4();
const conclusionId1 = uuidv4();

db.serialize(() => {
  const stmt = db.prepare('INSERT INTO customers (id, name, phone, address, requirements) VALUES (?, ?, ?, ?, ?)');
  stmt.run(customerId1, '张女士', '13800138001', '北京市朝阳区XX小区1号楼101室', '需要照顾老人，会做家常菜');
  stmt.run(customerId2, '李先生', '13800138002', '北京市海淀区YY小区2号楼202室', '需要接送孩子，打扫卫生');
  stmt.finalize();
  console.log('已插入2个客户数据');

  const stmt2 = db.prepare('INSERT INTO workers (id, name, phone, id_card, age, skills, experience_years, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  stmt2.run(workerId1, '王阿姨', '13900139001', '110101197001011234', 54, '["做饭", "打扫卫生", "照顾老人"]', 8, 'available');
  stmt2.run(workerId2, '李阿姨', '13900139002', '110101197502022345', 49, '["做饭", "接送孩子", "育儿"]', 5, 'available');
  stmt2.run(workerId3, '赵阿姨', '13900139003', '110101197803033456', 46, '["做饭", "打扫卫生", "照顾老人", "护理"]', 10, 'available');
  stmt2.finalize();
  console.log('已插入3个阿姨数据');

  const stmt3 = db.prepare('INSERT INTO trial_schedules (id, customer_id, worker_id, scheduled_date, start_time, end_time, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  stmt3.run(scheduleId1, customerId1, workerId1, '2025-05-20', '09:00', '17:00', 'completed', '第一天试工');
  stmt3.run(scheduleId2, customerId2, workerId2, '2025-05-21', '08:00', '18:00', 'confirmed', '第二天试工');
  stmt3.finalize();
  console.log('已插入2个试工安排数据');

  const stmt4 = db.prepare('INSERT INTO deposit_transactions (id, trial_schedule_id, amount, type, status, payment_method, transaction_no, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  stmt4.run(depositId1, scheduleId1, 500.00, 'deposit', 'confirmed', '微信支付', 'WX20250520001', '试工押金');
  stmt4.run(depositId2, scheduleId2, 500.00, 'deposit', 'pending', '银行转账', null, '待支付');
  stmt4.finalize();
  console.log('已插入2个押金交易数据');

  const stmt5 = db.prepare('INSERT INTO evaluations (id, trial_schedule_id, overall_rating, punctuality_rating, attitude_rating, skill_rating, comments, reviewer_name, status, review_notes, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  stmt5.run(evaluationId1, scheduleId1, 5, 5, 4, 5, '王阿姨很专业，做饭好吃，照顾老人也很细心，就是稍微有点迟到', '张女士', 'approved', '评价已复核通过', '2025-05-20 18:00:00');
  stmt5.finalize();
  console.log('已插入1个评价数据');

  const stmt6 = db.prepare('INSERT INTO conversion_conclusions (id, trial_schedule_id, evaluation_id, result, salary_proposal, start_date, contract_terms, notes, status, exported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  stmt6.run(conclusionId1, scheduleId1, evaluationId1, 'hire', 6500.00, '2025-06-01', '试用期1个月，转正后缴纳社保，月休4天', '客户满意，建议录用', 'approved', '2025-05-21 10:00:00');
  stmt6.finalize();
  console.log('已插入1个转正结论数据');

  const now = new Date().toISOString();
  const stmt7 = db.prepare('INSERT INTO processing_records (id, operation_type, reference_id, reference_type, input_data, processing_result, status, error_message, operator, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  stmt7.run(uuidv4(), 'create_customer', customerId1, 'customer', JSON.stringify({ name: '张女士' }), JSON.stringify({ success: true }), 'success', null, 'admin', now);
  stmt7.run(uuidv4(), 'create_worker', workerId1, 'worker', JSON.stringify({ name: '王阿姨' }), JSON.stringify({ success: true }), 'success', null, 'admin', now);
  stmt7.run(uuidv4(), 'create_schedule', scheduleId1, 'trial_schedule', JSON.stringify({ scheduled_date: '2025-05-20' }), JSON.stringify({ success: true }), 'success', null, 'admin', now);
  stmt7.finalize();
  console.log('已插入3个处理记录数据');
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('示例数据导入完成！');
  console.log('');
  console.log('数据摘要:');
  console.log(`- 客户ID1: ${customerId1}`);
  console.log(`- 阿姨ID1: ${workerId1}`);
  console.log(`- 试工安排ID1: ${scheduleId1}`);
  console.log(`- 评价ID1: ${evaluationId1}`);
  console.log(`- 转正结论ID1: ${conclusionId1}`);
});
