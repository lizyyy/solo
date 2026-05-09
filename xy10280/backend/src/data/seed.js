const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'shuttle.db');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('✓ 清除旧数据库');
}

const db = new sqlite3.Database(dbPath);

const routes = [
  { name: '科技园早班线', code: 'TK1', direction: 'morning' },
  { name: '科技园晚班线', code: 'TK2', direction: 'evening' },
  { name: 'CBD早班线', code: 'CD1', direction: 'morning' },
  { name: 'CBD晚班线', code: 'CD2', direction: 'evening' }
];

const stations = [
  { name: '中关村地铁站A口', code: 'ZGC-A', route_index: 0, sequence: 1, address: '海淀区中关村大街1号' },
  { name: '五道口地铁站B口', code: 'WDK-B', route_index: 0, sequence: 2, address: '海淀区成府路' },
  { name: '西二旗地铁站A口', code: 'XEQ-A', route_index: 0, sequence: 3, address: '海淀区上地十街' },
  { name: '回龙观地铁站B口', code: 'HLG-B', route_index: 1, sequence: 1, address: '昌平区回龙观东大街' },
  { name: '霍营地铁站A口', code: 'HY-A', route_index: 1, sequence: 2, address: '昌平区霍营西路' },
  { name: '国贸地铁站C口', code: 'GM-C', route_index: 2, sequence: 1, address: '朝阳区建国门外大街' },
  { name: '大望路地铁站A口', code: 'DWL-A', route_index: 2, sequence: 2, address: '朝阳区西大望路' },
  { name: '四惠地铁站B口', code: 'SH-B', route_index: 3, sequence: 1, address: '朝阳区建国路' },
  { name: '高碑店地铁站A口', code: 'GB-A', route_index: 3, sequence: 2, address: '朝阳区高碑店路' }
];

const employees = [
  { name: '张三', employee_id: 'EMP001', department: '研发部', phone: '13800138001', email: 'zhangsan@company.com' },
  { name: '李四', employee_id: 'EMP002', department: '研发部', phone: '13800138002', email: 'lisi@company.com' },
  { name: '王五', employee_id: 'EMP003', department: '市场部', phone: '13800138003', email: 'wangwu@company.com' },
  { name: '赵六', employee_id: 'EMP004', department: '市场部', phone: '13800138004', email: 'zhaoliu@company.com' },
  { name: '钱七', employee_id: 'EMP005', department: '人事部', phone: '13800138005', email: 'qianqi@company.com' },
  { name: '孙八', employee_id: 'EMP006', department: '财务部', phone: '13800138006', email: 'sunba@company.com' },
  { name: '周九', employee_id: 'EMP007', department: '研发部', phone: '13800138007', email: 'zhoujiu@company.com' },
  { name: '吴十', employee_id: 'EMP008', department: '研发部', phone: '13800138008', email: 'wushi@company.com' },
  { name: '郑一', employee_id: 'EMP009', department: '产品部', phone: '13800138009', email: 'zhengyi@company.com' },
  { name: '王二', employee_id: 'EMP010', department: '产品部', phone: '13800138010', email: 'wanger@company.com' },
  { name: '冯三', employee_id: 'EMP011', department: '研发部', phone: '13800138011', email: 'fengsan@company.com' },
  { name: '陈四', employee_id: 'EMP012', department: '研发部', phone: '13800138012', email: 'chensi@company.com' },
  { name: '褚五', employee_id: 'EMP013', department: '市场部', phone: '13800138013', email: 'chuwu@company.com' },
  { name: '卫六', employee_id: 'EMP014', department: '人事部', phone: '13800138014', email: 'weiliu@company.com' },
  { name: '蒋七', employee_id: 'EMP015', department: '财务部', phone: '13800138015', email: 'jiangqi@company.com' }
];

function runQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function allQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function seedData() {
  const routeIds = [];
  const stationIds = [];
  const employeeIds = [];

  await runQuery(db, `CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    direction TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await runQuery(db, `CREATE TABLE IF NOT EXISTS stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    route_id INTEGER,
    sequence INTEGER,
    address TEXT,
    longitude REAL,
    latitude REAL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES routes(id)
  )`);

  await runQuery(db, `CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    employee_id TEXT NOT NULL UNIQUE,
    department TEXT,
    phone TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await runQuery(db, `CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    station_id INTEGER,
    route_id INTEGER,
    period TEXT NOT NULL,
    week_days TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (route_id) REFERENCES routes(id)
  )`);

  await runQuery(db, `CREATE TABLE IF NOT EXISTS swipe_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    station_id INTEGER,
    route_id INTEGER,
    swipe_time DATETIME NOT NULL,
    direction TEXT,
    device_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (route_id) REFERENCES routes(id)
  )`);

  await runQuery(db, `CREATE TABLE IF NOT EXISTS adjustment_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER,
    route_id INTEGER,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    heat_score REAL,
    registration_count INTEGER,
    actual_count INTEGER,
    difference_rate REAL,
    affected_employees INTEGER,
    proposal TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    reviewed_by TEXT,
    review_comment TEXT,
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (route_id) REFERENCES routes(id)
  )`);

  await runQuery(db, `CREATE TABLE IF NOT EXISTS heat_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER,
    route_id INTEGER,
    period TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    registration_count INTEGER,
    actual_count INTEGER,
    difference_rate REAL,
    heat_level TEXT,
    suggestions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (route_id) REFERENCES routes(id)
  )`);

  await runQuery(db, `CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'adjustment',
    affected_routes TEXT,
    affected_stations TEXT,
    effective_date DATE,
    status TEXT DEFAULT 'draft',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    published_at DATETIME
  )`);

  console.log('✓ 创建数据库表');

  for (const route of routes) {
    const result = await runQuery(db, 
      'INSERT INTO routes (name, code, direction) VALUES (?, ?, ?)',
      [route.name, route.code, route.direction]
    );
    routeIds.push(result.lastID);
  }
  console.log('✓ 插入线路数据:', routes.length, '条');

  for (const station of stations) {
    const result = await runQuery(db,
      'INSERT INTO stations (name, code, route_id, sequence, address) VALUES (?, ?, ?, ?, ?)',
      [station.name, station.code, routeIds[station.route_index], station.sequence, station.address]
    );
    stationIds.push(result.lastID);
  }
  console.log('✓ 插入站点数据:', stations.length, '条');

  for (const emp of employees) {
    const result = await runQuery(db,
      'INSERT INTO employees (name, employee_id, department, phone, email) VALUES (?, ?, ?, ?, ?)',
      [emp.name, emp.employee_id, emp.department, emp.phone, emp.email]
    );
    employeeIds.push(result.lastID);
  }
  console.log('✓ 插入员工数据:', employees.length, '条');

  const registrations = [
    [employeeIds[0], stationIds[0], routeIds[0], '2024-Q2', '1,2,3,4,5'],
    [employeeIds[1], stationIds[0], routeIds[0], '2024-Q2', '1,2,3,4,5'],
    [employeeIds[2], stationIds[0], routeIds[0], '2024-Q2', '1,3,5'],
    [employeeIds[3], stationIds[0], routeIds[0], '2024-Q2', '2,4'],
    
    [employeeIds[4], stationIds[4], routeIds[1], '2024-Q2', '1,2,3,4,5'],
    [employeeIds[5], stationIds[4], routeIds[1], '2024-Q2', '1,2,3,4,5'],
    [employeeIds[6], stationIds[4], routeIds[1], '2024-Q2', '1,2,3,4,5'],
    [employeeIds[7], stationIds[4], routeIds[1], '2024-Q2', '1,3,5'],
    [employeeIds[8], stationIds[4], routeIds[1], '2024-Q2', '2,4'],
    [employeeIds[9], stationIds[4], routeIds[1], '2024-Q2', '1,2,3,4,5'],
    [employeeIds[10], stationIds[4], routeIds[1], '2024-Q2', '1,2,3,4,5'],
    [employeeIds[11], stationIds[4], routeIds[1], '2024-Q2', '1,2,3,4,5'],
    [employeeIds[12], stationIds[4], routeIds[1], '2024-Q2', '1,3,5'],
    [employeeIds[13], stationIds[4], routeIds[1], '2024-Q2', '2,4'],
    [employeeIds[14], stationIds[4], routeIds[1], '2024-Q2', '1,2,3,4,5'],
    
    [employeeIds[0], stationIds[5], routeIds[2], '2024-Q2', '1,2,3,4,5'],
    [employeeIds[1], stationIds[5], routeIds[2], '2024-Q2', '1,2,3,4,5'],
    [employeeIds[2], stationIds[5], routeIds[2], '2024-Q2', '1,2,3,4,5'],
    
    [employeeIds[3], stationIds[7], routeIds[3], '2024-Q2', '1,2,3,4,5'],
  ];

  for (const reg of registrations) {
    await runQuery(db,
      'INSERT INTO registrations (employee_id, station_id, route_id, period, week_days) VALUES (?, ?, ?, ?, ?)',
      reg
    );
  }
  console.log('✓ 插入报名数据:', registrations.length, '条');

  let swipeCount = 0;
  for (let day = 1; day <= 30; day++) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    const dateStr = date.toISOString().split('T')[0];
    
    if (date.getDay() >= 1 && date.getDay() <= 5) {
      const swipes = [
        [employeeIds[0], stationIds[0], routeIds[0], `${dateStr} 08:30:00`, 'morning', 'DEV001'],
        [employeeIds[1], stationIds[0], routeIds[0], `${dateStr} 08:32:00`, 'morning', 'DEV001'],
        
        [employeeIds[4], stationIds[4], routeIds[1], `${dateStr} 09:00:00`, 'evening', 'DEV002'],
        [employeeIds[5], stationIds[4], routeIds[1], `${dateStr} 09:02:00`, 'evening', 'DEV002'],
        [employeeIds[6], stationIds[4], routeIds[1], `${dateStr} 09:04:00`, 'evening', 'DEV002'],
        
        [employeeIds[0], stationIds[5], routeIds[2], `${dateStr} 08:45:00`, 'morning', 'DEV003'],
        [employeeIds[1], stationIds[5], routeIds[2], `${dateStr} 08:47:00`, 'morning', 'DEV003'],
        [employeeIds[2], stationIds[5], routeIds[2], `${dateStr} 08:49:00`, 'morning', 'DEV003'],
      ];
      
      if (day % 2 === 0) {
        swipes.push([employeeIds[3], stationIds[7], routeIds[3], `${dateStr} 09:30:00`, 'evening', 'DEV004']);
      }
      
      for (const swipe of swipes) {
        await runQuery(db,
          'INSERT INTO swipe_records (employee_id, station_id, route_id, swipe_time, direction, device_id) VALUES (?, ?, ?, ?, ?, ?)',
          swipe
        );
        swipeCount++;
      }
    }
  }
  console.log('✓ 插入刷卡记录数据:', swipeCount, '条');

  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  await runQuery(db, `INSERT INTO adjustment_tasks 
    (station_id, route_id, type, title, description, status, 
     heat_score, registration_count, actual_count, difference_rate, proposal,
     created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [stationIds[3], routeIds[1], 'withdrawal',
     '回龙观地铁站撤点申请',
     '该站点报名人数较少，实际乘车率低，建议撤点。',
     'pending',
     35.5, 3, 2, 0.33,
     '差异率33.3%，存在一定报名实乘差异。建议与部门行政对接，核实员工实际通勤情况后再决定。',
     twoDaysAgo.toISOString()]
  );

  await runQuery(db, `INSERT INTO adjustment_tasks 
    (station_id, route_id, type, title, description, status, 
     heat_score, registration_count, actual_count, difference_rate, proposal,
     created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [stationIds[8], routeIds[3], 'withdrawal',
     '高碑店地铁站撤点申请（需复核）',
     '该站点报名人数为0，建议撤点。',
     'pending_review',
     100, 0, 0, 0,
     '该站点无活跃报名员工，建议直接撤点，无需过渡。',
     now.toISOString()]
  );

  console.log('✓ 插入调整任务数据');

  for (let i = 0; i < 3; i++) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - i * 7);
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    await runQuery(db, `INSERT INTO heat_analyses 
      (station_id, route_id, period, start_date, end_date, 
       registration_count, actual_count, difference_rate, heat_level, suggestions) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [stationIds[0], routeIds[0], 'month',
       startDate.toISOString().split('T')[0],
       endDate.toISOString().split('T')[0],
       4, 4, 0, 'high',
       '运营状况良好，报名与实乘一致。']
    );
    
    await runQuery(db, `INSERT INTO heat_analyses 
      (station_id, route_id, period, start_date, end_date, 
       registration_count, actual_count, difference_rate, heat_level, suggestions) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [stationIds[4], routeIds[1], 'month',
       startDate.toISOString().split('T')[0],
       endDate.toISOString().split('T')[0],
       12, 3, 0.75, 'low',
       '差异率过高，建议启动撤点流程。']
    );
  }

  console.log('✓ 插入热度分析历史数据');

  db.close();
  console.log('\n数据初始化完成！');
  
  console.log('\n=== 数据样例说明 ===');
  console.log('\n【顺利场景 - 中关村地铁站A口】');
  console.log('  - 报名人数: 4人');
  console.log('  - 实际乘车: 4人');
  console.log('  - 差异率: 0%');
  console.log('  - 热度: 高');
  console.log('  - 状态: 运营良好，无需调整');
  
  console.log('\n【拦截场景 - 霍营地铁站A口】');
  console.log('  - 报名人数: 12人');
  console.log('  - 实际乘车: 3人');
  console.log('  - 差异率: 75%');
  console.log('  - 热度: 低');
  console.log('  - 触发规则: 报名≥10人需要部门复核');
  console.log('  - 状态: 待复核 (pending_review)');
  
  console.log('\n【待复核场景 - 高碑店地铁站A口】');
  console.log('  - 报名人数: 0人');
  console.log('  - 实际乘车: 0人');
  console.log('  - 触发规则: 无报名记录');
  console.log('  - 状态: 待复核 (pending_review)');
}

seedData().catch(err => {
  console.error('数据初始化失败:', err);
  process.exit(1);
});
