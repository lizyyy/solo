const db = require('../database/db');

db.serialize(() => {
  db.run(`
    INSERT INTO halls (name, capacity, status) VALUES
    ('1号厅', 100, 'active'),
    ('2号厅', 150, 'active'),
    ('3号厅', 120, 'active')
  `);

  db.run(`
    INSERT INTO staff (name, phone, skills, status) VALUES
    ('张三', '13800138001', '清洁,巡检', 'active'),
    ('李四', '13800138002', '清洁', 'active'),
    ('王五', '13800138003', '巡检,设备维修', 'active'),
    ('赵六', '13800138004', '清洁,巡检,设备维修', 'active')
  `);

  db.run(`
    INSERT INTO positions (name, description, required_skills) VALUES
    ('清洁员', '负责影厅清洁工作', '清洁'),
    ('巡检员', '负责设备巡检工作', '巡检'),
    ('设备维修', '负责设备维修工作', '设备维修'),
    ('值班经理', '负责整体管理', '清洁,巡检')
  `);

  const now = new Date();
  const startTime = new Date(now.getTime() + 30 * 60 * 1000);
  const endTime = new Date(now.getTime() + 150 * 60 * 1000);

  db.run(`
    INSERT INTO screenings (hall_id, movie_name, start_time, end_time, status) VALUES
    (1, '流浪地球3', ?, ?, 'scheduled'),
    (2, '哪吒之魔童闹海', ?, ?, 'playing'),
    (3, '封神第二部', ?, ?, 'ended')
  `, [
    startTime.toISOString(), endTime.toISOString(),
    new Date(now.getTime() - 60 * 60 * 1000).toISOString(), new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    new Date(now.getTime() - 180 * 60 * 1000).toISOString(), new Date(now.getTime() - 30 * 60 * 1000).toISOString()
  ]);

  const cleaningTime = new Date(now.getTime() - 25 * 60 * 1000);
  db.run(`
    INSERT INTO cleaning_schedules (screening_id, hall_id, assigned_staff_id, scheduled_time, actual_start_time, actual_end_time, status, quality_score, notes) VALUES
    (3, 3, 1, ?, ?, ?, 'completed', 5, '清洁完成，设备正常'),
    (2, 2, 2, ?, NULL, NULL, 'pending', NULL, NULL),
    (1, 1, NULL, ?, NULL, NULL, 'pending', NULL, NULL)
  `, [
    cleaningTime.toISOString(), new Date(now.getTime() - 20 * 60 * 1000).toISOString(), new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
    new Date(now.getTime() + 40 * 60 * 1000).toISOString(),
    new Date(now.getTime() + 160 * 60 * 1000).toISOString()
  ]);

  console.log('测试数据初始化完成！');
});

db.close();
