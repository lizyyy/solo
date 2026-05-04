const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'repair.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 插入示例客户数据
  const customers = [
    ['张明', '13800138001', 'zhangming@example.com', '北京市朝阳区', '老客户，对修复要求高'],
    ['李华', '13900139002', 'lihua@example.com', '上海市浦东新区', '首次合作，需要详细沟通'],
    ['王芳', '13700137003', 'wangfang@example.com', '广州市天河区', '家族传家宝，非常重视']
  ];

  const insertCustomer = db.prepare('INSERT INTO customers (name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?)');
  customers.forEach(customer => {
    insertCustomer.run(customer);
  });
  insertCustomer.finalize();

  // 插入示例器物数据
  const artifacts = [
    [1, '清代青花瓷瓶', '瓷器', '清代', '瓷', '高30cm，口径10cm', '瓶口有轻微裂纹，底部有磨损', '修复中', '2026-05-20'],
    [2, '明代木雕观音像', '木雕', '明代', '楠木', '高45cm，宽20cm', '手部有缺损，表面有污渍', '待评估', '2026-05-25'],
    [3, '民国铜香炉', '铜器', '民国', '黄铜', '直径15cm，高12cm', '表面有铜锈，盖子有变形', '待客户确认', '2026-05-15'],
    [1, '宋代玉璧', '玉器', '宋代', '和田玉', '直径8cm，厚0.5cm', '表面有轻微划痕，边缘有小缺角', '已交付', '2026-04-30']
  ];

  const insertArtifact = db.prepare('INSERT INTO artifacts (customer_id, name, type, era, material, size, damage_description, current_status, estimated_completion_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  artifacts.forEach(artifact => {
    insertArtifact.run(artifact);
  });
  insertArtifact.finalize();

  // 插入示例状态日志
  const statusLogs = [
    [1, '待评估', '客户提交委托，等待评估', '张师傅'],
    [1, '评估中', '开始评估器物损伤情况', '张师傅'],
    [1, '报价确认', '已向客户报价，等待确认', '李助理'],
    [1, '修复中', '客户确认报价，开始修复工作', '张师傅'],
    [2, '待评估', '客户提交委托，等待评估', '李助理'],
    [3, '待评估', '客户提交委托，等待评估', '张师傅'],
    [3, '评估中', '开始评估器物损伤情况', '张师傅'],
    [3, '报价确认', '已向客户报价，等待确认', '李助理'],
    [3, '待客户确认', '修复完成，等待客户确认', '张师傅'],
    [4, '待评估', '客户提交委托，等待评估', '张师傅'],
    [4, '评估中', '开始评估器物损伤情况', '张师傅'],
    [4, '报价确认', '已向客户报价，等待确认', '李助理'],
    [4, '修复中', '客户确认报价，开始修复工作', '张师傅'],
    [4, '已交付', '客户确认满意，完成交付', '李助理']
  ];

  const insertStatusLog = db.prepare('INSERT INTO status_logs (artifact_id, status, description, operator) VALUES (?, ?, ?, ?)');
  statusLogs.forEach(log => {
    insertStatusLog.run(log);
  });
  insertStatusLog.finalize();

  // 插入示例报价
  const quotes = [
    [1, 5000, '青花瓷瓶修复费用，包括裂纹修复和底部打磨', '已确认'],
    [2, 0, '待评估', '待确认'],
    [3, 3000, '铜香炉修复费用，包括除锈和盖子整形', '待确认'],
    [4, 2500, '玉璧修复费用，包括划痕修复和边缘打磨', '已确认']
  ];

  const insertQuote = db.prepare('INSERT INTO quotes (artifact_id, amount, description, status) VALUES (?, ?, ?, ?)');
  quotes.forEach(quote => {
    insertQuote.run(quote);
  });
  insertQuote.finalize();

  // 插入示例提醒
  const reminders = [
    [1, '跟进修复进度', '青花瓷瓶修复进度需要跟进，预计5月20日完成', '2026-05-18', '待处理'],
    [3, '联系客户确认', '铜香炉已修复完成，需要联系客户确认', '2026-05-10', '已超期']
  ];

  const insertReminder = db.prepare('INSERT INTO reminders (artifact_id, title, description, reminder_date, status) VALUES (?, ?, ?, ?, ?)');
  reminders.forEach(reminder => {
    insertReminder.run(reminder);
  });
  insertReminder.finalize();

  console.log('示例数据插入完成');
});

db.close();
