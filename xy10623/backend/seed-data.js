const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'cleaning.db');
const db = new sqlite3.Database(dbPath);

const properties = [
  { name: '海景公寓A101', address: '海滨大道88号A栋101' },
  { name: '海景公寓B202', address: '海滨大道88号B栋202' },
  { name: '山景别墅C301', address: '青山路66号C区301' },
  { name: '城市套房D405', address: '市中心广场D座405' },
  { name: '温馨民宿E102', address: '老城区E巷102号' }
];

const cleaners = [
  { name: '张阿姨', phone: '13800138001' },
  { name: '李阿姨', phone: '13800138002' },
  { name: '王阿姨', phone: '13800138003' },
  { name: '赵阿姨', phone: '13800138004' }
];

const materials = [
  { name: '消毒液', unit: '瓶', stock_quantity: 50, threshold: 20 },
  { name: '清洁剂', unit: '瓶', stock_quantity: 45, threshold: 15 },
  { name: '抹布', unit: '块', stock_quantity: 100, threshold: 30 },
  { name: '垃圾袋', unit: '卷', stock_quantity: 80, threshold: 25 },
  { name: '手套', unit: '副', stock_quantity: 60, threshold: 20 }
];

const today = new Date();
const getDate = (days) => {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

db.serialize(() => {
  const stmtProp = db.prepare('INSERT INTO properties (name, address) VALUES (?, ?)');
  properties.forEach(p => stmtProp.run(p.name, p.address));
  stmtProp.finalize();

  const stmtCleaner = db.prepare('INSERT INTO cleaners (name, phone) VALUES (?, ?)');
  cleaners.forEach(c => stmtCleaner.run(c.name, c.phone));
  stmtCleaner.finalize();

  const stmtMat = db.prepare('INSERT INTO materials (name, unit, stock_quantity, threshold) VALUES (?, ?, ?, ?)');
  materials.forEach(m => stmtMat.run(m.name, m.unit, m.stock_quantity, m.threshold));
  stmtMat.finalize();

  const calendarEvents = [];
  for (let i = -7; i <= 7; i++) {
    for (let p = 1; p <= 5; p++) {
      if (Math.random() > 0.4) {
        calendarEvents.push({
          property_id: p,
          date: getDate(i),
          event_type: Math.random() > 0.5 ? 'checkin' : 'checkout',
          guest_name: ['张三', '李四', '王五', '赵六', '陈七'][Math.floor(Math.random() * 5)],
          check_in: '14:00',
          check_out: '12:00'
        });
      }
    }
  }

  const stmtCal = db.prepare('INSERT INTO calendar_events (property_id, date, event_type, guest_name, check_in, check_out) VALUES (?, ?, ?, ?, ?, ?)');
  calendarEvents.forEach(e => stmtCal.run(e.property_id, e.date, e.event_type, e.guest_name, e.check_in, e.check_out));
  stmtCal.finalize();

  const checkoutEvents = [];
  for (let i = -7; i <= 0; i++) {
    for (let p = 1; p <= 5; p++) {
      if (Math.random() > 0.5) {
        checkoutEvents.push({
          property_id: p,
          checkout_date: getDate(i),
          guest_name: ['张三', '李四', '王五', '赵六', '陈七'][Math.floor(Math.random() * 5)],
          actual_checkout_time: ['11:30', '11:45', '12:00', '12:15', '12:30'][Math.floor(Math.random() * 5)],
          room_condition: ['good', 'normal', 'dirty'][Math.floor(Math.random() * 3)],
          damage_notes: Math.random() > 0.8 ? '轻微墙面污渍' : null,
          status: 'completed'
        });
      }
    }
  }

  const stmtCheckout = db.prepare('INSERT INTO checkout_events (property_id, checkout_date, guest_name, actual_checkout_time, room_condition, damage_notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
  checkoutEvents.forEach(e => stmtCheckout.run(e.property_id, e.checkout_date, e.guest_name, e.actual_checkout_time, e.room_condition, e.damage_notes, e.status));
  stmtCheckout.finalize();

  const cleaningAssignments = [];
  const statuses = ['assigned', 'in_progress', 'completed', 'needs_review'];
  for (let i = -7; i <= 2; i++) {
    for (let p = 1; p <= 5; p++) {
      if (Math.random() > 0.3) {
        const cleanerId = Math.floor(Math.random() * 4) + 1;
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        cleaningAssignments.push({
          property_id: p,
          cleaner_id: cleanerId,
          cleaner_name: cleaners[cleanerId - 1].name,
          scheduled_date: getDate(i),
          scheduled_time: ['09:00', '10:00', '11:00', '14:00', '15:00'][Math.floor(Math.random() * 5)],
          actual_start_time: status !== 'assigned' ? ['09:15', '10:20', '11:10', '14:05', '15:15'][Math.floor(Math.random() * 5)] : null,
          actual_end_time: status === 'completed' || status === 'needs_review' ? ['11:30', '12:45', '13:20', '16:30', '17:15'][Math.floor(Math.random() * 5)] : null,
          status: status,
          quality_score: status === 'completed' ? [85, 90, 92, 88, 95, 78, 82][Math.floor(Math.random() * 7)] : null,
          inspection_notes: status === 'needs_review' ? '卫生间清洁不到位，需要返工' : null
        });
      }
    }
  }

  const stmtAssignment = db.prepare('INSERT INTO cleaning_assignments (property_id, cleaner_id, cleaner_name, scheduled_date, scheduled_time, actual_start_time, actual_end_time, status, quality_score, inspection_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  cleaningAssignments.forEach(a => stmtAssignment.run(a.property_id, a.cleaner_id, a.cleaner_name, a.scheduled_date, a.scheduled_time, a.actual_start_time, a.actual_end_time, a.status, a.quality_score, a.inspection_notes));
  stmtAssignment.finalize();

  const reworkRecords = [
    {
      cleaning_assignment_id: 1,
      complaint_source: 'guest',
      complaint_date: getDate(-5),
      complaint_type: 'cleanliness',
      description: '厨房油污未清理干净，台面有污渍',
      responsible_person: '张阿姨',
      rework_assign_to: '李阿姨',
      rework_scheduled_date: getDate(-4),
      rework_status: 'completed',
      rework_completion_date: getDate(-4),
      resolution_notes: '已重新清理厨房，客户满意',
      created_by: '管理员'
    },
    {
      cleaning_assignment_id: 3,
      complaint_source: 'inspection',
      complaint_date: getDate(-3),
      complaint_type: 'forgotten_items',
      description: '卫生间忘记更换毛巾',
      responsible_person: '王阿姨',
      rework_assign_to: '王阿姨',
      rework_scheduled_date: getDate(-2),
      rework_status: 'in_progress',
      created_by: '质检'
    },
    {
      cleaning_assignment_id: 5,
      complaint_source: 'guest',
      complaint_date: getDate(-1),
      complaint_type: 'odor',
      description: '房间有异味，通风不足',
      responsible_person: '赵阿姨',
      rework_assign_to: '张阿姨',
      rework_scheduled_date: getDate(0),
      rework_status: 'pending',
      created_by: '客服'
    },
    {
      cleaning_assignment_id: 7,
      complaint_source: 'inspection',
      complaint_date: getDate(-2),
      complaint_type: 'cleanliness',
      description: '地板有头发丝，床品折叠不整齐',
      responsible_person: '李阿姨',
      rework_assign_to: '李阿姨',
      rework_scheduled_date: getDate(-1),
      rework_status: 'completed',
      rework_completion_date: getDate(-1),
      resolution_notes: '已重新清理并整理床品',
      created_by: '质检'
    }
  ];

  const stmtRework = db.prepare('INSERT INTO rework_records (cleaning_assignment_id, complaint_source, complaint_date, complaint_type, description, responsible_person, rework_assign_to, rework_scheduled_date, rework_status, rework_completion_date, resolution_notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  reworkRecords.forEach(r => stmtRework.run(r.cleaning_assignment_id, r.complaint_source, r.complaint_date, r.complaint_type, r.description, r.responsible_person, r.rework_assign_to, r.rework_scheduled_date, r.rework_status, r.rework_completion_date, r.resolution_notes, r.created_by));
  stmtRework.finalize();

  for (let i = 1; i <= 10; i++) {
    for (let m = 1; m <= 5; m++) {
      if (Math.random() > 0.3) {
        const expected = [2, 2, 3, 1, 2][m - 1];
        const actual = m === 3 && Math.random() > 0.7 ? expected + 5 : expected + Math.floor(Math.random() * 2);
        db.run('INSERT INTO material_consumption (cleaning_assignment_id, material_id, quantity, expected_quantity, status, anomaly_notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          i, m, actual, expected, actual > expected + 2 ? 'anomaly' : 'normal',
          actual > expected + 2 ? '消耗量异常偏高，需要核实' : null,
          '系统');
      }
    }
  }

  console.log('演示数据插入完成！');
});

db.close();
