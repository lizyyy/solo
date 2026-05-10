const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/dues.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

function initDatabase() {
  console.log('开始初始化数据库...');
  
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      real_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin', 'manager', 'staff')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✓ 用户表创建成功');

  db.exec(`
    CREATE TABLE IF NOT EXISTS membership_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level_name TEXT NOT NULL,
      level_code TEXT NOT NULL UNIQUE,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✓ 会员等级表创建成功');

  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_code TEXT NOT NULL UNIQUE,
      company_name TEXT NOT NULL,
      legal_person TEXT,
      contact_person TEXT,
      contact_phone TEXT,
      address TEXT,
      industry TEXT,
      member_level_id INTEGER NOT NULL,
      is_small_enterprise INTEGER DEFAULT 0,
      join_date DATE NOT NULL,
      expiry_date DATE,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'resigned')),
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_level_id) REFERENCES membership_levels(id)
    )
  `);
  console.log('✓ 会员表创建成功');

  db.exec(`
    CREATE TABLE IF NOT EXISTS fee_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_name TEXT NOT NULL,
      member_level_id INTEGER NOT NULL,
      fee_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
      effective_year INTEGER NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_level_id) REFERENCES membership_levels(id),
      UNIQUE(member_level_id, effective_year)
    )
  `);
  console.log('✓ 会费规则表创建成功');

  db.exec(`
    CREATE TABLE IF NOT EXISTS reduction_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_code TEXT NOT NULL UNIQUE,
      member_id INTEGER NOT NULL,
      fee_year INTEGER NOT NULL,
      original_amount DECIMAL(12, 2) NOT NULL,
      request_type TEXT NOT NULL DEFAULT 'percentage' CHECK(request_type IN ('percentage', 'fixed')),
      request_value DECIMAL(10, 2) NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'cancelled')),
      approved_by INTEGER,
      approved_at DATETIME,
      approval_comment TEXT,
      applied_amount DECIMAL(12, 2) DEFAULT 0,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (approved_by) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);
  console.log('✓ 减免申请表创建成功');

  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_no TEXT NOT NULL UNIQUE,
      member_id INTEGER NOT NULL,
      fee_year INTEGER NOT NULL,
      original_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
      reduction_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
      paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
      payment_method TEXT,
      payment_date DATE,
      remark TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'refunded')),
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);
  console.log('✓ 缴费记录表创建成功');

  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT NOT NULL UNIQUE,
      setting_value TEXT,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✓ 系统设置表创建成功');

  console.log('\n开始插入初始数据...');

  const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (usersCount === 0) {
    const hashedPassword = bcrypt.hashSync('123456', 10);
    const insertUser = db.prepare(`
      INSERT INTO users (username, password, real_name, role) VALUES (?, ?, ?, ?)
    `);
    insertUser.run('admin', hashedPassword, '系统管理员', 'admin');
    insertUser.run('manager', hashedPassword, '张经理', 'manager');
    insertUser.run('staff', hashedPassword, '李员工', 'staff');
    console.log('✓ 初始用户数据插入成功 (用户名: admin/manager/staff, 密码: 123456)');
  }

  const levelsCount = db.prepare('SELECT COUNT(*) as count FROM membership_levels').get().count;
  if (levelsCount === 0) {
    const insertLevel = db.prepare(`
      INSERT INTO membership_levels (level_name, level_code, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?)
    `);
    insertLevel.run('会长单位', 'PRESIDENT', '理事会会长单位', 1, 1);
    insertLevel.run('副会长单位', 'VICE_PRESIDENT', '理事会副会长单位', 2, 1);
    insertLevel.run('常务理事单位', 'STANDING_DIRECTOR', '理事会常务理事单位', 3, 1);
    insertLevel.run('理事单位', 'DIRECTOR', '理事会理事单位', 4, 1);
    insertLevel.run('会员单位', 'MEMBER', '普通会员单位', 5, 1);
    console.log('✓ 会员等级数据插入成功');
  }

  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM system_settings').get().count;
  if (settingsCount === 0) {
    const insertSetting = db.prepare(`
      INSERT INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?)
    `);
    insertSetting.run('max_reduction_percentage', '100', '最大减免比例(%)');
    insertSetting.run('small_enterprise_discount', '50', '小微企业默认减免比例(%)');
    insertSetting.run('reminder_days_before', '30', '到期前多少天开始催缴');
    insertSetting.run('reminder_interval_days', '15', '催缴间隔天数');
    console.log('✓ 系统设置数据插入成功');
  }

  const rulesCount = db.prepare('SELECT COUNT(*) as count FROM fee_rules').get().count;
  if (rulesCount === 0) {
    const insertRule = db.prepare(`
      INSERT INTO fee_rules (rule_name, member_level_id, fee_amount, effective_year, description) VALUES (?, ?, ?, ?, ?)
    `);
    insertRule.run('2025年度会长单位会费', 1, 50000.00, 2025, '2025年度会长单位会费标准');
    insertRule.run('2025年度副会长单位会费', 2, 30000.00, 2025, '2025年度副会长单位会费标准');
    insertRule.run('2025年度常务理事单位会费', 3, 15000.00, 2025, '2025年度常务理事单位会费标准');
    insertRule.run('2025年度理事单位会费', 4, 8000.00, 2025, '2025年度理事单位会费标准');
    insertRule.run('2025年度会员单位会费', 5, 3000.00, 2025, '2025年度会员单位会费标准');
    insertRule.run('2026年度会长单位会费', 1, 50000.00, 2026, '2026年度会长单位会费标准');
    insertRule.run('2026年度副会长单位会费', 2, 30000.00, 2026, '2026年度副会长单位会费标准');
    insertRule.run('2026年度常务理事单位会费', 3, 15000.00, 2026, '2026年度常务理事单位会费标准');
    insertRule.run('2026年度理事单位会费', 4, 8000.00, 2026, '2026年度理事单位会费标准');
    insertRule.run('2026年度会员单位会费', 5, 3000.00, 2026, '2026年度会员单位会费标准');
    console.log('✓ 会费规则数据插入成功');
  }

  const membersCount = db.prepare('SELECT COUNT(*) as count FROM members').get().count;
  if (membersCount === 0) {
    const insertMember = db.prepare(`
      INSERT INTO members (member_code, company_name, legal_person, contact_person, contact_phone, address, industry, member_level_id, is_small_enterprise, join_date, expiry_date, status, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertMember.run('HY001', '宏图科技发展有限公司', '王建国', '李秘书', '13800138001', '北京市朝阳区建国路88号', '信息技术', 1, 0, '2020-03-15', '2026-12-31', 'active', '会长单位，连续多年优秀会员');
    insertMember.run('HY002', '昌盛投资集团有限公司', '赵昌盛', '钱主任', '13800138002', '上海市浦东新区世纪大道100号', '金融投资', 2, 0, '2019-06-20', '2026-12-31', 'active', '副会长单位，支持商会活动');
    insertMember.run('HY003', '东方制造有限公司', '孙东方', '周经理', '13800138003', '广州市天河区中山大道123号', '制造业', 2, 0, '2021-01-10', '2026-12-31', 'active', '副会长单位');
    insertMember.run('HY004', '创新科技有限公司', '吴创新', '郑主管', '13800138004', '深圳市南山区科技园', '信息技术', 3, 0, '2020-09-05', '2026-06-30', 'active', '常务理事，高新技术企业');
    insertMember.run('HY005', '绿色农业发展有限公司', '冯绿色', '陈经理', '13800138005', '成都市锦江区春熙路', '农业', 3, 1, '2022-04-18', '2026-04-18', 'active', '常务理事，小微企业');
    insertMember.run('HY006', '智慧物流有限公司', '褚智慧', '卫总监', '13800138006', '杭州市西湖区文三路', '物流', 4, 0, '2021-11-22', '2026-11-22', 'active', '理事单位');
    insertMember.run('HY007', '健康医药有限公司', '蒋健康', '沈经理', '13800138007', '南京市鼓楼区中山路', '医药', 4, 1, '2023-02-14', '2027-02-14', 'active', '理事单位，小微企业');
    insertMember.run('HY008', '阳光建材有限公司', '韩阳光', '杨主管', '13800138008', '武汉市武昌区武珞路', '建材', 5, 1, '2023-07-30', '2026-07-30', 'active', '普通会员，小微企业');
    insertMember.run('HY009', '蓝天环保科技有限公司', '朱蓝天', '秦经理', '13800138009', '西安市雁塔区高新路', '环保', 5, 0, '2024-01-05', '2027-01-05', 'active', '新会员');
    insertMember.run('HY010', '鸿运贸易有限公司', '尤鸿运', '许总监', '13800138010', '天津市和平区南京路', '贸易', 5, 1, '2018-08-15', '2025-08-15', 'inactive', '已暂停缴费，待联系');
    insertMember.run('HY011', '星光文化传媒有限公司', '何星光', '吕经理', '13800138011', '重庆市渝中区解放碑', '文化传媒', 5, 0, '2019-12-20', '2024-12-20', 'resigned', '已退会，不再催缴');
    insertMember.run('HY012', '精工机械有限公司', '施精工', '张工', '13800138012', '苏州市工业园区', '机械制造', 4, 0, '2020-05-10', '2026-05-10', 'active', '理事单位');
    console.log('✓ 会员样例数据插入成功');
  }

  const paymentsCount = db.prepare('SELECT COUNT(*) as count FROM payments').get().count;
  if (paymentsCount === 0) {
    const insertPayment = db.prepare(`
      INSERT INTO payments (payment_no, member_id, fee_year, original_amount, reduction_amount, paid_amount, payment_method, payment_date, remark, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertPayment.run('PAY2025001', 1, 2025, 50000.00, 0.00, 50000.00, '银行转账', '2025-01-15', '会长单位2025年度会费', 'paid', 1);
    insertPayment.run('PAY2025002', 2, 2025, 30000.00, 0.00, 30000.00, '银行转账', '2025-02-20', '副会长单位2025年度会费', 'paid', 1);
    insertPayment.run('PAY2025003', 4, 2025, 15000.00, 0.00, 15000.00, '支票', '2025-03-10', '常务理事2025年度会费', 'paid', 2);
    insertPayment.run('PAY2025004', 6, 2025, 8000.00, 0.00, 8000.00, '银行转账', '2025-04-05', '理事单位2025年度会费', 'paid', 2);
    insertPayment.run('PAY2025005', 9, 2025, 3000.00, 0.00, 3000.00, '现金', '2025-02-28', '新会员2025年度会费', 'paid', 3);
    insertPayment.run('PAY2025006', 12, 2025, 8000.00, 4000.00, 4000.00, '银行转账', '2025-05-20', '理事单位2025年度会费(减免50%)', 'paid', 2);
    console.log('✓ 缴费记录样例数据插入成功');
  }

  const requestsCount = db.prepare('SELECT COUNT(*) as count FROM reduction_requests').get().count;
  if (requestsCount === 0) {
    const insertRequest = db.prepare(`
      INSERT INTO reduction_requests (request_code, member_id, fee_year, original_amount, request_type, request_value, reason, status, approved_by, approved_at, approval_comment, applied_amount, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertRequest.run('REQ001', 5, 2025, 15000.00, 'percentage', 50.00, '受疫情影响，公司经营困难，申请小微企业减免', 'approved', 1, '2025-03-15 10:00:00', '同意小微企业减免50%', 7500.00, 2);
    insertRequest.run('REQ002', 7, 2025, 8000.00, 'percentage', 50.00, '小微企业，经营状况不佳', 'approved', 1, '2025-04-20 14:30:00', '同意减免', 4000.00, 3);
    insertRequest.run('REQ003', 8, 2025, 3000.00, 'percentage', 50.00, '小微企业，资金周转困难', 'pending', null, null, null, 0.00, 3);
    insertRequest.run('REQ004', 10, 2025, 3000.00, 'percentage', 30.00, '公司经营困难，申请部分减免', 'rejected', 2, '2025-03-25 09:00:00', '材料不完整，请补充相关证明', 0.00, 2);
    console.log('✓ 减免申请样例数据插入成功');
  }

  console.log('\n✓✓✓ 数据库初始化完成 ✓✓✓');
  console.log('\n默认登录账号:');
  console.log('  管理员: admin / 123456');
  console.log('  经理: manager / 123456');
  console.log('  员工: staff / 123456');
}

try {
  initDatabase();
  db.close();
} catch (error) {
  console.error('数据库初始化失败:', error.message);
  if (db) db.close();
  process.exit(1);
}
