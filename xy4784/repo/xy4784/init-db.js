const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// 检查数据库文件是否存在
const dbPath = './theater.db';
const dbExists = fs.existsSync(dbPath);

// 创建数据库连接
const db = new sqlite3.Database(dbPath);

// 启用外键约束
db.run('PRAGMA foreign_keys = ON');

// 数据库初始化
db.serialize(() => {
  // 演出表
  db.run(`
    CREATE TABLE IF NOT EXISTS shows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      venue TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 订单表
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      show_id INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'confirmed',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (show_id) REFERENCES shows(id)
    )
  `);

  // 座位表
  db.run(`
    CREATE TABLE IF NOT EXISTS seats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      show_id INTEGER NOT NULL,
      row TEXT NOT NULL,
      number INTEGER NOT NULL,
      price REAL NOT NULL,
      order_id INTEGER,
      status TEXT DEFAULT 'available',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (show_id) REFERENCES shows(id),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      UNIQUE(show_id, row, number)
    )
  `);

  // 批次任务表
  db.run(`
    CREATE TABLE IF NOT EXISTS refund_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      show_id INTEGER NOT NULL,
      mode TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      total_tickets INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (show_id) REFERENCES shows(id)
    )
  `);

  // 退款流水表
  db.run(`
    CREATE TABLE IF NOT EXISTS refund_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_no TEXT UNIQUE NOT NULL,
      batch_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      seat_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      third_party_ref TEXT,
      status TEXT DEFAULT 'pending',
      failure_reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES refund_batches(id),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (seat_id) REFERENCES seats(id)
    )
  `);

  // 每张票的处理结果表
  db.run(`
    CREATE TABLE IF NOT EXISTS ticket_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      seat_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      failure_reason TEXT,
      retry_count INTEGER DEFAULT 0,
      last_retry_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES refund_batches(id),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (seat_id) REFERENCES seats(id)
    )
  `);

  // 创建索引
  db.run('CREATE INDEX IF NOT EXISTS idx_orders_show_id ON orders(show_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_seats_show_id ON seats(show_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_seats_order_id ON seats(order_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_refund_batches_show_id ON refund_batches(show_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_refund_transactions_batch_id ON refund_transactions(batch_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_ticket_results_batch_id ON ticket_results(batch_id)');

  console.log('数据库表初始化完成');

  // 如果是新数据库，插入一些测试数据
  if (!dbExists) {
    console.log('插入测试数据...');
    
    // 插入演出
    db.run(`
      INSERT INTO shows (name, date, time, venue, status)
      VALUES 
        ('《茶馆》经典话剧', '2026-06-15', '19:30', '小剧场A厅', 'active'),
        ('《雷雨》经典话剧', '2026-06-20', '14:00', '小剧场B厅', 'active')
    `, function(err) {
      if (err) {
        console.error('插入演出失败:', err.message);
        return;
      }
      
      const show1Id = this.lastID;
      
      // 插入订单
      const orders = [
        { order_no: 'ORD20260501001', show_id: 1, customer_name: '张三', customer_phone: '13800138001', total_amount: 360 },
        { order_no: 'ORD20260501002', show_id: 1, customer_name: '李四', customer_phone: '13800138002', total_amount: 180 },
        { order_no: 'ORD20260501003', show_id: 1, customer_name: '王五', customer_phone: '13800138003', total_amount: 280 }
      ];
      
      let orderCount = 0;
      orders.forEach((order, index) => {
        db.run(`
          INSERT INTO orders (order_no, show_id, customer_name, customer_phone, total_amount, status)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [order.order_no, order.show_id, order.customer_name, order.customer_phone, order.total_amount, 'confirmed'], function(err) {
          if (err) {
            console.error('插入订单失败:', err.message);
            return;
          }
          
          const orderId = this.lastID;
          
          // 插入座位
          const seats = [];
          if (index === 0) {
            // 张三订了2个座位
            seats.push(
              { show_id: 1, row: 'A', number: 1, price: 180, order_id: orderId, status: 'sold' },
              { show_id: 1, row: 'A', number: 2, price: 180, order_id: orderId, status: 'sold' }
            );
          } else if (index === 1) {
            // 李四订了1个座位
            seats.push(
              { show_id: 1, row: 'B', number: 1, price: 180, order_id: orderId, status: 'sold' }
            );
          } else {
            // 王五订了2个座位
            seats.push(
              { show_id: 1, row: 'B', number: 2, price: 140, order_id: orderId, status: 'sold' },
              { show_id: 1, row: 'B', number: 3, price: 140, order_id: orderId, status: 'sold' }
            );
          }
          
          let seatCount = 0;
          seats.forEach(seat => {
            db.run(`
              INSERT INTO seats (show_id, row, number, price, order_id, status)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [seat.show_id, seat.row, seat.number, seat.price, seat.order_id, seat.status], function(err) {
              if (err) {
                console.error('插入座位失败:', err.message);
              }
              
              seatCount++;
              if (seatCount === seats.length) {
                orderCount++;
                if (orderCount === orders.length) {
                  console.log('测试数据插入完成');
                  console.log('演出ID 1: 《茶馆》经典话剧 (2026-06-15 19:30)');
                  console.log('演出ID 2: 《雷雨》经典话剧 (2026-06-20 14:00)');
                  console.log('订单:');
                  console.log('  - ORD20260501001: 张三, 360元, 座位 A1, A2');
                  console.log('  - ORD20260501002: 李四, 180元, 座位 B1');
                  console.log('  - ORD20260501003: 王五, 280元, 座位 B2, B3');
                  db.close();
                }
              }
            });
          });
        });
      });
    });
  } else {
    console.log('数据库已存在，跳过测试数据插入');
    db.close();
  }
});
