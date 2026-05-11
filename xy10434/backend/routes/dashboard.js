const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/stats', (req, res) => {
  const stats = {
    pendingDecorations: db.prepare(`
      SELECT COUNT(*) as count FROM decorations WHERE status = 'pending'
    `).get().count,
    inProgressDecorations: db.prepare(`
      SELECT COUNT(*) as count FROM decorations WHERE status = 'in_progress'
    `).get().count,
    completedDecorations: db.prepare(`
      SELECT COUNT(*) as count FROM decorations WHERE status = 'completed'
    `).get().count,
    totalDeposit: db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN type = 'receive' THEN amount ELSE 0 END), 0) as total
      FROM deposit_transactions
    `).get().total,
    totalDeduction: db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN type = 'deduction' THEN amount ELSE 0 END), 0) as total
      FROM deposit_transactions
    `).get().total,
    totalRefund: db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END), 0) as total
      FROM deposit_transactions
    `).get().total,
    pendingInspections: db.prepare(`
      SELECT COUNT(*) as count FROM inspections WHERE status = 'pending'
    `).get().count,
    pendingRefunds: db.prepare(`
      SELECT COUNT(*) as count FROM refunds WHERE status = 'pending'
    `).get().count
  };
  
  res.json(stats);
});

router.get('/pending-tasks', (req, res) => {
  const pendingDecorations = db.prepare(`
    SELECT d.*,
      r.building, r.unit, r.room_number,
      o.name as owner_name
    FROM decorations d
    LEFT JOIN rooms r ON d.room_id = r.id
    LEFT JOIN owners o ON d.owner_id = o.id
    WHERE d.status = 'pending'
    ORDER BY d.created_at DESC
    LIMIT 10
  `).all();

  const pendingInspections = db.prepare(`
    SELECT i.*,
      r.building, r.unit, r.room_number,
      o.name as owner_name
    FROM inspections i
    LEFT JOIN decorations d ON i.decoration_id = d.id
    LEFT JOIN rooms r ON d.room_id = r.id
    LEFT JOIN owners o ON d.owner_id = o.id
    WHERE i.status = 'pending'
    ORDER BY i.created_at DESC
    LIMIT 10
  `).all();

  const pendingRefunds = db.prepare(`
    SELECT rf.*,
      r.building, r.unit, r.room_number,
      o.name as owner_name
    FROM refunds rf
    LEFT JOIN decorations d ON rf.decoration_id = d.id
    LEFT JOIN rooms r ON d.room_id = r.id
    LEFT JOIN owners o ON d.owner_id = o.id
    WHERE rf.status = 'pending'
    ORDER BY rf.created_at DESC
    LIMIT 10
  `).all();

  res.json({
    pendingDecorations,
    pendingInspections,
    pendingRefunds
  });
});

router.post('/init-sample-data', (req, res) => {
  try {
    const owner1 = db.prepare(`
      INSERT INTO owners (name, phone, id_card) VALUES (?, ?, ?)
    `).run('张三', '13800138001', '110101199001011234');
    
    const owner2 = db.prepare(`
      INSERT INTO owners (name, phone, id_card) VALUES (?, ?, ?)
    `).run('李四', '13800138002', '110101199002021234');
    
    const owner3 = db.prepare(`
      INSERT INTO owners (name, phone, id_card) VALUES (?, ?, ?)
    `).run('王五', '13800138003', '110101199003031234');

    const room1 = db.prepare(`
      INSERT INTO rooms (building, unit, room_number, owner_id, status) VALUES (?, ?, ?, ?, ?)
    `).run('1栋', '1单元', '101', owner1.lastInsertRowid, 'occupied');
    
    const room2 = db.prepare(`
      INSERT INTO rooms (building, unit, room_number, owner_id, status) VALUES (?, ?, ?, ?, ?)
    `).run('1栋', '1单元', '201', owner2.lastInsertRowid, 'occupied');
    
    const room3 = db.prepare(`
      INSERT INTO rooms (building, unit, room_number, owner_id, status) VALUES (?, ?, ?, ?, ?)
    `).run('2栋', '2单元', '301', owner3.lastInsertRowid, 'occupied');

    const team1 = db.prepare(`
      INSERT INTO construction_teams (name, leader_name, leader_phone, license) VALUES (?, ?, ?, ?)
    `).run('诚信装修队', '陈师傅', '13900139001', 'JZ2024001');

    const dec1 = db.prepare(`
      INSERT INTO decorations (room_id, owner_id, team_id, status, start_date, expected_end_date, deposit_amount, remark)
      VALUES (?, ?, ?, 'completed', ?, ?, ?, ?)
    `).run(room1.lastInsertRowid, owner1.lastInsertRowid, team1.lastInsertRowid, '2024-01-15', '2024-04-15', 5000, '正常装修，已完成退押');

    const dec2 = db.prepare(`
      INSERT INTO decorations (room_id, owner_id, team_id, status, start_date, expected_end_date, deposit_amount, total_deduction, remark)
      VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, ?)
    `).run(room2.lastInsertRowid, owner2.lastInsertRowid, team1.lastInsertRowid, '2024-02-01', '2024-05-01', 5000, 1000, '存在噪音违规，扣押金1000元');

    const dec3 = db.prepare(`
      INSERT INTO decorations (room_id, owner_id, team_id, status, start_date, expected_end_date, deposit_amount, total_deduction, remark)
      VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, ?)
    `).run(room3.lastInsertRowid, owner3.lastInsertRowid, team1.lastInsertRowid, '2024-03-01', '2024-06-01', 5000, 500, '整改后合格，扣部分押金');

    db.prepare(`
      INSERT INTO deposit_transactions (decoration_id, type, amount, payment_method, operator, remark)
      VALUES (?, 'receive', ?, '现金', '管理员', '装修押金收取')
    `).run(dec1.lastInsertRowid, 5000);

    db.prepare(`
      INSERT INTO deposit_transactions (decoration_id, type, amount, payment_method, operator, remark)
      VALUES (?, 'refund', ?, '转账', '管理员', '装修押金全额退还')
    `).run(dec1.lastInsertRowid, 5000);

    db.prepare(`
      INSERT INTO inspections (decoration_id, inspector, inspection_date, violation_type, description, deduction_amount, status, rectification_requirement, rectification_result, reviewer, review_date)
      VALUES (?, '李巡查', ?, '噪音违规', '周末擅自施工，影响邻居休息', 1000, 'reviewed', '立即停止施工，工作日方可继续', '已按要求整改', '王主任', ?)
    `).run(dec2.lastInsertRowid, '2024-03-10', '2024-03-15');

    db.prepare(`
      INSERT INTO deposit_transactions (decoration_id, type, amount, payment_method, operator, remark)
      VALUES (?, 'receive', ?, '现金', '管理员', '装修押金收取')
    `).run(dec2.lastInsertRowid, 5000);

    db.prepare(`
      INSERT INTO deposit_transactions (decoration_id, type, amount, operator, remark)
      VALUES (?, 'deduction', ?, '李巡查', '噪音违规扣款')
    `).run(dec2.lastInsertRowid, 1000);

    db.prepare(`
      INSERT INTO deposit_transactions (decoration_id, type, amount, payment_method, operator, remark)
      VALUES (?, 'refund', ?, '转账', '管理员', '装修押金退还(扣除违规扣款)')
    `).run(dec2.lastInsertRowid, 4000);

    db.prepare(`
      INSERT INTO inspections (decoration_id, inspector, inspection_date, violation_type, description, deduction_amount, status, rectification_requirement, rectification_result, reviewer, review_date)
      VALUES (?, '李巡查', ?, '破坏墙体结构', '擅自拆除承重墙', 0, 'reviewed', '立即恢复墙体结构，由结构工程师确认安全', '已按要求恢复，经检测合格', '王主任', ?)
    `).run(dec3.lastInsertRowid, '2024-04-05', '2024-04-20');

    db.prepare(`
      INSERT INTO inspections (decoration_id, inspector, inspection_date, violation_type, description, deduction_amount, status, rectification_requirement, rectification_result, reviewer, review_date)
      VALUES (?, '李巡查', ?, '违规堆放', '楼道堆放装修材料', 500, 'reviewed', '立即清理楼道，保持消防通道畅通', '已清理完毕', '王主任', ?)
    `).run(dec3.lastInsertRowid, '2024-04-25', '2024-04-28');

    db.prepare(`
      INSERT INTO deposit_transactions (decoration_id, type, amount, payment_method, operator, remark)
      VALUES (?, 'receive', ?, '现金', '管理员', '装修押金收取')
    `).run(dec3.lastInsertRowid, 5000);

    db.prepare(`
      INSERT INTO deposit_transactions (decoration_id, type, amount, operator, remark)
      VALUES (?, 'deduction', ?, '李巡查', '违规堆放扣款')
    `).run(dec3.lastInsertRowid, 500);

    db.prepare(`
      INSERT INTO deposit_transactions (decoration_id, type, amount, payment_method, operator, remark)
      VALUES (?, 'refund', ?, '转账', '管理员', '装修押金退还(扣除违规扣款)')
    `).run(dec3.lastInsertRowid, 4500);

    db.prepare(`
      INSERT INTO refunds (decoration_id, deposit_received, total_deduction, refund_amount, applicant, applicant_date, reviewer, review_date, status, payment_method, remark)
      VALUES (?, 5000, 0, 5000, '张三', ?, '王主任', ?, 'approved', '转账', '正常装修退押')
    `).run(dec1.lastInsertRowid, '2024-04-16', '2024-04-16');

    db.prepare(`
      INSERT INTO refunds (decoration_id, deposit_received, total_deduction, refund_amount, applicant, applicant_date, reviewer, review_date, status, payment_method, remark)
      VALUES (?, 5000, 1000, 4000, '李四', ?, '王主任', ?, 'approved', '转账', '噪音违规扣1000元')
    `).run(dec2.lastInsertRowid, '2024-05-02', '2024-05-02');

    db.prepare(`
      INSERT INTO refunds (decoration_id, deposit_received, total_deduction, refund_amount, applicant, applicant_date, reviewer, review_date, status, payment_method, remark)
      VALUES (?, 5000, 500, 4500, '王五', ?, '王主任', ?, 'approved', '转账', '整改后合格，违规堆放扣500元')
    `).run(dec3.lastInsertRowid, '2024-06-02', '2024-06-02');

    res.json({ message: '样例数据初始化成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
