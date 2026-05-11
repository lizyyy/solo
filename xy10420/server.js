const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'school_bus_db.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

let db = {
  routes: [],
  stations: [],
  route_stations: [],
  students: [],
  leaves: [],
  reroutes: [],
  reroute_stations: [],
  driver_confirmations: [],
  notifications: [],
  ride_logs: [],
  boardings: [],
  users: []
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadDatabase() {
  ensureDataDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(data);
    } catch (e) {
      console.error('加载数据库失败，使用默认数据', e);
      initDatabase();
    }
  } else {
    initDatabase();
  }
}

function saveDatabase() {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function getNextId(collection) {
  if (db[collection].length === 0) return 1;
  const maxId = Math.max(...db[collection].map(item => item.id));
  return maxId + 1;
}

function initDatabase() {
  db = {
    routes: [],
    stations: [],
    route_stations: [],
    students: [],
    leaves: [],
    reroutes: [],
    reroute_stations: [],
    driver_confirmations: [],
    notifications: [],
    ride_logs: [],
    boardings: [],
    users: []
  };
  
  const insertUser = (username, name, role) => {
    db.users.push({
      id: getNextId('users'),
      username,
      name,
      role
    });
  };
  
  insertUser('dispatcher1', '张调度', 'dispatcher');
  insertUser('driver1', '李司机', 'driver');
  insertUser('driver2', '王司机', 'driver');
  
  seedSampleData();
  saveDatabase();
}

function seedSampleData() {
  const insertRoute = (name, description) => {
    const id = getNextId('routes');
    db.routes.push({ id, name, description, created_at: new Date().toISOString() });
    return id;
  };
  
  const r1 = insertRoute('1号线（早班）', '早晨接送学生上学');
  const r2 = insertRoute('2号线（早班）', '早晨接送学生上学');
  
  const insertStation = (name, address) => {
    const id = getNextId('stations');
    db.stations.push({ id, name, address });
    return id;
  };
  
  const s1 = insertStation('阳光小区北门', '阳光路1号');
  const s2 = insertStation('幸福家园', '幸福路2号');
  const s3 = insertStation('锦绣花园', '锦绣路3号');
  const s4 = insertStation('金色年华', '金色大道4号');
  const s5 = insertStation('临时站点A', '备用站点A地址');
  const s6 = insertStation('临时站点B', '备用站点B地址');
  const s7 = insertStation('阳光小区南门', '阳光路1号南门');
  
  const insertRouteStation = (route_id, station_id, station_order, estimated_arrival_time, estimated_duration) => {
    db.route_stations.push({
      id: getNextId('route_stations'),
      route_id,
      station_id,
      station_order,
      estimated_arrival_time,
      estimated_duration: estimated_duration || 5
    });
  };
  
  insertRouteStation(r1, s1, 1, '07:00', 5);
  insertRouteStation(r1, s2, 2, '07:10', 5);
  insertRouteStation(r1, s3, 3, '07:20', 5);
  insertRouteStation(r1, s4, 4, '07:30', 5);
  
  insertRouteStation(r2, s5, 1, '07:05', 5);
  insertRouteStation(r2, s6, 2, '07:15', 5);
  insertRouteStation(r2, s7, 3, '07:25', 5);
  
  const insertStudent = (name, student_no, route_id, station_id, parent_name, parent_phone, className) => {
    db.students.push({
      id: getNextId('students'),
      name,
      student_no,
      route_id,
      station_id,
      parent_name,
      parent_phone,
      class: className
    });
  };
  
  insertStudent('小明', 'S001', r1, s1, '小明爸爸', '13800138001', '一年级1班');
  insertStudent('小红', 'S002', r1, s1, '小红妈妈', '13800138002', '一年级2班');
  insertStudent('小华', 'S003', r1, s2, '小华爸爸', '13800138003', '二年级1班');
  insertStudent('小丽', 'S004', r1, s3, '小丽妈妈', '13800138004', '二年级2班');
  insertStudent('小强', 'S005', r1, s4, '小强爸爸', '13800138005', '三年级1班');
  
  insertStudent('小刚', 'S006', r2, s5, '小刚妈妈', '13800138006', '三年级2班');
  insertStudent('小芳', 'S007', r2, s6, '小芳爸爸', '13800138007', '四年级1班');
  
  const today = new Date().toISOString().split('T')[0];
  
  db.leaves.push({
    id: getNextId('leaves'),
    student_id: 2,
    leave_date: today,
    reason: '身体不适',
    status: 'approved',
    created_at: new Date().toISOString(),
    created_by: '张调度'
  });
  
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  
  const oldStations = db.route_stations.filter(rs => rs.route_id === r1).sort((a, b) => a.station_order - b.station_order);
  const oldRouteJson = oldStations.map(rs => ({
    id: rs.station_id,
    station_id: rs.station_id,
    station_order: rs.station_order,
    estimated_arrival_time: rs.estimated_arrival_time,
    estimated_duration: rs.estimated_duration,
    name: db.stations.find(s => s.id === rs.station_id)?.name
  }));
  
  const newStations = [
    { station_id: s1, station_order: 1, estimated_arrival_time: '07:05', estimated_duration: 5 },
    { station_id: s5, station_order: 2, estimated_arrival_time: '07:15', estimated_duration: 5 },
    { station_id: s4, station_order: 3, estimated_arrival_time: '07:35', estimated_duration: 5 }
  ];
  
  const rerouteId = getNextId('reroutes');
  db.reroutes.push({
    id: rerouteId,
    route_id: r1,
    original_route: JSON.stringify(oldRouteJson),
    new_route: JSON.stringify(newStations),
    reason: '修路绕行：幸福家园站点绕行',
    status: 'approved',
    created_at: new Date().toISOString(),
    created_by: '张调度',
    approved_at: new Date().toISOString(),
    approved_by: '张调度',
    scheduled_date: tomorrow
  });
  
  newStations.forEach(st => {
    db.reroute_stations.push({
      id: getNextId('reroute_stations'),
      reroute_id: rerouteId,
      station_id: st.station_id,
      station_order: st.station_order,
      estimated_arrival_time: st.estimated_arrival_time,
      action: null
    });
  });
  
  const oldStations2 = db.route_stations.filter(rs => rs.route_id === r2).sort((a, b) => a.station_order - b.station_order);
  const oldRouteJson2 = oldStations2.map(rs => ({
    id: rs.station_id,
    station_id: rs.station_id,
    station_order: rs.station_order,
    estimated_arrival_time: rs.estimated_arrival_time,
    estimated_duration: rs.estimated_duration,
    name: db.stations.find(s => s.id === rs.station_id)?.name
  }));
  
  db.reroutes.push({
    id: getNextId('reroutes'),
    route_id: r2,
    original_route: JSON.stringify(oldRouteJson2),
    new_route: JSON.stringify([{ station_id: s5, station_order: 1, estimated_arrival_time: '07:00', estimated_duration: 5 }]),
    reason: '临时站点调整',
    status: 'pending',
    created_at: new Date().toISOString(),
    created_by: '张调度',
    approved_at: null,
    approved_by: null,
    scheduled_date: tomorrow
  });
  
  const boardingStudents = [1, 3, 4];
  boardingStudents.forEach((studentId, index) => {
    db.boardings.push({
      id: getNextId('boardings'),
      student_id: studentId,
      route_id: r1,
      date: today,
      boarded_at: new Date().toISOString(),
      boarding_order: index + 1
    });
  });
  
  db.ride_logs.push({
    id: getNextId('ride_logs'),
    route_id: r1,
    date: today,
    reroute_id: null,
    bus_status: 'in_progress',
    departed_at: new Date().toISOString(),
    arrived_at: null
  });
}

loadDatabase();

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function calculateArrivalTimes(stations, baseTime = '07:00') {
  let currentTime = new Date(`2000-01-01T${baseTime}:00`);
  return stations.map((station, index) => {
    const arrival = new Date(currentTime);
    const hours = String(arrival.getHours()).padStart(2, '0');
    const minutes = String(arrival.getMinutes()).padStart(2, '0');
    currentTime = new Date(arrival.getTime() + (station.estimated_duration || 5) * 60000);
    return {
      ...station,
      calculated_arrival: `${hours}:${minutes}`
    };
  });
}

app.get('/api/routes', (req, res) => {
  res.json(db.routes);
});

app.get('/api/routes/:id', (req, res) => {
  const routeId = parseInt(req.params.id);
  const route = db.routes.find(r => r.id === routeId);
  if (route) {
    const routeStations = db.route_stations
      .filter(rs => rs.route_id === routeId)
      .sort((a, b) => a.station_order - b.station_order);
    
    const stationsWithDetails = routeStations.map(rs => {
      const station = db.stations.find(s => s.id === rs.station_id);
      return {
        ...rs,
        ...station
      };
    });
    
    route.stations = calculateArrivalTimes(stationsWithDetails);
  }
  res.json(route);
});

app.get('/api/stations', (req, res) => {
  res.json(db.stations);
});

app.get('/api/students', (req, res) => {
  const routeId = req.query.route_id ? parseInt(req.query.route_id) : null;
  let students = db.students;
  
  if (routeId) {
    students = students.filter(s => s.route_id === routeId);
  }
  
  const studentsWithDetails = students.map(s => ({
    ...s,
    station_name: db.stations.find(st => st.id === s.station_id)?.name,
    route_name: db.routes.find(r => r.id === s.route_id)?.name
  }));
  
  res.json(studentsWithDetails);
});

app.get('/api/students/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const student = db.students.find(s => s.id === id);
  if (student) {
    student.station_name = db.stations.find(st => st.id === student.station_id)?.name;
    student.route_name = db.routes.find(r => r.id === student.route_id)?.name;
  }
  res.json(student);
});

app.get('/api/leaves', (req, res) => {
  const { date, student_id } = req.query;
  let leaves = db.leaves;
  
  if (date) {
    leaves = leaves.filter(l => l.leave_date === date);
  }
  if (student_id) {
    leaves = leaves.filter(l => l.student_id === parseInt(student_id));
  }
  
  leaves = [...leaves].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(leaves);
});

app.post('/api/leaves', (req, res) => {
  const { student_id, leave_date, reason, created_by } = req.body;
  
  const existing = db.leaves.find(l => l.student_id === student_id && l.leave_date === leave_date);
  if (existing) {
    return res.status(400).json({ error: '该学生当天已请假' });
  }
  
  const leave = {
    id: getNextId('leaves'),
    student_id,
    leave_date,
    reason,
    status: 'approved',
    created_at: new Date().toISOString(),
    created_by: created_by || '系统'
  };
  
  db.leaves.push(leave);
  
  db.notifications.push({
    id: getNextId('notifications'),
    type: 'leave',
    student_id,
    route_id: null,
    reroute_id: null,
    recipient: null,
    message: `学生请假通知：${leave_date}请假`,
    sent_at: new Date().toISOString(),
    status: 'sent'
  });
  
  saveDatabase();
  res.json({ id: leave.id });
});

app.get('/api/reroutes', (req, res) => {
  const { status, date, route_id } = req.query;
  let reroutes = db.reroutes;
  
  if (status) {
    reroutes = reroutes.filter(r => r.status === status);
  }
  if (date) {
    reroutes = reroutes.filter(r => r.scheduled_date === date);
  }
  if (route_id) {
    reroutes = reroutes.filter(r => r.route_id === parseInt(route_id));
  }
  
  reroutes = [...reroutes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  const result = reroutes.map(reroute => ({
    ...reroute,
    original_route: JSON.parse(reroute.original_route || '[]'),
    new_route: JSON.parse(reroute.new_route || '[]')
  }));
  
  res.json(result);
});

app.get('/api/reroutes/:id', (req, res) => {
  const rerouteId = parseInt(req.params.id);
  const reroute = db.reroutes.find(r => r.id === rerouteId);
  
  if (!reroute) {
    return res.status(404).json({ error: '改线记录不存在' });
  }
  
  const stations = db.reroute_stations
    .filter(rs => rs.reroute_id === rerouteId)
    .sort((a, b) => a.station_order - b.station_order)
    .map(rs => ({
      ...rs,
      station_name: db.stations.find(s => s.id === rs.station_id)?.name,
      address: db.stations.find(s => s.id === rs.station_id)?.address
    }));
  
  res.json({
    ...reroute,
    original_route: JSON.parse(reroute.original_route || '[]'),
    new_route: JSON.parse(reroute.new_route || '[]'),
    stations
  });
});

app.post('/api/reroutes', (req, res) => {
  const { route_id, reason, scheduled_date, new_stations, created_by } = req.body;
  
  const today = getToday();
  const targetDate = scheduled_date || today;
  
  const rideLog = db.ride_logs.find(
    rl => rl.route_id === route_id && 
          rl.date === targetDate && 
          ['in_progress', 'completed'].includes(rl.bus_status)
  );
  
  if (rideLog) {
    return res.status(400).json({ error: '该线路当日已发车，无法改线，请先审批' });
  }
  
  const originalStations = db.route_stations
    .filter(rs => rs.route_id === route_id)
    .sort((a, b) => a.station_order - b.station_order)
    .map(rs => ({
      id: rs.station_id,
      station_id: rs.station_id,
      station_order: rs.station_order,
      estimated_arrival_time: rs.estimated_arrival_time,
      estimated_duration: rs.estimated_duration,
      name: db.stations.find(s => s.id === rs.station_id)?.name
    }));
  
  const calculatedNewStations = calculateArrivalTimes(new_stations);
  
  const rerouteId = getNextId('reroutes');
  const reroute = {
    id: rerouteId,
    route_id,
    original_route: JSON.stringify(originalStations),
    new_route: JSON.stringify(calculatedNewStations),
    reason,
    status: 'pending',
    created_at: new Date().toISOString(),
    created_by: created_by || '系统',
    approved_at: null,
    approved_by: null,
    scheduled_date: targetDate
  };
  
  db.reroutes.push(reroute);
  
  calculatedNewStations.forEach(st => {
    db.reroute_stations.push({
      id: getNextId('reroute_stations'),
      reroute_id: rerouteId,
      station_id: st.station_id,
      station_order: st.station_order,
      estimated_arrival_time: st.calculated_arrival,
      action: null
    });
  });
  
  saveDatabase();
  res.json({ id: rerouteId });
});

app.post('/api/reroutes/:id/approve', (req, res) => {
  const { approved_by } = req.body;
  const rerouteId = parseInt(req.params.id);
  
  const reroute = db.reroutes.find(r => r.id === rerouteId);
  if (!reroute) {
    return res.status(404).json({ error: '改线记录不存在' });
  }
  
  const rideLog = db.ride_logs.find(
    rl => rl.route_id === reroute.route_id && 
          rl.date === reroute.scheduled_date && 
          ['in_progress', 'completed'].includes(rl.bus_status)
  );
  
  if (rideLog) {
    return res.status(400).json({ error: '该线路当日已发车，无法审批改线' });
  }
  
  reroute.status = 'approved';
  reroute.approved_at = new Date().toISOString();
  reroute.approved_by = approved_by || '系统';
  
  const students = db.students.filter(s => s.route_id === reroute.route_id);
  
  students.forEach(student => {
    db.notifications.push({
      id: getNextId('notifications'),
      type: 'reroute',
      route_id: reroute.route_id,
      student_id: student.id,
      reroute_id: rerouteId,
      recipient: student.parent_name,
      message: '线路改线通知：请关注新的乘车时间和站点',
      sent_at: new Date().toISOString(),
      status: 'sent'
    });
  });
  
  saveDatabase();
  res.json({ success: true });
});

app.post('/api/driver/confirm', (req, res) => {
  const { reroute_id, route_id, driver_name, notes } = req.body;
  const today = getToday();
  
  if (reroute_id) {
    const reroute = db.reroutes.find(r => r.id === reroute_id);
    if (reroute && reroute.status !== 'approved') {
      return res.status(400).json({ error: '该改线尚未审批通过' });
    }
  }
  
  const confirmation = {
    id: getNextId('driver_confirmations'),
    reroute_id: reroute_id || null,
    route_id,
    date: today,
    driver_name: driver_name || '未知司机',
    confirmed_at: new Date().toISOString(),
    status: 'confirmed',
    notes: notes || ''
  };
  
  db.driver_confirmations.push(confirmation);
  saveDatabase();
  res.json({ id: confirmation.id });
});

app.get('/api/driver/confirmations', (req, res) => {
  const { date, route_id } = req.query;
  let confirmations = db.driver_confirmations;
  
  if (date) {
    confirmations = confirmations.filter(c => c.date === date);
  }
  if (route_id) {
    confirmations = confirmations.filter(c => c.route_id === parseInt(route_id));
  }
  
  confirmations = [...confirmations].sort((a, b) => new Date(b.confirmed_at) - new Date(a.confirmed_at));
  res.json(confirmations);
});

app.get('/api/notifications', (req, res) => {
  const { type, date } = req.query;
  let notifications = db.notifications;
  
  if (type) {
    notifications = notifications.filter(n => n.type === type);
  }
  
  notifications = [...notifications].sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
  
  const result = notifications.map(n => ({
    ...n,
    student_name: db.students.find(s => s.id === n.student_id)?.name,
    route_name: db.routes.find(r => r.id === n.route_id)?.name
  }));
  
  res.json(result);
});

app.post('/api/ride/boarding', (req, res) => {
  const { student_id, route_id, date } = req.body;
  const today = date || getToday();
  
  const boarding = db.boardings.find(
    b => b.student_id === student_id && b.date === today
  );
  
  if (boarding) {
    return res.status(400).json({ error: '该学生今日已上车，请勿重复操作' });
  }
  
  const leave = db.leaves.find(
    l => l.student_id === student_id && l.leave_date === today && l.status === 'approved'
  );
  
  if (leave) {
    return res.status(400).json({ error: '该学生今日已请假，不应安排接送' });
  }
  
  const boardingsCount = db.boardings.filter(
    b => b.route_id === route_id && b.date === today
  ).length;
  
  db.boardings.push({
    id: getNextId('boardings'),
    student_id,
    route_id,
    date: today,
    boarded_at: new Date().toISOString(),
    boarding_order: boardingsCount + 1
  });
  
  saveDatabase();
  res.json({ success: true });
});

app.post('/api/ride/depart', (req, res) => {
  const { route_id, date } = req.body;
  const today = date || getToday();
  
  let rideLog = db.ride_logs.find(rl => rl.route_id === route_id && rl.date === today);
  
  if (rideLog && rideLog.bus_status !== 'not_departed') {
    return res.status(400).json({ error: '该线路今日已发车' });
  }
  
  if (rideLog) {
    rideLog.bus_status = 'in_progress';
    rideLog.departed_at = new Date().toISOString();
  } else {
    db.ride_logs.push({
      id: getNextId('ride_logs'),
      route_id,
      date: today,
      reroute_id: null,
      bus_status: 'in_progress',
      departed_at: new Date().toISOString(),
      arrived_at: null
    });
  }
  
  saveDatabase();
  res.json({ success: true });
});

app.get('/api/daily-report', (req, res) => {
  const date = req.query.date || getToday();
  
  const report = db.routes.map(route => {
    const students = db.students.filter(s => s.route_id === route.id);
    const leaves = db.leaves.filter(
      l => l.leave_date === date && students.some(s => s.id === l.student_id)
    ).map(l => ({
      ...l,
      student_name: db.students.find(s => s.id === l.student_id)?.name
    }));
    
    const boardings = db.boardings.filter(
      b => b.date === date && students.some(s => s.id === b.student_id)
    ).map(b => ({
      ...b,
      student_name: db.students.find(s => s.id === b.student_id)?.name
    }));
    
    const reroute = db.reroutes.find(
      r => r.route_id === route.id && r.scheduled_date === date && r.status === 'approved'
    );
    
    const confirmation = db.driver_confirmations.find(
      c => c.route_id === route.id && c.date === date
    );
    
    const rideLog = db.ride_logs.find(
      rl => rl.route_id === route.id && rl.date === date
    );
    
    const notificationsCount = db.notifications.filter(
      n => n.route_id === route.id && n.sent_at.startsWith(date)
    ).length;
    
    return {
      route_id: route.id,
      route_name: route.name,
      total_students: students.length,
      leave_count: leaves.length,
      boarding_count: boardings.length,
      leaves,
      boardings,
      reroute,
      has_reroute: !!reroute,
      driver_confirmed: !!confirmation,
      driver_confirmation: confirmation,
      bus_status: rideLog ? rideLog.bus_status : 'not_departed',
      notifications_count: notificationsCount
    };
  });
  
  res.json({
    date,
    total_routes: db.routes.length,
    report
  });
});

app.get('/api/pending-notifications', (req, res) => {
  const date = req.query.date || getToday();
  
  const reroutes = db.reroutes
    .filter(r => r.scheduled_date === date && r.status === 'approved')
    .map(r => ({
      ...r,
      route_name: db.routes.find(rt => rt.id === r.route_id)?.name
    }));
  
  const leaves = db.leaves
    .filter(l => l.leave_date === date)
    .map(l => ({
      ...l,
      student_name: db.students.find(s => s.id === l.student_id)?.name,
      parent_name: db.students.find(s => s.id === l.student_id)?.parent_name,
      parent_phone: db.students.find(s => s.id === l.student_id)?.parent_phone
    }));
  
  const pendingParents = [];
  
  reroutes.forEach(reroute => {
    const students = db.students.filter(s => s.route_id === reroute.route_id);
    
    students.forEach(student => {
      const notified = db.notifications.find(
        n => n.reroute_id === reroute.id && n.student_id === student.id
      );
      
      if (!notified) {
        pendingParents.push({
          type: 'reroute',
          student_id: student.id,
          student_name: student.name,
          parent_name: student.parent_name,
          parent_phone: student.parent_phone,
          route_name: reroute.route_name,
          reroute_id: reroute.id,
          reason: reroute.reason
        });
      }
    });
  });
  
  res.json({
    reroutes,
    leaves,
    pending_parents: pendingParents
  });
});

app.get('/api/users', (req, res) => {
  res.json(db.users);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`校车临时改线台服务已启动: http://localhost:${PORT}`);
});
