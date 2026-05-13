const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/mall_coupon.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  const stmtMembers = db.prepare(`INSERT OR IGNORE INTO members (member_no, name, phone, level, level_before, points) VALUES (?, ?, ?, ?, ?, ?)`);
  
  const members = [
    ['M001', '张三', '13800138001', 'gold', 'silver', 5800],
    ['M002', '李四', '13800138002', 'platinum', 'gold', 12500],
    ['M003', '王五', '13800138003', 'silver', 'normal', 2100],
    ['M004', '赵六', '13800138004', 'diamond', 'platinum', 28000],
    ['M005', '钱七', '13800138005', 'normal', null, 500],
    ['M006', '孙八', '13800138006', 'gold', 'silver', 6200],
    ['M007', '周九', '13800138007', 'platinum', 'gold', 15000],
    ['M008', '吴十', '13800138008', 'silver', 'normal', 1800],
  ];
  
  members.forEach(m => stmtMembers.run(m));
  stmtMembers.finalize();

  const stmtStores = db.prepare(`INSERT OR IGNORE INTO stores (store_no, name, address, manager, status) VALUES (?, ?, ?, ?, ?)`);
  
  const stores = [
    ['S001', '朝阳门店', '北京市朝阳区朝阳门外大街1号', '王经理', 'active'],
    ['S002', '海淀店', '北京市海淀区中关村大街1号', '李经理', 'active'],
    ['S003', '西城店', '北京市西城区西单北大街1号', '张经理', 'active'],
    ['S004', '东城店', '北京市东城区王府井大街1号', '刘经理', 'active'],
    ['S005', '丰台店', '北京市丰台区南三环西路1号', '赵经理', 'inactive'],
  ];
  
  stores.forEach(s => stmtStores.run(s));
  stmtStores.finalize();

  const stmtPackages = db.prepare(`INSERT OR IGNORE INTO coupon_packages (package_no, name, member_id, total_count, used_count, remaining_count, total_count_before, used_count_before, remaining_count_before, status, valid_start_date, valid_end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  
  const packages = [
    ['PKG001', '五一黄金周活动券包', 1, 5, 3, 2, 5, 2, 3, 'active', '2024-05-01', '2024-05-31'],
    ['PKG002', '母亲节特惠券包', 2, 3, 2, 1, 3, 1, 2, 'active', '2024-05-10', '2024-05-20'],
    ['PKG003', '会员专享年中庆', 3, 4, 1, 3, 4, 0, 4, 'active', '2024-06-01', '2024-06-30'],
    ['PKG004', '钻石VIP尊享券包', 4, 10, 5, 5, 10, 4, 6, 'active', '2024-05-01', '2024-12-31'],
    ['PKG005', '新会员欢迎券包', 5, 2, 0, 2, null, null, null, 'active', '2024-05-15', '2024-06-15'],
    ['PKG006', '618大促券包', 6, 6, 4, 2, 6, 3, 3, 'active', '2024-06-15', '2024-06-20'],
    ['PKG007', '端午粽香券包', 7, 3, 1, 2, 3, 0, 3, 'active', '2024-06-10', '2024-06-12'],
    ['PKG008', '父亲节感恩券包', 8, 2, 1, 1, 2, 0, 2, 'active', '2024-06-15', '2024-06-18'],
  ];
  
  packages.forEach(p => stmtPackages.run(p));
  stmtPackages.finalize();

  const stmtCoupons = db.prepare(`INSERT OR IGNORE INTO coupons (coupon_no, package_id, member_id, type, discount_value, min_spend, status, valid_start_date, valid_end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  
  const coupons = [
    ['C001', 1, 1, '满减', 50.00, 200.00, 'used', '2024-05-01', '2024-05-31'],
    ['C002', 1, 1, '满减', 30.00, 100.00, 'used', '2024-05-01', '2024-05-31'],
    ['C003', 1, 1, '折扣', 0.85, 0, 'used', '2024-05-01', '2024-05-31'],
    ['C004', 1, 1, '满减', 100.00, 500.00, 'available', '2024-05-01', '2024-05-31'],
    ['C005', 1, 1, '赠品', 0, 0, 'available', '2024-05-01', '2024-05-31'],
    ['C006', 2, 2, '满减', 80.00, 300.00, 'used', '2024-05-10', '2024-05-20'],
    ['C007', 2, 2, '折扣', 0.80, 0, 'used', '2024-05-10', '2024-05-20'],
    ['C008', 2, 2, '满减', 50.00, 200.00, 'available', '2024-05-10', '2024-05-20'],
    ['C009', 3, 3, '满减', 20.00, 100.00, 'used', '2024-06-01', '2024-06-30'],
    ['C010', 3, 3, '满减', 40.00, 200.00, 'available', '2024-06-01', '2024-06-30'],
    ['C011', 3, 3, '折扣', 0.90, 0, 'available', '2024-06-01', '2024-06-30'],
    ['C012', 3, 3, '赠品', 0, 0, 'available', '2024-06-01', '2024-06-30'],
    ['C013', 4, 4, '满减', 200.00, 1000.00, 'used', '2024-05-01', '2024-12-31'],
    ['C014', 4, 4, '满减', 150.00, 800.00, 'used', '2024-05-01', '2024-12-31'],
    ['C015', 4, 4, '折扣', 0.75, 0, 'used', '2024-05-01', '2024-12-31'],
    ['C016', 4, 4, '满减', 100.00, 500.00, 'used', '2024-05-01', '2024-12-31'],
    ['C017', 4, 4, '满减', 80.00, 400.00, 'used', '2024-05-01', '2024-12-31'],
    ['C018', 4, 4, '满减', 200.00, 1000.00, 'available', '2024-05-01', '2024-12-31'],
    ['C019', 4, 4, '满减', 150.00, 800.00, 'available', '2024-05-01', '2024-12-31'],
    ['C020', 4, 4, '折扣', 0.75, 0, 'available', '2024-05-01', '2024-12-31'],
    ['C021', 4, 4, '满减', 100.00, 500.00, 'available', '2024-05-01', '2024-12-31'],
    ['C022', 4, 4, '满减', 80.00, 400.00, 'available', '2024-05-01', '2024-12-31'],
    ['C023', 5, 5, '满减', 10.00, 50.00, 'available', '2024-05-15', '2024-06-15'],
    ['C024', 5, 5, '折扣', 0.95, 0, 'available', '2024-05-15', '2024-06-15'],
    ['C025', 6, 6, '满减', 60.00, 300.00, 'used', '2024-06-15', '2024-06-20'],
    ['C026', 6, 6, '满减', 100.00, 500.00, 'used', '2024-06-15', '2024-06-20'],
    ['C027', 6, 6, '折扣', 0.88, 0, 'used', '2024-06-15', '2024-06-20'],
    ['C028', 6, 6, '满减', 50.00, 250.00, 'used', '2024-06-15', '2024-06-20'],
    ['C029', 6, 6, '满减', 120.00, 600.00, 'available', '2024-06-15', '2024-06-20'],
    ['C030', 6, 6, '折扣', 0.85, 0, 'available', '2024-06-15', '2024-06-20'],
    ['C031', 7, 7, '满减', 30.00, 150.00, 'used', '2024-06-10', '2024-06-12'],
    ['C032', 7, 7, '满减', 50.00, 200.00, 'available', '2024-06-10', '2024-06-12'],
    ['C033', 7, 7, '赠品', 0, 0, 'available', '2024-06-10', '2024-06-12'],
    ['C034', 8, 8, '满减', 40.00, 200.00, 'used', '2024-06-15', '2024-06-18'],
    ['C035', 8, 8, '满减', 60.00, 300.00, 'available', '2024-06-15', '2024-06-18'],
  ];
  
  coupons.forEach(c => stmtCoupons.run(c));
  stmtCoupons.finalize();

  const stmtVerifications = db.prepare(`INSERT OR IGNORE INTO verifications (verification_no, coupon_id, member_id, store_id, operator, verification_time, order_amount, discount_amount, status, is_blocked, block_reason, store_id_before, status_before) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  
  const verifications = [
    ['V001', 1, 1, 1, '陈收银员', '2024-05-05 10:30:00', 258.00, 50.00, 'normal', 0, null, null, null],
    ['V002', 2, 1, 1, '陈收银员', '2024-05-06 14:20:00', 128.00, 30.00, 'refunded', 0, null, 1, 'normal'],
    ['V003', 3, 1, 2, '刘收银员', '2024-05-08 16:45:00', 599.00, 89.85, 'normal', 0, null, null, null],
    ['V004', 6, 2, 2, '刘收银员', '2024-05-12 11:00:00', 388.00, 80.00, 'refunded', 1, '疑似刷单', 2, 'normal'],
    ['V005', 7, 2, 3, '王收银员', '2024-05-15 15:30:00', 699.00, 139.80, 'normal', 0, null, null, null],
    ['V006', 9, 3, 3, '王收银员', '2024-06-02 09:15:00', 156.00, 20.00, 'normal', 0, null, null, null],
    ['V007', 13, 4, 1, '陈收银员', '2024-05-20 13:00:00', 1280.00, 200.00, 'normal', 0, null, null, null],
    ['V008', 14, 4, 4, '赵收银员', '2024-05-25 19:45:00', 999.00, 150.00, 'refunded', 0, null, 4, 'normal'],
    ['V009', 15, 4, 2, '刘收银员', '2024-06-01 12:30:00', 1580.00, 395.00, 'normal', 0, null, null, null],
    ['V010', 16, 4, 3, '王收银员', '2024-06-05 17:20:00', 688.00, 100.00, 'normal', 0, null, null, null],
    ['V011', 17, 4, 1, '陈收银员', '2024-06-08 20:00:00', 520.00, 80.00, 'refunded', 1, '高频退款', 1, 'normal'],
    ['V012', 25, 6, 4, '赵收银员', '2024-06-16 10:00:00', 368.00, 60.00, 'normal', 0, null, null, null],
    ['V013', 26, 6, 2, '刘收银员', '2024-06-16 14:30:00', 588.00, 100.00, 'refunded', 0, null, 2, 'normal'],
    ['V014', 27, 6, 1, '陈收银员', '2024-06-17 11:15:00', 899.00, 107.88, 'normal', 0, null, null, null],
    ['V015', 28, 6, 3, '王收银员', '2024-06-17 16:40:00', 299.00, 50.00, 'normal', 0, null, null, null],
    ['V016', 31, 7, 4, '赵收银员', '2024-06-10 13:20:00', 188.00, 30.00, 'refunded', 0, null, 4, 'normal'],
    ['V017', 34, 8, 2, '刘收银员', '2024-06-16 15:50:00', 256.00, 40.00, 'normal', 0, null, null, null],
  ];
  
  verifications.forEach(v => stmtVerifications.run(v));
  stmtVerifications.finalize();

  const stmtRefunds = db.prepare(`INSERT OR IGNORE INTO refunds (refund_no, verification_id, coupon_id, member_id, store_id, refund_time, operator, refund_amount, is_coupon_returned, return_status, exception_type, exception_note, handler, handle_time, handle_result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  
  const refunds = [
    ['R001', 2, 2, 1, 1, '2024-05-07 09:30:00', '客服A', 128.00, 1, 'success', null, null, null, null, null],
    ['R002', 4, 6, 2, 2, '2024-05-18 10:15:00', '客服B', 388.00, 0, 'exception', 'coupon_expired', '券已过期无法返还', '张主管', '2024-05-18 14:30:00', '已赠送新券补偿'],
    ['R003', 8, 14, 4, 4, '2024-05-28 11:00:00', '客服A', 999.00, 1, 'success', null, null, null, null, null],
    ['R004', 11, 17, 4, 1, '2024-06-09 08:45:00', '客服C', 520.00, 0, 'exception', 'suspicious_activity', '疑似刷单行为，需审核', '李主管', '2024-06-09 11:20:00', '审核中'],
    ['R005', 13, 26, 6, 2, '2024-06-17 10:30:00', '客服B', 588.00, 1, 'success', null, null, null, null, null],
    ['R006', 16, 31, 7, 4, '2024-06-11 14:00:00', '客服A', 188.00, 1, 'success', null, null, null, null, null],
  ];
  
  refunds.forEach(r => stmtRefunds.run(r));
  stmtRefunds.finalize();

  const stmtAudit = db.prepare(`INSERT OR IGNORE INTO audit_logs (operation_type, target_type, target_id, operator, operation_time, old_value, new_value, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  
  const audits = [
    ['update', 'member', 1, '管理员', '2024-04-15 10:00:00', 'silver', 'gold', '会员等级升级'],
    ['update', 'member', 2, '管理员', '2024-04-20 14:30:00', 'gold', 'platinum', '会员等级升级'],
    ['update', 'member', 3, '管理员', '2024-05-01 09:00:00', 'normal', 'silver', '会员等级升级'],
    ['update', 'member', 4, '管理员', '2024-03-10 16:00:00', 'platinum', 'diamond', '会员等级升级'],
    ['update', 'member', 6, '管理员', '2024-04-25 11:00:00', 'silver', 'gold', '会员等级升级'],
    ['update', 'member', 7, '管理员', '2024-05-05 15:30:00', 'gold', 'platinum', '会员等级升级'],
    ['update', 'member', 8, '管理员', '2024-05-10 08:45:00', 'normal', 'silver', '会员等级升级'],
    ['update', 'coupon_package', 1, '系统', '2024-05-07 09:30:00', '{"used_count":2,"remaining_count":3}', '{"used_count":3,"remaining_count":2}', '退款返券更新'],
    ['update', 'coupon_package', 2, '系统', '2024-05-18 10:15:00', '{"used_count":1,"remaining_count":2}', '{"used_count":2,"remaining_count":1}', '退款返券更新'],
    ['update', 'coupon_package', 4, '系统', '2024-05-28 11:00:00', '{"used_count":4,"remaining_count":6}', '{"used_count":5,"remaining_count":5}', '退款返券更新'],
    ['update', 'verification', 4, '风控系统', '2024-05-18 11:00:00', '{"is_blocked":0}', '{"is_blocked":1,"block_reason":"疑似刷单"}', '刷单拦截'],
    ['update', 'verification', 11, '风控系统', '2024-06-09 09:00:00', '{"is_blocked":0}', '{"is_blocked":1,"block_reason":"高频退款"}', '刷单拦截'],
    ['handle', 'refund', 2, '张主管', '2024-05-18 14:30:00', '{"return_status":"exception"}', '{"return_status":"handled","handle_result":"已赠送新券补偿"}', '异常处理完成'],
    ['handle', 'refund', 4, '李主管', '2024-06-09 11:20:00', '{"return_status":"exception"}', '{"return_status":"handling","handle_result":"审核中"}', '异常处理中'],
  ];
  
  audits.forEach(a => stmtAudit.run(a));
  stmtAudit.finalize();

  const stmtImports = db.prepare(`INSERT OR IGNORE INTO import_records (import_no, file_name, total_count, success_count, failed_count, operator, import_time, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  
  const imports = [
    ['IMP001', '会员数据导入0501.csv', 156, 150, 6, '数据专员A', '2024-05-01 09:30:00', 'completed'],
    ['IMP002', '核销记录批量导入0515.csv', 520, 512, 8, '数据专员B', '2024-05-15 14:00:00', 'completed'],
    ['IMP003', '退款记录补录0601.csv', 89, 85, 4, '数据专员A', '2024-06-01 10:30:00', 'completed'],
  ];
  
  imports.forEach(i => stmtImports.run(i));
  stmtImports.finalize();

  console.log('演示数据插入完成');
});

db.close();
