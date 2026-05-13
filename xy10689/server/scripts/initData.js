const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

module.exports = function(db) {
  const rooms = [
    { id: uuidv4(), name: '大会议室A', capacity: 30, location: '1楼东侧', status: 'active' },
    { id: uuidv4(), name: '中会议室B', capacity: 15, location: '2楼西侧', status: 'active' },
    { id: uuidv4(), name: '小会议室C', capacity: 8, location: '3楼北侧', status: 'active' },
    { id: uuidv4(), name: '培训室D', capacity: 50, location: '1楼西侧', status: 'active' },
  ];

  const devices = [
    { id: uuidv4(), room_id: rooms[0].id, name: '投影机A-01', type: '激光投影', status: 'normal' },
    { id: uuidv4(), room_id: rooms[0].id, name: '音响系统A-01', type: '专业音响', status: 'normal' },
    { id: uuidv4(), room_id: rooms[1].id, name: '投影机B-01', type: '商务投影', status: 'normal' },
    { id: uuidv4(), room_id: rooms[2].id, name: '电视屏C-01', type: '智能电视', status: 'fault' },
    { id: uuidv4(), room_id: rooms[3].id, name: '投影机D-01', type: '工程投影', status: 'normal' },
  ];

  const bookings = [];
  const today = moment();
  
  for (let i = 0; i < 20; i++) {
    const dayOffset = Math.floor(Math.random() * 14) - 7;
    const startHour = 9 + Math.floor(Math.random() * 8);
    const duration = 1 + Math.floor(Math.random() * 3);
    
    bookings.push({
      id: uuidv4(),
      room_id: rooms[Math.floor(Math.random() * rooms.length)].id,
      user_name: ['张三', '李四', '王五', '赵六', '陈七'][Math.floor(Math.random() * 5)],
      title: ['项目周会', '客户演示', '产品评审', '技术培训', '团队讨论'][Math.floor(Math.random() * 5)],
      start_time: today.clone().add(dayOffset, 'days').hour(startHour).minute(0).format('YYYY-MM-DD HH:mm:ss'),
      end_time: today.clone().add(dayOffset, 'days').hour(startHour + duration).minute(0).format('YYYY-MM-DD HH:mm:ss'),
      status: Math.random() > 0.2 ? 'confirmed' : 'cancelled',
      attendees: 5 + Math.floor(Math.random() * 20),
      needs_projector: Math.random() > 0.3 ? 1 : 0,
    });
  }

  const teaServices = bookings.slice(0, 12).map((booking, i) => ({
    id: uuidv4(),
    booking_id: booking.id,
    type: ['绿茶', '咖啡', '矿泉水', '红茶'][Math.floor(Math.random() * 4)],
    quantity: 2 + Math.floor(Math.random() * 10),
    status: ['pending', 'preparing', 'completed', 'cancelled'][Math.floor(Math.random() * 4)],
    handler: ['服务员A', '服务员B', '服务员C'][Math.floor(Math.random() * 3)],
    handled_at: moment().subtract(Math.random() * 5, 'days').format('YYYY-MM-DD HH:mm:ss'),
  }));

  const faultTickets = [
    {
      id: uuidv4(),
      device_id: devices[3].id,
      reporter: '张三',
      description: '电视屏无法开机，指示灯不亮',
      status: 'in_progress',
      handler: '维修员A',
      resolution: null,
    },
    {
      id: uuidv4(),
      device_id: devices[0].id,
      reporter: '李四',
      description: '投影画面模糊，需要清洁镜头',
      status: 'resolved',
      handler: '维修员B',
      handled_at: moment().subtract(2, 'days').format('YYYY-MM-DD HH:mm:ss'),
      resolution: '已清洁镜头并校准',
    },
  ];

  const cancellations = bookings.filter(b => b.status === 'cancelled').map(booking => ({
    id: uuidv4(),
    booking_id: booking.id,
    reason: ['会议取消', '时间冲突', '场地变更'][Math.floor(Math.random() * 3)],
    cancelled_by: booking.user_name,
    released_hours: moment(booking.end_time).diff(moment(booking.start_time), 'hours', true),
  }));

  const anomalies = [
    {
      id: uuidv4(),
      type: 'overlap',
      entity_id: bookings[0].id,
      description: '预订时间与另一会议重叠',
      reason: '用户重复预订',
      status: 'resolved',
      handler: '管理员',
      handled_at: moment().subtract(1, 'days').format('YYYY-MM-DD HH:mm:ss'),
      correction_before: JSON.stringify({ start_time: bookings[0].start_time, end_time: bookings[0].end_time }),
      correction_after: JSON.stringify({ start_time: moment(bookings[0].start_time).add(1, 'hour').format('YYYY-MM-DD HH:mm:ss'), end_time: moment(bookings[0].end_time).add(1, 'hour').format('YYYY-MM-DD HH:mm:ss') }),
    },
    {
      id: uuidv4(),
      type: 'device_fault',
      entity_id: devices[3].id,
      description: '设备故障影响会议',
      reason: '硬件老化',
      status: 'pending',
    },
  ];

  const stmtRoom = db.prepare('INSERT INTO meeting_rooms (id, name, capacity, location, status) VALUES (?, ?, ?, ?, ?)');
  rooms.forEach(room => stmtRoom.run(room.id, room.name, room.capacity, room.location, room.status));
  stmtRoom.finalize();

  const stmtDevice = db.prepare('INSERT INTO projection_devices (id, room_id, name, type, status) VALUES (?, ?, ?, ?, ?)');
  devices.forEach(device => stmtDevice.run(device.id, device.room_id, device.name, device.type, device.status));
  stmtDevice.finalize();

  const stmtBooking = db.prepare('INSERT INTO bookings (id, room_id, user_name, title, start_time, end_time, status, attendees, needs_projector) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  bookings.forEach(booking => stmtBooking.run(booking.id, booking.room_id, booking.user_name, booking.title, booking.start_time, booking.end_time, booking.status, booking.attendees, booking.needs_projector));
  stmtBooking.finalize();

  const stmtTea = db.prepare('INSERT INTO tea_services (id, booking_id, type, quantity, status, handler, handled_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  teaServices.forEach(tea => stmtTea.run(tea.id, tea.booking_id, tea.type, tea.quantity, tea.status, tea.handler, tea.handled_at));
  stmtTea.finalize();

  const stmtTicket = db.prepare('INSERT INTO fault_tickets (id, device_id, reporter, description, status, handler, handled_at, resolution) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  faultTickets.forEach(ticket => stmtTicket.run(ticket.id, ticket.device_id, ticket.reporter, ticket.description, ticket.status, ticket.handler, ticket.handled_at, ticket.resolution));
  stmtTicket.finalize();

  const stmtCancel = db.prepare('INSERT INTO cancellations (id, booking_id, reason, cancelled_by, released_hours) VALUES (?, ?, ?, ?, ?)');
  cancellations.forEach(cancel => stmtCancel.run(cancel.id, cancel.booking_id, cancel.reason, cancel.cancelled_by, cancel.released_hours));
  stmtCancel.finalize();

  const stmtAnomaly = db.prepare('INSERT INTO anomalies (id, type, entity_id, description, reason, status, handler, handled_at, correction_before, correction_after) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  anomalies.forEach(a => stmtAnomaly.run(a.id, a.type, a.entity_id, a.description, a.reason, a.status, a.handler, a.handled_at, a.correction_before, a.correction_after));
  stmtAnomaly.finalize();

  console.log('初始化数据插入完成');
};
