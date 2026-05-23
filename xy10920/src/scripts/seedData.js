const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/property_repair.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('开始初始化基础数据（先清理旧数据）...');

  db.run('DELETE FROM reminder_records');
  db.run('DELETE FROM status_history');
  db.run('DELETE FROM outsource_assignments');
  db.run('DELETE FROM completion_proofs');
  db.run('DELETE FROM exception_records');
  db.run('DELETE FROM repair_orders');
  db.run('DELETE FROM rooms');
  db.run('DELETE FROM buildings');
  db.run('DELETE FROM handlers');
  
  db.run("DELETE FROM sqlite_sequence WHERE name IN ('buildings', 'rooms', 'handlers', 'repair_orders', 'reminder_records', 'status_history', 'outsource_assignments', 'completion_proofs', 'exception_records')");
  
  console.log('旧数据已清理，自增ID已重置');

  const buildings = [
    { building_no: '1栋', building_name: '1号楼', total_floors: 18 },
    { building_no: '2栋', building_name: '2号楼', total_floors: 22 },
    { building_no: '3栋', building_name: '3号楼', total_floors: 18 },
    { building_no: '4栋', building_name: '4号楼', total_floors: 26 },
    { building_no: '5栋', building_name: '5号楼', total_floors: 18 }
  ];

  const stmtBuilding = db.prepare('INSERT INTO buildings (building_no, building_name, total_floors, created_at) VALUES (?, ?, ?, datetime(\'now\'))');
  buildings.forEach(b => {
    stmtBuilding.run(b.building_no, b.building_name, b.total_floors);
  });
  stmtBuilding.finalize();
  console.log('楼栋数据初始化完成');

  const rooms = [
    { buildingId: 1, room_no: '101', owner_name: '张三', owner_phone: '13800138001' },
    { buildingId: 1, room_no: '102', owner_name: '李四', owner_phone: '13800138002' },
    { buildingId: 1, room_no: '201', owner_name: '王五', owner_phone: '13800138003' },
    { buildingId: 1, room_no: '202', owner_name: '赵六', owner_phone: '13800138004' },
    { buildingId: 2, room_no: '101', owner_name: '孙七', owner_phone: '13800138005' },
    { buildingId: 2, room_no: '102', owner_name: '周八', owner_phone: '13800138006' },
    { buildingId: 2, room_no: '301', owner_name: '吴九', owner_phone: '13800138007' },
    { buildingId: 3, room_no: '502', owner_name: '郑十', owner_phone: '13800138008' },
    { buildingId: 4, room_no: '801', owner_name: '陈一', owner_phone: '13800138009' },
    { buildingId: 5, room_no: '1201', owner_name: '刘二', owner_phone: '13800138010' }
  ];

  const stmtRoom = db.prepare('INSERT INTO rooms (building_id, room_no, owner_name, owner_phone, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))');
  rooms.forEach(r => {
    stmtRoom.run(r.buildingId, r.room_no, r.owner_name, r.owner_phone);
  });
  stmtRoom.finalize();
  console.log('房号数据初始化完成');

  const handlers = [
    { name: '王师傅', phone: '13900139001', department: '工程部', is_outsource: 0 },
    { name: '李师傅', phone: '13900139002', department: '工程部', is_outsource: 0 },
    { name: '张主管', phone: '13900139003', department: '客服部', is_outsource: 0 },
    { name: '刘经理', phone: '13900139004', department: '管理部', is_outsource: 0 },
    { name: '快修公司', phone: '400-888-0001', department: '外包', is_outsource: 1 },
    { name: '专业水电', phone: '400-888-0002', department: '外包', is_outsource: 1 }
  ];

  const stmtHandler = db.prepare('INSERT INTO handlers (name, phone, department, is_outsource, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))');
  handlers.forEach(h => {
    stmtHandler.run(h.name, h.phone, h.department, h.is_outsource);
  });
  stmtHandler.finalize();
  console.log('处理人数据初始化完成');

  const repairOrders = [
    {
      order_no: 'BX202605170001',
      room_id: 1,
      repair_type: '水电',
      description: '客厅灯不亮，需要更换灯泡',
      priority: 'normal',
      status: 'pending',
      handler_id: null,
      reported_by: '张三',
      reported_phone: '13800138001',
      reported_at: '2026-05-17 09:00:00',
      expected_completion_at: '2026-05-18 09:00:00'
    },
    {
      order_no: 'BX202605170002',
      room_id: 2,
      repair_type: '水电',
      description: '卫生间水龙头漏水',
      priority: 'urgent',
      status: 'processing',
      handler_id: 1,
      reported_by: '李四',
      reported_phone: '13800138002',
      reported_at: '2026-05-17 08:30:00',
      expected_completion_at: '2026-05-17 10:30:00'
    },
    {
      order_no: 'BX202605170003',
      room_id: 3,
      repair_type: '土建',
      description: '阳台墙面有裂缝',
      priority: 'low',
      status: 'outsourced',
      handler_id: 5,
      reported_by: '王五',
      reported_phone: '13800138003',
      reported_at: '2026-05-15 14:00:00',
      expected_completion_at: '2026-05-18 14:00:00',
      completed_at: null,
      is_timeout: 0,
      is_merged: 0,
      merged_from: null
    },
    {
      order_no: 'BX202605170004',
      room_id: 5,
      repair_type: '设备',
      description: '电梯异响，需要检修',
      priority: 'urgent',
      status: 'completed',
      handler_id: 2,
      reported_by: '孙七',
      reported_phone: '13800138005',
      reported_at: '2026-05-16 10:00:00',
      expected_completion_at: '2026-05-16 12:00:00',
      completed_at: '2026-05-16 11:30:00',
      is_timeout: 0,
      is_merged: 0,
      merged_from: null
    },
    {
      order_no: 'BX202605170005',
      room_id: 8,
      repair_type: '绿化',
      description: '楼下绿化有虫害',
      priority: 'normal',
      status: 'pending',
      handler_id: null,
      reported_by: '郑十',
      reported_phone: '13800138008',
      reported_at: '2026-05-16 20:00:00',
      expected_completion_at: '2026-05-17 20:00:00',
      is_timeout: 1,
      is_merged: 0,
      merged_from: null
    }
  ];

  const stmtOrder = db.prepare(`
    INSERT INTO repair_orders 
    (order_no, room_id, repair_type, description, priority, status, handler_id, 
     reported_by, reported_phone, reported_at, expected_completion_at, completed_at, 
     is_timeout, is_merged, merged_from, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  
  repairOrders.forEach(o => {
    stmtOrder.run(
      o.order_no, o.room_id, o.repair_type, o.description, o.priority, o.status, 
      o.handler_id, o.reported_by, o.reported_phone, o.reported_at, 
      o.expected_completion_at, o.completed_at, o.is_timeout, o.is_merged, o.merged_from
    );
  });
  stmtOrder.finalize();
  console.log('报修单数据初始化完成');

  const statusHistory = [
    { repair_order_id: 1, old_status: null, new_status: 'pending', changed_by: null, change_reason: '创建报修单' },
    { repair_order_id: 2, old_status: null, new_status: 'pending', changed_by: null, change_reason: '创建报修单' },
    { repair_order_id: 2, old_status: 'pending', new_status: 'assigned', changed_by: 3, change_reason: '分配处理人' },
    { repair_order_id: 2, old_status: 'assigned', new_status: 'processing', changed_by: 1, change_reason: '开始处理' },
    { repair_order_id: 3, old_status: null, new_status: 'pending', changed_by: null, change_reason: '创建报修单' },
    { repair_order_id: 3, old_status: 'pending', new_status: 'outsourced', changed_by: 4, change_reason: '转外包处理' },
    { repair_order_id: 4, old_status: null, new_status: 'pending', changed_by: null, change_reason: '创建报修单' },
    { repair_order_id: 4, old_status: 'pending', new_status: 'assigned', changed_by: 3, change_reason: '分配处理人' },
    { repair_order_id: 4, old_status: 'assigned', new_status: 'processing', changed_by: 2, change_reason: '开始处理' },
    { repair_order_id: 4, old_status: 'processing', new_status: 'completed', changed_by: 2, change_reason: '处理完成' },
    { repair_order_id: 5, old_status: null, new_status: 'pending', changed_by: null, change_reason: '创建报修单' }
  ];

  const stmtHistory = db.prepare(`
    INSERT INTO status_history 
    (repair_order_id, old_status, new_status, changed_by, change_reason, changed_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);
  
  statusHistory.forEach(h => {
    stmtHistory.run(h.repair_order_id, h.old_status, h.new_status, h.changed_by, h.change_reason);
  });
  stmtHistory.finalize();
  console.log('状态历史数据初始化完成');

  const outsourceAssignments = [
    {
      repair_order_id: 3,
      outsource_company: '快修公司',
      outsource_contact: '陈工',
      outsource_phone: '13700137001',
      assigned_at: '2026-05-15 15:00:00',
      promised_completion_at: '2026-05-18 18:00:00',
      actual_completion_at: null,
      status: 'assigned',
      cost: 500.00
    }
  ];

  const stmtOutsource = db.prepare(`
    INSERT INTO outsource_assignments 
    (repair_order_id, outsource_company, outsource_contact, outsource_phone, 
     assigned_at, promised_completion_at, actual_completion_at, status, cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  outsourceAssignments.forEach(a => {
    stmtOutsource.run(
      a.repair_order_id, a.outsource_company, a.outsource_contact, a.outsource_phone,
      a.assigned_at, a.promised_completion_at, a.actual_completion_at, a.status, a.cost
    );
  });
  stmtOutsource.finalize();
  console.log('外包派单数据初始化完成');

  const reminderRecords = [
    {
      repair_order_id: 5,
      reminder_type: 'timeout',
      reminder_content: '该报修单已超时，请尽快处理',
      reminded_by: '系统',
      reminded_at: '2026-05-17 20:00:00',
      is_duplicate: 0,
      merged_to: null
    }
  ];

  const stmtReminder = db.prepare(`
    INSERT INTO reminder_records 
    (repair_order_id, reminder_type, reminder_content, reminded_by, reminded_at, is_duplicate, merged_to)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  reminderRecords.forEach(r => {
    stmtReminder.run(
      r.repair_order_id, r.reminder_type, r.reminder_content, 
      r.reminded_by, r.reminded_at, r.is_duplicate, r.merged_to
    );
  });
  stmtReminder.finalize();
  console.log('催办记录数据初始化完成');

  console.log('所有数据初始化完成！');
});

db.close();
