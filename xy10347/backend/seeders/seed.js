const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

console.log('开始创建测试数据...');

// 清空现有数据
db.serialize(() => {
  db.run('DELETE FROM refunds');
  db.run('DELETE FROM price_change_requests');
  db.run('DELETE FROM orders');
  db.run('DELETE FROM settlements');
  db.run('DELETE FROM team_leaders');
  db.run('DELETE FROM courses');

  // 重置自增ID
  db.run('DELETE FROM sqlite_sequence WHERE name IN ("team_leaders", "courses", "settlements", "price_change_requests", "refunds")');

  // 创建团长
  const leaders = [
    { name: '张三', phone: '13800138001', commission_rate: 0.25 },
    { name: '李四', phone: '13800138002', commission_rate: 0.20 },
    { name: '王五', phone: '13800138003', commission_rate: 0.30 },
    { name: '赵六', phone: '13800138004', commission_rate: 0.20 },
    { name: '钱七', phone: '13800138005', commission_rate: 0.25 }
  ];

  const leaderStmt = db.prepare('INSERT INTO team_leaders (name, phone, commission_rate) VALUES (?, ?, ?)');
  leaders.forEach(leader => {
    leaderStmt.run(leader.name, leader.phone, leader.commission_rate);
  });
  leaderStmt.finalize();

  // 创建课程
  const courses = [
    { name: 'Python入门课程', original_price: 999 },
    { name: 'Java实战课程', original_price: 1999 },
    { name: '前端开发课程', original_price: 1499 },
    { name: '数据分析课程', original_price: 1299 },
    { name: '人工智能基础', original_price: 2999 }
  ];

  const courseStmt = db.prepare('INSERT INTO courses (name, original_price) VALUES (?, ?)');
  courses.forEach(course => {
    courseStmt.run(course.name, course.original_price);
  });
  courseStmt.finalize();

  // 创建订单
  const orders = [
    {
      id: uuidv4(),
      course_name: 'Python入门课程',
      student_name: '小明',
      student_phone: '13900139001',
      original_price: 999,
      final_price: 999,
      payment_time: '2024-01-15 10:30:00',
      team_leader_id: 1,
      team_leader_name: '张三',
      commission_rate: 0.25,
      commission_amount: 249.75,
      status: 'paid',
      settlement_period: '2024-01'
    },
    {
      id: uuidv4(),
      course_name: 'Java实战课程',
      student_name: '小红',
      student_phone: '13900139002',
      original_price: 1999,
      final_price: 1999,
      payment_time: '2024-01-18 14:20:00',
      team_leader_id: 2,
      team_leader_name: '李四',
      commission_rate: 0.20,
      commission_amount: 399.80,
      status: 'paid',
      settlement_period: '2024-01'
    },
    {
      id: uuidv4(),
      course_name: '前端开发课程',
      student_name: '小华',
      student_phone: '13900139003',
      original_price: 1499,
      final_price: 1499,
      payment_time: '2024-01-20 09:15:00',
      team_leader_id: 1,
      team_leader_name: '张三',
      commission_rate: 0.25,
      commission_amount: 374.75,
      status: 'paid',
      settlement_period: '2024-01'
    },
    {
      id: uuidv4(),
      course_name: '数据分析课程',
      student_name: '小刚',
      student_phone: '13900139004',
      original_price: 1299,
      final_price: 1299,
      payment_time: '2024-01-22 16:45:00',
      team_leader_id: 3,
      team_leader_name: '王五',
      commission_rate: 0.30,
      commission_amount: 389.70,
      status: 'paid',
      settlement_period: '2024-01'
    },
    {
      id: uuidv4(),
      course_name: 'Python入门课程',
      student_name: '小美',
      student_phone: '13900139005',
      original_price: 999,
      final_price: 999,
      payment_time: '2024-01-25 11:00:00',
      team_leader_id: 4,
      team_leader_name: '赵六',
      commission_rate: 0.20,
      commission_amount: 199.80,
      status: 'paid',
      settlement_period: '2024-01'
    },
    {
      id: uuidv4(),
      course_name: '人工智能基础',
      student_name: '小强',
      student_phone: '13900139006',
      original_price: 2999,
      final_price: 2999,
      payment_time: '2024-02-01 08:30:00',
      team_leader_id: 1,
      team_leader_name: '张三',
      commission_rate: 0.25,
      commission_amount: 749.75,
      status: 'paid',
      settlement_period: '2024-02'
    },
    {
      id: uuidv4(),
      course_name: 'Java实战课程',
      student_name: '小丽',
      student_phone: '13900139007',
      original_price: 1999,
      final_price: 1999,
      payment_time: '2024-02-05 15:20:00',
      team_leader_id: 2,
      team_leader_name: '李四',
      commission_rate: 0.20,
      commission_amount: 399.80,
      status: 'paid',
      settlement_period: '2024-02'
    },
    {
      id: uuidv4(),
      course_name: '前端开发课程',
      student_name: '小伟',
      student_phone: '13900139008',
      original_price: 1499,
      final_price: 1499,
      payment_time: '2024-02-10 10:45:00',
      team_leader_id: 3,
      team_leader_name: '王五',
      commission_rate: 0.30,
      commission_amount: 449.70,
      status: 'paid',
      settlement_period: '2024-02'
    },
    {
      id: uuidv4(),
      course_name: '数据分析课程',
      student_name: '小芳',
      student_phone: '13900139009',
      original_price: 1299,
      final_price: 1299,
      payment_time: '2024-02-12 14:00:00',
      team_leader_id: 5,
      team_leader_name: '钱七',
      commission_rate: 0.25,
      commission_amount: 324.75,
      status: 'paid',
      settlement_period: '2024-02'
    },
    {
      id: uuidv4(),
      course_name: 'Python入门课程',
      student_name: '小军',
      student_phone: '13900139010',
      original_price: 999,
      final_price: 999,
      payment_time: '2024-02-18 09:30:00',
      team_leader_id: 4,
      team_leader_name: '赵六',
      commission_rate: 0.20,
      commission_amount: 199.80,
      status: 'paid',
      settlement_period: '2024-02'
    }
  ];

  const orderStmt = db.prepare(`
    INSERT INTO orders (
      id, course_name, student_name, student_phone, original_price, final_price,
      payment_time, team_leader_id, team_leader_name, commission_rate,
      commission_amount, status, refund_amount, is_settled, settlement_period
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  `);

  orders.forEach(order => {
    orderStmt.run(
      order.id, order.course_name, order.student_name, order.student_phone,
      order.original_price, order.final_price, order.payment_time,
      order.team_leader_id, order.team_leader_name, order.commission_rate,
      order.commission_amount, order.status, order.settlement_period
    );
  });

  orderStmt.finalize();

  console.log('测试数据创建完成！');
  console.log('');
  console.log('创建的数据统计：');
  console.log('- 团长: 5 个');
  console.log('- 课程: 5 门');
  console.log('- 订单: 10 个');
  console.log('');
  console.log('订单分布：');
  console.log('- 2024年1月: 5 单');
  console.log('- 2024年2月: 5 单');
  console.log('');
  console.log('团长信息：');
  console.log('- 张三 (25%返佣): 3 单');
  console.log('- 李四 (20%返佣): 2 单');
  console.log('- 王五 (30%返佣): 2 单');
  console.log('- 赵六 (20%返佣): 2 单');
  console.log('- 钱七 (25%返佣): 1 单');

  // 关闭数据库
  setTimeout(() => {
    db.close();
  }, 1000);
});
