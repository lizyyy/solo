const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./maternal.db', (err) => {
  if (err) console.error(err.message);
  console.log('Connected to database.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    room_number TEXT UNIQUE NOT NULL,
    room_type TEXT NOT NULL,
    status TEXT DEFAULT 'empty',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    duration_days INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS package_items (
    id TEXT PRIMARY KEY,
    package_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit TEXT NOT NULL,
    unit_price REAL NOT NULL,
    FOREIGN KEY (package_id) REFERENCES packages(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS babies (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    name TEXT NOT NULL,
    gender TEXT,
    birth_date DATE,
    checkin_date DATE NOT NULL,
    checkout_date DATE,
    package_id TEXT NOT NULL,
    status TEXT DEFAULT 'in_house',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (package_id) REFERENCES packages(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    unit_price REAL NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    warning_threshold INTEGER NOT NULL DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS consumptions (
    id TEXT PRIMARY KEY,
    baby_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    inventory_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit TEXT NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    type TEXT NOT NULL,
    is_supplement INTEGER DEFAULT 0,
    approval_status TEXT DEFAULT 'pending',
    approved_by TEXT,
    approved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    request_id TEXT UNIQUE,
    FOREIGN KEY (baby_id) REFERENCES babies(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (inventory_id) REFERENCES inventory(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    baby_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    package_price REAL NOT NULL,
    extra_consumption_total REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'unpaid',
    checkout_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bill_items (
    id TEXT PRIMARY KEY,
    bill_id TEXT NOT NULL,
    consumption_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit TEXT NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    type TEXT NOT NULL,
    FOREIGN KEY (bill_id) REFERENCES bills(id)
  )`);
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const initData = async () => {
  try {
    const row = await dbGet("SELECT COUNT(*) as count FROM rooms");
    if (row.count === 0) {
      const roomIds = [uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4()];
      const rooms = [
        { id: roomIds[0], room_number: '101', room_type: 'VIP套房', status: 'occupied' },
        { id: roomIds[1], room_number: '102', room_type: '标准间', status: 'occupied' },
        { id: roomIds[2], room_number: '103', room_type: '标准间', status: 'empty' },
        { id: roomIds[3], room_number: '201', room_type: '豪华套房', status: 'occupied' },
        { id: roomIds[4], room_number: '202', room_type: 'VIP套房', status: 'empty' }
      ];
      for (const r of rooms) {
        await dbRun("INSERT INTO rooms VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)", [r.id, r.room_number, r.room_type, r.status]);
      }

      const pkgIds = [uuidv4(), uuidv4(), uuidv4()];
      const packages = [
        { id: pkgIds[0], name: '基础护理套餐', description: '28天基础母婴护理', price: 29800, duration_days: 28 },
        { id: pkgIds[1], name: 'VIP尊享套餐', description: '42天高端护理服务', price: 59800, duration_days: 42 },
        { id: pkgIds[2], name: '豪华月子套餐', description: '56天全方位照护', price: 99800, duration_days: 56 }
      ];
      for (const p of packages) {
        await dbRun("INSERT INTO packages VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)", [p.id, p.name, p.description, p.price, p.duration_days]);
      }

      const invIds = Array(9).fill().map(() => uuidv4());
      const inventory = [
        { id: invIds[0], name: '婴幼儿配方奶粉', category: '食品', unit: '罐', unit_price: 398, stock_quantity: 45, warning_threshold: 10 },
        { id: invIds[1], name: '尿不湿NB码', category: '日用品', unit: '包', unit_price: 128, stock_quantity: 80, warning_threshold: 20 },
        { id: invIds[2], name: '尿不湿S码', category: '日用品', unit: '包', unit_price: 138, stock_quantity: 60, warning_threshold: 20 },
        { id: invIds[3], name: '婴儿湿纸巾', category: '日用品', unit: '包', unit_price: 28, stock_quantity: 150, warning_threshold: 30 },
        { id: invIds[4], name: '一次性隔尿垫', category: '日用品', unit: '包', unit_price: 45, stock_quantity: 100, warning_threshold: 25 },
        { id: invIds[5], name: '产妇卫生巾', category: '产妇用品', unit: '包', unit_price: 35, stock_quantity: 70, warning_threshold: 15 },
        { id: invIds[6], name: '防溢乳垫', category: '产妇用品', unit: '盒', unit_price: 58, stock_quantity: 40, warning_threshold: 10 },
        { id: invIds[7], name: '婴儿护臀膏', category: '护理品', unit: '支', unit_price: 68, stock_quantity: 25, warning_threshold: 8 },
        { id: invIds[8], name: '婴儿润肤露', category: '护理品', unit: '瓶', unit_price: 88, stock_quantity: 20, warning_threshold: 5 }
      ];
      for (const i of inventory) {
        await dbRun("INSERT INTO inventory VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)", [i.id, i.name, i.category, i.unit, i.unit_price, i.stock_quantity, i.warning_threshold]);
      }

      const babyIds = [uuidv4(), uuidv4(), uuidv4()];
      const babies = [
        { id: babyIds[0], room_id: roomIds[0], name: '张小明', gender: '男', birth_date: '2026-04-15', checkin_date: '2026-04-16', package_id: pkgIds[0], status: 'in_house' },
        { id: babyIds[1], room_id: roomIds[1], name: '李小花', gender: '女', birth_date: '2026-04-20', checkin_date: '2026-04-21', package_id: pkgIds[1], status: 'in_house' },
        { id: babyIds[2], room_id: roomIds[3], name: '王小宝', gender: '男', birth_date: '2026-04-10', checkin_date: '2026-04-11', package_id: pkgIds[2], status: 'in_house' }
      ];
      for (const b of babies) {
        await dbRun("INSERT INTO babies (id, room_id, name, gender, birth_date, checkin_date, package_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [b.id, b.room_id, b.name, b.gender, b.birth_date, b.checkin_date, b.package_id, b.status]);
      }

      const consumptions = [
        { id: uuidv4(), baby_id: babyIds[0], room_id: roomIds[0], inventory_id: invIds[0], item_name: '婴幼儿配方奶粉', quantity: 2, unit: '罐', unit_price: 398, total_price: 796, type: 'package', is_supplement: 0, approval_status: 'approved', created_by: null, request_id: 'REQ-001' },
        { id: uuidv4(), baby_id: babyIds[0], room_id: roomIds[0], inventory_id: invIds[1], item_name: '尿不湿NB码', quantity: 3, unit: '包', unit_price: 128, total_price: 384, type: 'package', is_supplement: 0, approval_status: 'approved', created_by: null, request_id: 'REQ-002' },
        { id: uuidv4(), baby_id: babyIds[0], room_id: roomIds[0], inventory_id: invIds[0], item_name: '婴幼儿配方奶粉', quantity: 1, unit: '罐', unit_price: 398, total_price: 398, type: 'extra', is_supplement: 1, approval_status: 'pending', created_by: null, request_id: 'REQ-003' },
        { id: uuidv4(), baby_id: babyIds[1], room_id: roomIds[1], inventory_id: invIds[3], item_name: '婴儿湿纸巾', quantity: 5, unit: '包', unit_price: 28, total_price: 140, type: 'package', is_supplement: 0, approval_status: 'approved', created_by: null, request_id: 'REQ-004' },
        { id: uuidv4(), baby_id: babyIds[1], room_id: roomIds[1], inventory_id: invIds[7], item_name: '婴儿护臀膏', quantity: 1, unit: '支', unit_price: 68, total_price: 68, type: 'extra', is_supplement: 0, approval_status: 'approved', created_by: null, request_id: 'REQ-005' },
        { id: uuidv4(), baby_id: babyIds[2], room_id: roomIds[3], inventory_id: invIds[0], item_name: '婴幼儿配方奶粉', quantity: 1, unit: '罐', unit_price: 398, total_price: 398, type: 'extra', is_supplement: 1, approval_status: 'rejected', created_by: null, request_id: 'REQ-006' }
      ];
      for (const c of consumptions) {
        await dbRun("INSERT INTO consumptions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)", [c.id, c.baby_id, c.room_id, c.inventory_id, c.item_name, c.quantity, c.unit, c.unit_price, c.total_price, c.type, c.is_supplement, c.approval_status, null, null, c.created_by, c.request_id]);
      }
    }
  } catch (err) {
    console.error('Init data error:', err);
  }
};

initData();

app.get('/api/rooms', (req, res) => {
  db.all("SELECT r.*, b.name as baby_name, b.status as baby_status FROM rooms r LEFT JOIN babies b ON r.id = b.room_id WHERE b.status = 'in_house' OR b.status IS NULL", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/rooms/:id', (req, res) => {
  db.get("SELECT * FROM rooms WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

app.get('/api/babies', (req, res) => {
  db.all(`SELECT b.*, r.room_number, p.name as package_name 
          FROM babies b 
          JOIN rooms r ON b.room_id = r.id 
          JOIN packages p ON b.package_id = p.id`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/inventory', (req, res) => {
  db.all("SELECT * FROM inventory ORDER BY category, name", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/inventory/warnings', (req, res) => {
  db.all("SELECT * FROM inventory WHERE stock_quantity <= warning_threshold ORDER BY stock_quantity", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/consumptions', (req, res) => {
  const { baby_id, room_id, status } = req.query;
  let query = `SELECT c.*, b.name as baby_name, r.room_number 
               FROM consumptions c 
               JOIN babies b ON c.baby_id = b.id 
               JOIN rooms r ON c.room_id = r.id`;
  let params = [];
  let conditions = [];
  
  if (baby_id) { conditions.push("c.baby_id = ?"); params.push(baby_id); }
  if (room_id) { conditions.push("c.room_id = ?"); params.push(room_id); }
  if (status) { conditions.push("c.approval_status = ?"); params.push(status); }
  
  if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
  query += " ORDER BY c.created_at DESC";
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/packages', (req, res) => {
  db.all("SELECT * FROM packages", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/consumptions', (req, res) => {
  const { baby_id, inventory_id, quantity, type, is_supplement, request_id, created_by } = req.body;
  
  db.get("SELECT * FROM consumptions WHERE request_id = ?", [request_id], (err, existing) => {
    if (existing) return res.status(400).json({ error: '该领用请求已存在，请勿重复提交' });
    
    db.get("SELECT * FROM babies WHERE id = ?", [baby_id], (err, baby) => {
      if (!baby) return res.status(404).json({ error: '宝宝不存在' });
      if (baby.status === 'checked_out') return res.status(400).json({ error: '该宝宝已退房，无法新增耗材' });
      
      db.get("SELECT * FROM inventory WHERE id = ?", [inventory_id], (err, item) => {
        if (!item) return res.status(404).json({ error: '耗材不存在' });
        
        const approval_status = is_supplement ? 'pending' : 'approved';
        
        if (approval_status === 'approved' && item.stock_quantity < quantity) {
          return res.status(400).json({ error: `库存不足，当前库存：${item.stock_quantity}${item.unit}，申请数量：${quantity}${item.unit}` });
        }
        
        const total_price = item.unit_price * quantity;
        const id = uuidv4();
        
        db.run(`INSERT INTO consumptions 
                (id, baby_id, room_id, inventory_id, item_name, quantity, unit, unit_price, total_price, type, is_supplement, approval_status, created_by, request_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, baby_id, baby.room_id, inventory_id, item.name, quantity, item.unit, item.unit_price, total_price, type, is_supplement ? 1 : 0, approval_status, created_by, request_id],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            if (approval_status === 'approved') {
              db.run("UPDATE inventory SET stock_quantity = stock_quantity - ? WHERE id = ?", [quantity, inventory_id]);
            }
            
            res.json({ id, message: '领用记录创建成功', current_stock: approval_status === 'approved' ? item.stock_quantity - quantity : item.stock_quantity });
          });
      });
    });
  });
});

app.post('/api/rooms', (req, res) => {
  const { room_number, room_type, status } = req.body;
  const id = uuidv4();
  db.run("INSERT INTO rooms (id, room_number, room_type, status) VALUES (?, ?, ?, ?)", 
    [id, room_number, room_type, status || 'empty'], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, message: '房间创建成功' });
    });
});

app.put('/api/rooms/:id', (req, res) => {
  const { room_number, room_type, status } = req.body;
  db.run("UPDATE rooms SET room_number = ?, room_type = ?, status = ? WHERE id = ?", 
    [room_number, room_type, status, req.params.id], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '房间更新成功' });
    });
});

app.delete('/api/rooms/:id', (req, res) => {
  db.get("SELECT * FROM babies WHERE room_id = ? AND status = 'in_house'", [req.params.id], (err, baby) => {
    if (baby) return res.status(400).json({ error: '该房间有宝宝入住，无法删除' });
    db.run("DELETE FROM rooms WHERE id = ?", [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '房间删除成功' });
    });
  });
});

app.post('/api/babies', (req, res) => {
  const { room_id, name, gender, birth_date, checkin_date, package_id } = req.body;
  const id = uuidv4();
  
  db.get("SELECT * FROM rooms WHERE id = ?", [room_id], (err, room) => {
    if (!room) return res.status(404).json({ error: '房间不存在' });
    if (room.status === 'occupied') return res.status(400).json({ error: '该房间已被占用' });
    
    db.run("INSERT INTO babies (id, room_id, name, gender, birth_date, checkin_date, package_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'in_house')", 
      [id, room_id, name, gender, birth_date, checkin_date, package_id], 
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        db.run("UPDATE rooms SET status = 'occupied' WHERE id = ?", [room_id]);
        res.json({ id, message: '宝宝入住成功' });
      });
  });
});

app.put('/api/babies/:id', (req, res) => {
  const { name, gender, birth_date, package_id } = req.body;
  db.run("UPDATE babies SET name = ?, gender = ?, birth_date = ?, package_id = ? WHERE id = ?", 
    [name, gender, birth_date, package_id, req.params.id], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '宝宝信息更新成功' });
    });
});

app.post('/api/packages', (req, res) => {
  const { name, description, price, duration_days } = req.body;
  const id = uuidv4();
  db.run("INSERT INTO packages (id, name, description, price, duration_days) VALUES (?, ?, ?, ?, ?)", 
    [id, name, description, price, duration_days], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, message: '套餐创建成功' });
    });
});

app.put('/api/packages/:id', (req, res) => {
  const { name, description, price, duration_days } = req.body;
  db.run("UPDATE packages SET name = ?, description = ?, price = ?, duration_days = ? WHERE id = ?", 
    [name, description, price, duration_days, req.params.id], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '套餐更新成功' });
    });
});

app.delete('/api/packages/:id', (req, res) => {
  db.get("SELECT * FROM babies WHERE package_id = ? AND status = 'in_house'", [req.params.id], (err, baby) => {
    if (baby) return res.status(400).json({ error: '该套餐有正在使用的宝宝，无法删除' });
    db.run("DELETE FROM packages WHERE id = ?", [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '套餐删除成功' });
    });
  });
});

app.post('/api/inventory', (req, res) => {
  const { name, category, unit, unit_price, stock_quantity, warning_threshold } = req.body;
  const id = uuidv4();
  db.run("INSERT INTO inventory (id, name, category, unit, unit_price, stock_quantity, warning_threshold) VALUES (?, ?, ?, ?, ?, ?, ?)", 
    [id, name, category, unit, unit_price, stock_quantity || 0, warning_threshold || 10], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, message: '耗材创建成功' });
    });
});

app.put('/api/inventory/:id', (req, res) => {
  const { name, category, unit, unit_price, stock_quantity, warning_threshold } = req.body;
  db.run("UPDATE inventory SET name = ?, category = ?, unit = ?, unit_price = ?, stock_quantity = ?, warning_threshold = ? WHERE id = ?", 
    [name, category, unit, unit_price, stock_quantity, warning_threshold, req.params.id], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '耗材更新成功' });
    });
});

app.delete('/api/inventory/:id', (req, res) => {
  db.get("SELECT * FROM consumptions WHERE inventory_id = ? AND approval_status != 'rejected'", [req.params.id], (err, consumption) => {
    if (consumption) return res.status(400).json({ error: '该耗材有领用记录，无法删除' });
    db.run("DELETE FROM inventory WHERE id = ?", [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '耗材删除成功' });
    });
  });
});

app.put('/api/consumptions/:id/approve', (req, res) => {
  const { approved_by } = req.body;
  db.get("SELECT * FROM consumptions WHERE id = ?", [req.params.id], (err, consumption) => {
    if (!consumption) return res.status(404).json({ error: '记录不存在' });
    if (consumption.approval_status !== 'pending') return res.status(400).json({ error: '该记录状态不可审批' });
    
    db.get("SELECT stock_quantity FROM inventory WHERE id = ?", [consumption.inventory_id], (err, inv) => {
      if (inv.stock_quantity < consumption.quantity) {
        return res.status(400).json({ error: '库存不足，无法审批通过' });
      }
      
      db.run(`UPDATE consumptions SET approval_status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [approved_by, req.params.id], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          db.run("UPDATE inventory SET stock_quantity = stock_quantity - ? WHERE id = ?", [consumption.quantity, consumption.inventory_id]);
          res.json({ message: '审批通过' });
        });
    });
  });
});

app.put('/api/consumptions/:id/reject', (req, res) => {
  const { approved_by } = req.body;
  db.run(`UPDATE consumptions SET approval_status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [approved_by, req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: '已拒绝' });
    });
});

app.post('/api/babies/:id/checkout', (req, res) => {
  db.get("SELECT * FROM babies WHERE id = ?", [req.params.id], (err, baby) => {
    if (!baby) return res.status(404).json({ error: '宝宝不存在' });
    if (baby.status === 'checked_out') return res.status(400).json({ error: '已退房' });
    
    db.get("SELECT * FROM consumptions WHERE baby_id = ? AND approval_status = 'pending'", [req.params.id], (err, pending) => {
      if (pending) return res.status(400).json({ error: '存在待审批的补领记录，请先处理' });
      
      db.get("SELECT price FROM packages WHERE id = ?", [baby.package_id], (err, pkg) => {
        db.all(`SELECT * FROM consumptions WHERE baby_id = ? AND approval_status = 'approved'`, [req.params.id], (err, consumptions) => {
          const extraTotal = consumptions.filter(c => c.type === 'extra').reduce((sum, c) => sum + c.total_price, 0);
          const totalAmount = pkg.price + extraTotal;
          const billId = uuidv4();
          
          db.run(`INSERT INTO bills (id, baby_id, room_id, package_price, extra_consumption_total, total_amount, checkout_date) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [billId, baby.id, baby.room_id, pkg.price, extraTotal, totalAmount], (err) => {
              consumptions.forEach(c => {
                db.run(`INSERT INTO bill_items (id, bill_id, consumption_id, item_name, quantity, unit, unit_price, total_price, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [uuidv4(), billId, c.id, c.item_name, c.quantity, c.unit, c.unit_price, c.total_price, c.type]);
              });
              
              db.run("UPDATE babies SET status = 'checked_out', checkout_date = CURRENT_TIMESTAMP WHERE id = ?", [baby.id]);
              db.run("UPDATE rooms SET status = 'empty' WHERE id = ?", [baby.room_id]);
              
              res.json({ bill_id: billId, total_amount: totalAmount, message: '退房成功' });
            });
        });
      });
    });
  });
});

app.get('/api/bills', (req, res) => {
  db.all(`SELECT b.*, ba.name as baby_name, r.room_number 
          FROM bills b 
          JOIN babies ba ON b.baby_id = ba.id 
          JOIN rooms r ON b.room_id = r.id 
          ORDER BY b.created_at DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/bills/:id', (req, res) => {
  db.get(`SELECT b.*, ba.name as baby_name, r.room_number 
          FROM bills b 
          JOIN babies ba ON b.baby_id = ba.id 
          JOIN rooms r ON b.room_id = r.id 
          WHERE b.id = ?`, [req.params.id], (err, bill) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all("SELECT * FROM bill_items WHERE bill_id = ?", [req.params.id], (err, items) => {
      res.json({ ...bill, items });
    });
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
