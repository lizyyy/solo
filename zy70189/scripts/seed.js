const { initDatabase, getConnection } = require('../src/database');
const fs = require('fs');
const path = require('path');

async function run() {
  await initDatabase();
  const db = getConnection();

const now = Math.floor(Date.now() / 1000);

console.log('== 开始初始化种子数据 ==');

try {
  const dbPath = path.join(__dirname, '..', 'refund_permission.db');
  if (fs.existsSync(dbPath)) {
    console.log('注意: 数据库文件已存在，将追加数据');
  }

  const staff = [
    { id: 'staff_junior_01', name: '李客服', level: 'junior', is_active: 1 },
    { id: 'staff_inter_01', name: '王客服', level: 'intermediate', is_active: 1 },
    { id: 'staff_senior_01', name: '张客服', level: 'senior', is_active: 1 },
    { id: 'staff_super_01', name: '刘主管', level: 'supervisor', is_active: 1 },
    { id: 'staff_manager_01', name: '赵经理', level: 'manager', is_active: 1 },
    { id: 'staff_director_01', name: '陈总监', level: 'director', is_active: 1 },
    { id: 'staff_inactive_01', name: '已离职', level: 'junior', is_active: 0 }
  ];

  const insertStaff = db.prepare(`
    INSERT OR IGNORE INTO staff (id, name, level, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  console.log('\n--- 插入员工数据 ---');
  staff.forEach(s => {
    insertStaff.run(s.id, s.name, s.level, s.is_active, now, now);
    console.log(`  员工: ${s.name} (${s.level})`);
  });

  const categories = [
    { code: 'ELECTRONICS', name: '电子数码', refundable: 1, ratio: 0.85, special: 0 },
    { code: 'CLOTHING', name: '服装服饰', refundable: 1, ratio: 1, special: 0 },
    { code: 'FOOD', name: '食品生鲜', refundable: 0, ratio: 0, special: 0 },
    { code: 'LUXURY', name: '奢侈品', refundable: 1, ratio: 0.5, special: 1 },
    { code: 'DEFAULT', name: '其他商品', refundable: 1, ratio: 1, special: 0 }
  ];

  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO category_rules 
    (category_code, category_name, is_refundable, max_refund_ratio, special_approval_required, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  console.log('\n--- 插入品类规则 ---');
  categories.forEach(c => {
    insertCategory.run(c.code, c.name, c.refundable, c.ratio, c.special, now, now);
    console.log(`  品类: ${c.code} - ${c.name}`);
    console.log(`    可退款: ${c.refundable ? '是' : '否'}, 退款比例: ${c.ratio * 100}%, 特殊审批: ${c.special ? '是' : '否'}`);
  });

  const limits = [
    { level: 'junior', category: null, amount: 0 },
    { level: 'intermediate', category: null, amount: 500 },
    { level: 'senior', category: null, amount: 2000 },
    { level: 'supervisor', category: null, amount: 5000 },
    { level: 'manager', category: null, amount: 10000 },
    { level: 'director', category: null, amount: null },
    { level: 'senior', category: 'ELECTRONICS', amount: 1000 }
  ];

  const insertLimit = db.prepare(`
    INSERT OR IGNORE INTO refund_limits 
    (staff_level, category, max_amount, effective_from, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  console.log('\n--- 插入退款额度 ---');
  limits.forEach(l => {
    const amountText = l.amount === null ? '无限制' : `¥${l.amount}`;
    const categoryText = l.category || '默认';
    insertLimit.run(l.level, l.category, l.amount, now, now, now);
    console.log(`  ${l.level} - ${categoryText}: ${amountText}`);
  });

  const permissions = [
    { level: 'junior', action: 'view', allowed: 1 },
    { level: 'junior', action: 'refund', allowed: 0 },
    { level: 'intermediate', action: 'view', allowed: 1 },
    { level: 'intermediate', action: 'refund', allowed: 1 },
    { level: 'senior', action: 'view', allowed: 1 },
    { level: 'senior', action: 'refund', allowed: 1 },
    { level: 'supervisor', action: 'view', allowed: 1 },
    { level: 'supervisor', action: 'refund', allowed: 1 },
    { level: 'supervisor', action: 'approve', allowed: 1 },
    { level: 'manager', action: 'view', allowed: 1 },
    { level: 'manager', action: 'refund', allowed: 1 },
    { level: 'manager', action: 'approve', allowed: 1 },
    { level: 'director', action: 'view', allowed: 1 },
    { level: 'director', action: 'refund', allowed: 1 },
    { level: 'director', action: 'approve', allowed: 1 },
    { level: 'director', action: 'manual_fix', allowed: 1 }
  ];

  const insertPermission = db.prepare(`
    INSERT OR IGNORE INTO permission_matrix 
    (staff_level, action, is_allowed, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  console.log('\n--- 插入权限矩阵 ---');
  permissions.forEach(p => {
    insertPermission.run(p.level, p.action, p.allowed, now, now);
    console.log(`  ${p.level} - ${p.action}: ${p.allowed ? '允许' : '拒绝'}`);
  });

  console.log('\n== 种子数据初始化完成 ==');
  console.log('\n员工账号速查:');
  console.log('  初级客服: staff_junior_01 (额度: ¥0)');
  console.log('  中级客服: staff_inter_01 (额度: ¥500)');
  console.log('  高级客服: staff_senior_01 (额度: ¥2000)');
  console.log('  主管    : staff_super_01 (额度: ¥5000, 可审批)');
  console.log('  经理    : staff_manager_01 (额度: ¥10000, 可审批)');
  console.log('  总监    : staff_director_01 (额度: 无限制, 可审批)');

  console.log('\n品类说明:');
  console.log('  ELECTRONICS: 电子数码, 可退款85%, 高级客服额度降为¥1000');
  console.log('  CLOTHING   : 服装服饰, 可全额退款');
  console.log('  FOOD       : 食品生鲜, 不可退款');
  console.log('  LUXURY     : 奢侈品, 可退款50%, 需要特殊审批');

} catch (err) {
  console.error('初始化种子数据失败:', err.message);
  process.exit(1);
}
}

run().catch(err => {
  console.error('执行失败:', err.message);
  process.exit(1);
});
