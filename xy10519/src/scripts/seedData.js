const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const DB_PATH = path.join(__dirname, '../../data/database.db');
const db = new sqlite3.Database(DB_PATH);

const now = () => dayjs().toISOString();

const users = [
  {
    id: uuidv4(),
    name: '张三（新学员）',
    phone: '13800138001',
    is_old_student: 0,
    old_student_discount_rate: 0,
  },
  {
    id: uuidv4(),
    name: '李四（老学员，95折）',
    phone: '13800138002',
    is_old_student: 1,
    old_student_discount_rate: 5,
  },
  {
    id: uuidv4(),
    name: '王五（老学员，9折）',
    phone: '13800138003',
    is_old_student: 1,
    old_student_discount_rate: 10,
  },
];

const courses = [
  {
    id: uuidv4(),
    name: 'Python 全栈开发实战',
    original_price: 999,
    description: '从入门到精通的 Python 全栈课程',
    category: '编程开发',
  },
  {
    id: uuidv4(),
    name: '前端 React 进阶课程',
    original_price: 1999,
    description: '深入学习 React 生态和性能优化',
    category: '前端开发',
  },
  {
    id: uuidv4(),
    name: '数据分析与可视化',
    original_price: 1599,
    description: '掌握 Pandas、NumPy 和数据可视化技巧',
    category: '数据科学',
  },
  {
    id: uuidv4(),
    name: '人工智能入门到实战',
    original_price: 3999,
    description: 'AI 基础、机器学习和深度学习实践',
    category: '人工智能',
  },
];

const coupons = [
  {
    id: uuidv4(),
    code: 'NEW100',
    name: '新学员立减100元',
    type: 'fixed',
    value: 100,
    min_spend: 500,
    is_stackable: 0,
    total_stock: 100,
    used_count: 0,
    start_time: dayjs().subtract(7, 'day').toISOString(),
    end_time: dayjs().add(30, 'day').toISOString(),
  },
  {
    id: uuidv4(),
    code: 'VIP10OFF',
    name: 'VIP 9折优惠券',
    type: 'percentage',
    value: 10,
    min_spend: 1000,
    max_discount: 500,
    is_stackable: 0,
    total_stock: 50,
    used_count: 0,
    start_time: dayjs().subtract(7, 'day').toISOString(),
    end_time: dayjs().add(60, 'day').toISOString(),
  },
  {
    id: uuidv4(),
    code: 'STACK50',
    name: '可叠加50元优惠券',
    type: 'fixed',
    value: 50,
    min_spend: 0,
    is_stackable: 1,
    total_stock: 200,
    used_count: 0,
    start_time: dayjs().subtract(7, 'day').toISOString(),
    end_time: dayjs().add(30, 'day').toISOString(),
    applicable_course_ids: JSON.stringify([]),
  },
  {
    id: uuidv4(),
    code: 'AI200',
    name: 'AI课程专属200元券',
    type: 'fixed',
    value: 200,
    min_spend: 3000,
    is_stackable: 0,
    total_stock: 30,
    used_count: 0,
    start_time: dayjs().subtract(7, 'day').toISOString(),
    end_time: dayjs().add(60, 'day').toISOString(),
    applicable_course_ids: JSON.stringify([]),
  },
];

const groupBuys = [
  {
    id: uuidv4(),
    course_id: courses[0].id,
    name: 'Python 课程限时团购',
    group_price: 799,
    min_people: 2,
    current_people: 1,
    lock_duration_minutes: 30,
    start_time: dayjs().subtract(1, 'day').toISOString(),
    end_time: dayjs().add(7, 'day').toISOString(),
    status: 'active',
  },
  {
    id: uuidv4(),
    course_id: courses[1].id,
    name: 'React 课程拼团特惠',
    group_price: 1599,
    min_people: 3,
    current_people: 0,
    lock_duration_minutes: 60,
    start_time: dayjs().subtract(1, 'day').toISOString(),
    end_time: dayjs().add(14, 'day').toISOString(),
    status: 'active',
  },
  {
    id: uuidv4(),
    course_id: courses[3].id,
    name: 'AI 课程超级团购',
    group_price: 3299,
    min_people: 5,
    current_people: 2,
    lock_duration_minutes: 120,
    start_time: dayjs().subtract(1, 'day').toISOString(),
    end_time: dayjs().add(30, 'day').toISOString(),
    status: 'active',
  },
];

coupons[3].applicable_course_ids = JSON.stringify([courses[3].id]);

db.serialize(() => {
  console.log('开始插入样例数据...');
  
  const insertUser = db.prepare('INSERT INTO users (id, name, phone, is_old_student, old_student_discount_rate, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  users.forEach(user => {
    insertUser.run(user.id, user.name, user.phone, user.is_old_student, user.old_student_discount_rate, now(), now());
    console.log(`✓ 用户: ${user.name}`);
  });
  insertUser.finalize();
  
  const insertCourse = db.prepare('INSERT INTO courses (id, name, original_price, description, category, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  courses.forEach(course => {
    insertCourse.run(course.id, course.name, course.original_price, course.description, course.category, 1, now(), now());
    console.log(`✓ 课程: ${course.name} (${course.original_price}元)`);
  });
  insertCourse.finalize();
  
  const insertCoupon = db.prepare('INSERT INTO coupons (id, code, name, type, value, min_spend, max_discount, applicable_course_ids, is_stackable, total_stock, used_count, start_time, end_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  coupons.forEach(coupon => {
    insertCoupon.run(coupon.id, coupon.code, coupon.name, coupon.type, coupon.value, coupon.min_spend, coupon.max_discount || null, coupon.applicable_course_ids || null, coupon.is_stackable, coupon.total_stock, coupon.used_count, coupon.start_time, coupon.end_time, now(), now());
    console.log(`✓ 优惠券: ${coupon.name} (${coupon.code})`);
  });
  insertCoupon.finalize();
  
  const insertGroupBuy = db.prepare('INSERT INTO group_buys (id, course_id, name, group_price, min_people, current_people, lock_duration_minutes, start_time, end_time, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  groupBuys.forEach(gb => {
    insertGroupBuy.run(gb.id, gb.course_id, gb.name, gb.group_price, gb.min_people, gb.current_people, gb.lock_duration_minutes, gb.start_time, gb.end_time, gb.status, now(), now());
    console.log(`✓ 团购: ${gb.name} (${gb.group_price}元)`);
  });
  insertGroupBuy.finalize();
  
  console.log('\n========================================');
  console.log('样例数据插入完成！');
  console.log('========================================');
  console.log('\n可用测试数据 ID:');
  console.log('\n【用户】');
  users.forEach(u => console.log(`  ${u.name}: ${u.id}`));
  console.log('\n【课程】');
  courses.forEach(c => console.log(`  ${c.name}: ${c.id}`));
  console.log('\n【优惠券】');
  coupons.forEach(c => console.log(`  ${c.name} (${c.code}): ${c.id}`));
  console.log('\n【团购活动】');
  groupBuys.forEach(g => console.log(`  ${g.name}: ${g.id}`));
});

db.close();
