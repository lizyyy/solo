const moment = require('moment');

module.exports = (app, db) => {
  app.post('/api/init-demo-data', (req, res) => {
    const volunteers = [
      { id: 1, name: '张三', phone: '13800138001' },
      { id: 2, name: '李四', phone: '13800138002' },
      { id: 3, name: '王五', phone: '13800138003' }
    ];

    const volunteerPlaceholders = volunteers.map(() => '(?, ?, ?, ?)').join(',');
    const volunteerValues = volunteers.flatMap(v => [v.id, v.name, v.phone, '正常']);
    db.run(`INSERT OR REPLACE INTO volunteers (id, name, phone, status) VALUES ${volunteerPlaceholders}`, volunteerValues);

    db.run(`INSERT INTO volunteer_skills (volunteer_id, volunteer_name, skill_type, skill_level, status, created_by) VALUES 
      (1, '张三', '赛事引导', '高级', '已审核', '系统管理员'),
      (1, '张三', '物资发放', '中级', '已审核', '系统管理员'),
      (2, '李四', '观众服务', '初级', '待审核', '系统管理员'),
      (3, '王五', '技术支持', '高级', '已审核', '系统管理员')`);

    db.run(`INSERT INTO shift_schedules (volunteer_id, volunteer_name, shift_date, start_time, end_time, shift_type, location, status, created_by) VALUES 
      (1, '张三', '2024-01-15', '08:00', '16:00', '白班', 'A区入口', '已排班', '系统管理员'),
      (2, '李四', '2024-01-15', '09:00', '17:00', '白班', 'B区入口', '已排班', '系统管理员'),
      (3, '王五', '2024-01-16', '14:00', '22:00', '晚班', 'C区出口', '已排班', '系统管理员')`);

    db.run(`INSERT INTO attendance (volunteer_id, volunteer_name, shift_id, check_in_time, check_out_time, check_in_location, check_out_location, status, created_by) VALUES 
      (1, '张三', 1, '2024-01-15 07:55:00', '2024-01-15 16:05:00', 'A区入口', 'A区入口', '已签退', '系统管理员'),
      (2, '李四', 2, '2024-01-15 09:10:00', NULL, 'B区入口', NULL, '已签到', '系统管理员'),
      (3, '王五', 3, NULL, NULL, NULL, NULL, '待签到', '系统管理员')`);

    db.run(`INSERT INTO material_packages (volunteer_id, volunteer_name, package_type, items, distributed, created_by) VALUES 
      (1, '张三', '工作服套装', '["T恤","裤子","帽子"]', 1, '系统管理员'),
      (2, '李四', '饮水补给包', '["矿泉水","功能饮料","面包"]', 0, '系统管理员'),
      (3, '王五', '工作服套装', '["T恤","裤子","帽子"]', 0, '系统管理员')`);

    db.run(`INSERT INTO subsidy_rules (rule_name, rule_type, amount, conditions, effective_date, expiry_date, status, created_by) VALUES 
      ('白班补贴', '日常补贴', 150.00, '工作满8小时', '2024-01-01', '2024-12-31', '生效中', '系统管理员'),
      ('晚班补贴', '日常补贴', 200.00, '工作满8小时', '2024-01-01', '2024-12-31', '生效中', '系统管理员'),
      ('技能补贴', '额外补贴', 50.00, '高级技能认证', '2024-01-01', '2024-12-31', '生效中', '系统管理员')`);

    db.run(`INSERT INTO subsidy_records (volunteer_id, volunteer_name, rule_id, rule_name, amount, shift_id, attendance_id, callback_id, status, created_by) VALUES 
      (1, '张三', 1, '白班补贴', 150.00, 1, 1, 'CB001_20240115', '已发放', '系统管理员'),
      (1, '张三', 3, '技能补贴', 50.00, 1, 1, 'CB003_20240115', '已发放', '系统管理员'),
      (3, '王五', 2, '晚班补贴', 200.00, 3, 3, NULL, '待发放', '系统管理员')`);

    db.run(`INSERT INTO exception_list (volunteer_id, volunteer_name, exception_type, description, status, created_by) VALUES 
      (2, '李四', '考勤异常', '迟到10分钟，尚未处理', '待处理', '系统管理员'),
      (3, '王五', '物资包拦截', '存在未发放物资包，补贴发放被拦截', '待处理', '系统管理员')`);

    db.run(`INSERT INTO timeline (volunteer_id, action, description, operator, status, related_id, related_type) VALUES 
      (1, '创建排班', '2024-01-15 08:00-16:00排班', '系统管理员', '已排班', 1, 'shift_schedule'),
      (1, '签到', '签到时间:2024-01-15 07:55:00', '系统管理员', '已签到', 1, 'attendance'),
      (1, '发放物资包', '发放工作服套装', '系统管理员', '已发放', 1, 'material_package'),
      (1, '补贴发放', '白班补贴 150元 已发放', '系统管理员', '已发放', 1, 'subsidy_record'),
      (1, '补贴发放', '技能补贴 50元 已发放', '系统管理员', '已发放', 2, 'subsidy_record'),
      (1, '签退', '签退时间:2024-01-15 16:05:00', '系统管理员', '已签退', 1, 'attendance'),
      (2, '创建排班', '2024-01-15 09:00-17:00排班', '系统管理员', '已排班', 2, 'shift_schedule'),
      (2, '签到', '签到时间:2024-01-15 09:10:00', '系统管理员', '已签到', 2, 'attendance'),
      (2, '创建异常记录', '考勤异常: 迟到10分钟', '系统管理员', '待处理', 1, 'exception'),
      (3, '创建排班', '2024-01-16 14:00-22:00排班', '系统管理员', '已排班', 3, 'shift_schedule'),
      (3, '创建异常记录', '物资包拦截: 补贴发放被拦截', '系统管理员', '待处理', 2, 'exception')`);

    db.run(`INSERT INTO audit_logs (module, record_id, field_name, old_value, new_value, operation, operator) VALUES 
      ('volunteer_skills', 1, 'status', '待审核', '已审核', '状态变更', '系统管理员'),
      ('volunteer_skills', 3, 'status', '待审核', '已审核', '状态变更', '系统管理员'),
      ('attendance', 1, 'check_in_time', NULL, '2024-01-15 07:55:00', '签到', '系统管理员'),
      ('attendance', 1, 'check_out_time', NULL, '2024-01-15 16:05:00', '签退', '系统管理员'),
      ('subsidy_records', 1, 'status', '待发放', '已发放', '回调发放', '系统管理员'),
      ('subsidy_records', 2, 'status', '待发放', '已发放', '回调发放', '系统管理员'),
      ('material_packages', 1, 'distributed', '0', '1', '发放', '系统管理员')`);

    res.json({ success: true, message: '演示数据初始化成功' });
  });

  app.get('/api/volunteers', (req, res) => {
    db.all(`SELECT * FROM volunteers ORDER BY id`, (err, rows) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(rows);
    });
  });
};
