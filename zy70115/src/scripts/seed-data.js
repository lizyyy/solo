const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../kitchen.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('无法打开数据库:', err.message);
    return;
  }
  console.log('开始填充测试数据...');

  db.serialize(() => {
    const stmt1 = db.prepare('INSERT INTO schools (name, address, contact_person, contact_phone) VALUES (?, ?, ?, ?)');
    stmt1.run('阳光小学', '人民路123号', '王校长', '13800138001');
    stmt1.run('星星中学', '文化路456号', '李主任', '13800138002');
    stmt1.run('快乐幼儿园', '幸福路789号', '张园长', '13800138003');
    stmt1.finalize();

    const stmt2 = db.prepare('INSERT INTO classes (school_id, name, student_count, teacher_count) VALUES (?, ?, ?, ?)');
    stmt2.run(1, '一年级1班', 45, 2);
    stmt2.run(1, '一年级2班', 42, 2);
    stmt2.run(1, '二年级1班', 40, 2);
    stmt2.run(2, '初一1班', 50, 3);
    stmt2.run(2, '初一2班', 48, 3);
    stmt2.run(3, '小班', 30, 4);
    stmt2.run(3, '中班', 35, 4);
    stmt2.finalize();

    const stmt3 = db.prepare('INSERT INTO delivery_routes (name, stop_order, max_capacity, driver_name, vehicle_number, status) VALUES (?, ?, ?, ?, ?, ?)');
    stmt3.run('东线A', '1,2', 200, '陈师傅', '京A12345', 'active');
    stmt3.run('西线B', '3', 150, '刘师傅', '京A67890', 'active');
    stmt3.finalize();

    const stmt4 = db.prepare('INSERT INTO route_stops (route_id, school_id, order_no, estimated_arrival) VALUES (?, ?, ?, ?)');
    stmt4.run(1, 1, 1, '07:30');
    stmt4.run(1, 2, 2, '08:00');
    stmt4.run(2, 3, 1, '07:15');
    stmt4.finalize();

    const stmt5 = db.prepare('INSERT INTO allergen_rules (school_id, class_id, allergen_type, description, affected_student_count, status) VALUES (?, ?, ?, ?, ?, ?)');
    stmt5.run(1, 1, '牛奶', '对牛奶蛋白过敏', 2, 'active');
    stmt5.run(1, 2, '鸡蛋', '对鸡蛋过敏', 1, 'active');
    stmt5.run(2, null, '坚果', '全校坚果过敏学生', 5, 'active');
    stmt5.run(3, 6, '海鲜', '小班海鲜过敏', 1, 'active');
    stmt5.finalize();

    console.log('测试数据填充完成');
  });

  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('数据库连接已关闭');
  });
});
