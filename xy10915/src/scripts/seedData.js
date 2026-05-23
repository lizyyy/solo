const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const today = new Date().toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

const sampleData = {
  elders: [
    { id: uuidv4(), name: '张爷爷', id_card: '110101194001011234', room_number: '101', bed_number: 'A', health_status: '良好', guardian_name: '张明', guardian_phone: '13800138001' },
    { id: uuidv4(), name: '李奶奶', id_card: '110101194502021234', room_number: '101', bed_number: 'B', health_status: '良好', guardian_name: '李华', guardian_phone: '13800138002' },
    { id: uuidv4(), name: '王爷爷', id_card: '110101193803031234', room_number: '102', bed_number: 'A', health_status: '需要特殊照顾', guardian_name: '王强', guardian_phone: '13800138003' },
  ],
  visitors: [
    { id: uuidv4(), name: '张明', id_card: '110101197001011234', phone: '13800138001', relation: '儿子' },
    { id: uuidv4(), name: '李华', id_card: '110101197502021234', phone: '13800138002', relation: '女儿' },
    { id: uuidv4(), name: '王芳', id_card: '110101198003031234', phone: '13800138004', relation: '孙女' },
  ],
  rooms: [
    { id: uuidv4(), room_number: '101', capacity: 2, floor: 1, area: '颐养区', description: '双人标准间' },
    { id: uuidv4(), room_number: '102', capacity: 2, floor: 1, area: '颐养区', description: '双人标准间' },
    { id: uuidv4(), room_number: '201', capacity: 2, floor: 2, area: '护理区', description: '护理专用房间' },
  ],
  timeSlots: [
    { id: uuidv4(), date: today, start_time: '09:00', end_time: '10:00', max_visitors: 10 },
    { id: uuidv4(), date: today, start_time: '10:30', end_time: '11:30', max_visitors: 10 },
    { id: uuidv4(), date: today, start_time: '14:00', end_time: '15:00', max_visitors: 10 },
    { id: uuidv4(), date: today, start_time: '15:30', end_time: '16:30', max_visitors: 10 },
    { id: uuidv4(), date: tomorrow, start_time: '09:00', end_time: '10:00', max_visitors: 10 },
    { id: uuidv4(), date: tomorrow, start_time: '10:30', end_time: '11:30', max_visitors: 10 },
  ]
};

db.serialize(() => {
  const insertElder = db.prepare('INSERT INTO elders (id, name, id_card, room_number, bed_number, health_status, guardian_name, guardian_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  sampleData.elders.forEach(elder => {
    insertElder.run(elder.id, elder.name, elder.id_card, elder.room_number, elder.bed_number, elder.health_status, elder.guardian_name, elder.guardian_phone);
  });
  insertElder.finalize();
  console.log(`已插入 ${sampleData.elders.length} 位老人档案`);

  const insertVisitor = db.prepare('INSERT INTO visitors (id, name, id_card, phone, relation) VALUES (?, ?, ?, ?, ?)');
  sampleData.visitors.forEach(visitor => {
    insertVisitor.run(visitor.id, visitor.name, visitor.id_card, visitor.phone, visitor.relation);
  });
  insertVisitor.finalize();
  console.log(`已插入 ${sampleData.visitors.length} 位探访人`);

  const insertRoom = db.prepare('INSERT INTO rooms (id, room_number, capacity, floor, area, description) VALUES (?, ?, ?, ?, ?, ?)');
  sampleData.rooms.forEach(room => {
    insertRoom.run(room.id, room.room_number, room.capacity, room.floor, room.area, room.description);
  });
  insertRoom.finalize();
  console.log(`已插入 ${sampleData.rooms.length} 个房间`);

  const insertTimeSlot = db.prepare('INSERT INTO time_slots (id, date, start_time, end_time, max_visitors, current_visitors, status) VALUES (?, ?, ?, ?, ?, 0, \'available\')');
  sampleData.timeSlots.forEach(slot => {
    insertTimeSlot.run(slot.id, slot.date, slot.start_time, slot.end_time, slot.max_visitors);
  });
  insertTimeSlot.finalize();
  console.log(`已插入 ${sampleData.timeSlots.length} 个时间段`);

  const appointmentId = uuidv4();
  db.run(`
    INSERT INTO appointments (id, elder_id, visitor_id, time_slot_id, room_id, visitor_count, status, notes, created_by)
    VALUES (?, ?, ?, ?, ?, 1, 'pending', '预约探访', 'system')
  `, [appointmentId, sampleData.elders[0].id, sampleData.visitors[0].id, sampleData.timeSlots[0].id, sampleData.rooms[0].id], (err) => {
    if (err) {
      console.error('创建预约失败:', err);
    } else {
      console.log('已创建1个示例预约');
      
      db.run(`
        INSERT INTO appointment_status_history (id, appointment_id, previous_status, new_status, changed_by, change_reason)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [uuidv4(), appointmentId, null, 'pending', 'system', '创建预约']);
    }
  });

  setTimeout(() => {
    db.close();
    console.log('\n样例数据导入完成!');
    console.log(`\n数据摘要:`);
    console.log(`  - 老人: ${sampleData.elders.map(e => e.name).join(', ')}`);
    console.log(`  - 探访人: ${sampleData.visitors.map(v => v.name).join(', ')}`);
    console.log(`  - 房间: ${sampleData.rooms.map(r => r.room_number).join(', ')}`);
    console.log(`  - 时间段: ${today} 和 ${tomorrow} 各4个时间段`);
  }, 1000);
});
