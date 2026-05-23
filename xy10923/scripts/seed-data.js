const db = require('../src/config/database');

const seedData = () => {
  const routes = [
    { id: 'route-001', route_name: '1号线(东校区)', route_code: 'ROUTE001', driver_name: '张师傅', driver_phone: '13800138001', capacity: 45 },
    { id: 'route-002', route_name: '2号线(西校区)', route_code: 'ROUTE002', driver_name: '李师傅', driver_phone: '13800138002', capacity: 40 },
    { id: 'route-003', route_name: '3号线(南校区)', route_code: 'ROUTE003', driver_name: '王师傅', driver_phone: '13800138003', capacity: 50 }
  ];

  const stops = [
    { id: 'stop-001', stop_name: '东门广场站', stop_code: 'STOP001', address: '市东门广场公交站', is_temporary: 0 },
    { id: 'stop-002', stop_name: '花园小区站', stop_code: 'STOP002', address: '花园小区北门', is_temporary: 0 },
    { id: 'stop-003', stop_name: '图书馆站', stop_code: 'STOP003', address: '市图书馆门口', is_temporary: 0 },
    { id: 'stop-004', stop_name: '体育中心站', stop_code: 'STOP004', address: '体育中心西门', is_temporary: 0 },
    { id: 'stop-temp-001', stop_name: '临时站A', stop_code: 'TEMP001', address: '东门广场东侧500米', is_temporary: 1 },
    { id: 'stop-temp-002', stop_name: '临时站B', stop_code: 'TEMP002', address: '花园小区南门', is_temporary: 1 }
  ];

  const students = [
    { id: 'stu-001', student_name: '小明', student_no: 'STU001', grade: '三年级', class_name: '1班', parent_name: '明爸爸', parent_phone: '13900139001', route_id: routes[0].id, default_stop_id: stops[0].id },
    { id: 'stu-002', student_name: '小红', student_no: 'STU002', grade: '三年级', class_name: '2班', parent_name: '红妈妈', parent_phone: '13900139002', route_id: routes[0].id, default_stop_id: stops[1].id },
    { id: 'stu-003', student_name: '小华', student_no: 'STU003', grade: '四年级', class_name: '1班', parent_name: '华爸爸', parent_phone: '13900139003', route_id: routes[0].id, default_stop_id: stops[2].id },
    { id: 'stu-004', student_name: '小丽', student_no: 'STU004', grade: '四年级', class_name: '2班', parent_name: '丽妈妈', parent_phone: '13900139004', route_id: routes[1].id, default_stop_id: stops[0].id },
    { id: 'stu-005', student_name: '小强', student_no: 'STU005', grade: '五年级', class_name: '1班', parent_name: '强爸爸', parent_phone: '13900139005', route_id: routes[1].id, default_stop_id: stops[3].id }
  ];

  const detourReasons = [
    { id: 'reason-001', reason_code: 'CONS001', reason_name: '道路施工', description: '市政道路维修施工', severity: 'high' },
    { id: 'reason-002', reason_code: 'TRAFFIC001', reason_name: '交通管制', description: '重大活动交通管制', severity: 'medium' },
    { id: 'reason-003', reason_code: 'ACCIDENT001', reason_name: '交通事故', description: '突发交通事故', severity: 'high' },
    { id: 'reason-004', reason_code: 'WEATHER001', reason_name: '恶劣天气', description: '暴雨、大雪等恶劣天气', severity: 'medium' }
  ];

  const routeStops = [
    { id: 'rs-001', route_id: routes[0].id, stop_id: stops[0].id, stop_order: 1, arrival_time: '07:00' },
    { id: 'rs-002', route_id: routes[0].id, stop_id: stops[1].id, stop_order: 2, arrival_time: '07:10' },
    { id: 'rs-003', route_id: routes[0].id, stop_id: stops[2].id, stop_order: 3, arrival_time: '07:20' },
    { id: 'rs-004', route_id: routes[1].id, stop_id: stops[0].id, stop_order: 1, arrival_time: '07:05' },
    { id: 'rs-005', route_id: routes[1].id, stop_id: stops[3].id, stop_order: 2, arrival_time: '07:15' }
  ];

  const insertRoute = db.prepare('INSERT OR IGNORE INTO routes (id, route_name, route_code, driver_name, driver_phone, capacity) VALUES (?, ?, ?, ?, ?, ?)');
  const insertStop = db.prepare('INSERT OR IGNORE INTO stops (id, stop_name, stop_code, address, is_temporary) VALUES (?, ?, ?, ?, ?)');
  const insertStudent = db.prepare('INSERT OR IGNORE INTO students (id, student_name, student_no, grade, class_name, parent_name, parent_phone, route_id, default_stop_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertReason = db.prepare('INSERT OR IGNORE INTO detour_reasons (id, reason_code, reason_name, description, severity) VALUES (?, ?, ?, ?, ?)');
  const insertRouteStop = db.prepare('INSERT OR IGNORE INTO route_stops (id, route_id, stop_id, stop_order, arrival_time) VALUES (?, ?, ?, ?, ?)');

  const transaction = db.transaction(() => {
    routes.forEach(r => insertRoute.run(r.id, r.route_name, r.route_code, r.driver_name, r.driver_phone, r.capacity));
    stops.forEach(s => insertStop.run(s.id, s.stop_name, s.stop_code, s.address, s.is_temporary));
    students.forEach(s => insertStudent.run(s.id, s.student_name, s.student_no, s.grade, s.class_name, s.parent_name, s.parent_phone, s.route_id, s.default_stop_id));
    detourReasons.forEach(r => insertReason.run(r.id, r.reason_code, r.reason_name, r.description, r.severity));
    routeStops.forEach(rs => insertRouteStop.run(rs.id, rs.route_id, rs.stop_id, rs.stop_order, rs.arrival_time));
  });

  transaction();
  console.log('样例数据导入完成');
};

seedData();

if (require.main === module) {
  db.close();
}
