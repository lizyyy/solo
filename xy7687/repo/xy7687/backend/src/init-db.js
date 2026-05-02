const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'repair.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const STATUS_MAP = {
  pending_inspection: { label: '待检测', color: '#e6a23c' },
  quoting: { label: '报价中', color: '#409eff' },
  repairing: { label: '维修中', color: '#f56c6c' },
  pending_pickup: { label: '待取机', color: '#909399' },
  completed: { label: '已完成', color: '#67c23a' },
  cancelled: { label: '已取消', color: '#909399' }
};

const sampleTickets = [
  {
    ticket_no: 'WK20260501001',
    customer_name: '张三',
    customer_phone: '13800138001',
    device_model: 'iPhone 14 Pro',
    fault_description: '屏幕碎裂，无法正常触摸',
    quote_amount: 1500,
    repair_parts: '原装屏幕总成',
    estimated_pickup_time: '2026-05-03 18:00',
    notes: '客户要求使用原装配件',
    status: 'pending_inspection'
  },
  {
    ticket_no: 'WK20260501002',
    customer_name: '李四',
    customer_phone: '13900139002',
    device_model: '华为 Mate 60 Pro',
    fault_description: '电池耗电快，需要更换',
    quote_amount: 399,
    repair_parts: '原装电池',
    estimated_pickup_time: '2026-05-02 16:00',
    notes: '',
    status: 'repairing'
  },
  {
    ticket_no: 'WK20260501003',
    customer_name: '王五',
    customer_phone: '13700137003',
    device_model: '小米 14',
    fault_description: '进水不开机',
    quote_amount: 0,
    repair_parts: '',
    estimated_pickup_time: '',
    notes: '需要检测后才能报价',
    status: 'quoting'
  },
  {
    ticket_no: 'WK20260501004',
    customer_name: '赵六',
    customer_phone: '13600136004',
    device_model: 'OPPO Find X7',
    fault_description: '摄像头无法对焦',
    quote_amount: 580,
    repair_parts: '后置摄像头模组',
    estimated_pickup_time: '2026-05-02 12:00',
    notes: '',
    status: 'pending_pickup'
  },
  {
    ticket_no: 'WK20260501005',
    customer_name: '孙七',
    customer_phone: '13500135005',
    device_model: 'vivo X100 Pro',
    fault_description: '信号弱，经常无服务',
    quote_amount: 450,
    repair_parts: '基带维修',
    estimated_pickup_time: '',
    notes: '维修完成，客户已取机',
    status: 'completed'
  },
  {
    ticket_no: 'WK20260501006',
    customer_name: '周八',
    customer_phone: '13400134006',
    device_model: '三星 S24',
    fault_description: '充电接口损坏',
    quote_amount: 280,
    repair_parts: '',
    estimated_pickup_time: '',
    notes: '客户嫌贵取消维修',
    status: 'cancelled'
  }
];

const statusLogs = [
  { ticket_id: 2, from_status: null, to_status: 'pending_inspection', reason: '创建工单' },
  { ticket_id: 2, from_status: 'pending_inspection', to_status: 'quoting', reason: '检测完成，开始报价' },
  { ticket_id: 2, from_status: 'quoting', to_status: 'repairing', reason: '客户同意报价，开始维修' },
  { ticket_id: 4, from_status: null, to_status: 'pending_inspection', reason: '创建工单' },
  { ticket_id: 4, from_status: 'pending_inspection', to_status: 'quoting', reason: '检测完成，开始报价' },
  { ticket_id: 4, from_status: 'quoting', to_status: 'repairing', reason: '客户同意报价，开始维修' },
  { ticket_id: 4, from_status: 'repairing', to_status: 'pending_pickup', reason: '维修完成，待客户取机' },
  { ticket_id: 5, from_status: null, to_status: 'pending_inspection', reason: '创建工单' },
  { ticket_id: 5, from_status: 'pending_inspection', to_status: 'quoting', reason: '检测完成，开始报价' },
  { ticket_id: 5, from_status: 'quoting', to_status: 'repairing', reason: '客户同意报价，开始维修' },
  { ticket_id: 5, from_status: 'repairing', to_status: 'pending_pickup', reason: '维修完成，待客户取机' },
  { ticket_id: 5, from_status: 'pending_pickup', to_status: 'completed', reason: '客户已取机，工单完成' },
  { ticket_id: 6, from_status: null, to_status: 'pending_inspection', reason: '创建工单' },
  { ticket_id: 6, from_status: 'pending_inspection', to_status: 'quoting', reason: '检测完成，开始报价' },
  { ticket_id: 6, from_status: 'quoting', to_status: 'cancelled', reason: '客户取消维修' }
];

console.log('数据库路径:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('已连接到 SQLite 数据库');
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_no TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      device_model TEXT NOT NULL,
      fault_description TEXT,
      quote_amount REAL DEFAULT 0,
      repair_parts TEXT,
      estimated_pickup_time TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending_inspection',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `, (err) => {
    if (err) console.error('创建 tickets 表失败:', err.message);
    else console.log('tickets 表已就绪');
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS status_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      reason TEXT,
      operator TEXT DEFAULT '系统',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    )
  `, (err) => {
    if (err) console.error('创建 status_logs 表失败:', err.message);
    else console.log('status_logs 表已就绪');
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_phone ON tickets(customer_phone)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_no ON tickets(ticket_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_status_logs_ticket ON status_logs(ticket_id)`);

  db.get(`SELECT COUNT(*) as count FROM tickets`, (err, row) => {
    if (err) {
      console.error('查询数据失败:', err.message);
      db.close();
      process.exit(1);
      return;
    }

    console.log('当前 tickets 表数据量:', row.count);

    if (row.count === 0) {
      console.log('开始插入示例数据...');
      
      const insertTicket = db.prepare(`
        INSERT INTO tickets (
          ticket_no, customer_name, customer_phone, device_model,
          fault_description, quote_amount, repair_parts,
          estimated_pickup_time, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      sampleTickets.forEach((ticket, index) => {
        insertTicket.run(
          ticket.ticket_no,
          ticket.customer_name,
          ticket.customer_phone,
          ticket.device_model,
          ticket.fault_description,
          ticket.quote_amount,
          ticket.repair_parts,
          ticket.estimated_pickup_time,
          ticket.notes,
          ticket.status,
          function(insertErr) {
            if (insertErr) {
              console.error(`插入工单 ${index + 1} 失败:`, insertErr.message);
            } else {
              console.log(`已插入工单: ${ticket.ticket_no} (${ticket.customer_name})`);
            }
          }
        );
      });

      insertTicket.finalize((finalErr) => {
        if (finalErr) {
          console.error('完成工单插入失败:', finalErr.message);
        } else {
          console.log('工单数据插入完成');
        }

        console.log('开始插入状态日志...');
        
        const insertLog = db.prepare(`
          INSERT INTO status_logs (ticket_id, from_status, to_status, reason)
          VALUES (?, ?, ?, ?)
        `);

        statusLogs.forEach((log, index) => {
          insertLog.run(
            log.ticket_id,
            log.from_status,
            log.to_status,
            log.reason,
            (logErr) => {
              if (logErr) {
                console.error(`插入日志 ${index + 1} 失败:`, logErr.message);
              }
            }
          );
        });

        insertLog.finalize((logFinalErr) => {
          if (logFinalErr) {
            console.error('完成日志插入失败:', logFinalErr.message);
          } else {
            console.log('状态日志插入完成');
          }

          db.get(`SELECT COUNT(*) as count FROM tickets`, (verifyErr, verifyRow) => {
            if (verifyErr) {
              console.error('验证数据失败:', verifyErr.message);
            } else {
              console.log('验证: tickets 表数据量:', verifyRow.count);
            }

            db.close((closeErr) => {
              if (closeErr) {
                console.error('关闭数据库失败:', closeErr.message);
                process.exit(1);
              }
              console.log('数据库初始化完成！');
              process.exit(0);
            });
          });
        });
      });
    } else {
      console.log('数据库已有数据，跳过初始化');
      db.close((closeErr) => {
        if (closeErr) {
          console.error('关闭数据库失败:', closeErr.message);
          process.exit(1);
        }
        process.exit(0);
      });
    }
  });
});
