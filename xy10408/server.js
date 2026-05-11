const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'client', 'dist')));

const db = new sqlite3.Database('./groupbuy.db', (err) => {
  if (err) console.error('Database connection error:', err.message);
  else console.log('Connected to SQLite database');
});

const upload = multer({ dest: 'uploads/' });

const initDatabase = () => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_code TEXT UNIQUE,
      name TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_code TEXT UNIQUE,
      name TEXT,
      category TEXT,
      specs TEXT,
      price REAL,
      stock INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE,
      group_id INTEGER,
      user_name TEXT,
      user_phone TEXT,
      product_id INTEGER,
      quantity INTEGER,
      price REAL,
      total_amount REAL,
      paid_amount REAL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS compensation_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      plan_type TEXT,
      target_product_id INTEGER,
      target_specs TEXT,
      target_quantity INTEGER,
      refund_amount REAL,
      supplement_amount REAL,
      status TEXT DEFAULT 'pending',
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmed_at DATETIME,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (target_product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stock_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      change_amount INTEGER,
      change_type TEXT,
      order_id INTEGER,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )`);
  });
};

const seedSampleData = () => {
  db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
    if (err || row.count > 0) return;

    const products = [
      ['F001', '红富士苹果', '水果', '5斤装', 29.9, 50],
      ['F002', '新疆葡萄', '水果', '2斤装', 35.0, 30],
      ['F003', '海南芒果', '水果', '3斤装', 42.0, 20],
      ['P001', '酸菜鱼预制包', '预制菜', '单人份', 18.8, 100],
      ['P002', '红烧肉预制包', '预制菜', '双人份', 32.0, 60],
      ['P003', '宫保鸡丁预制包', '预制菜', '单人份', 16.5, 80],
      ['D001', '抽纸', '日用品', '24包', 25.0, 200],
      ['D002', '洗衣液', '日用品', '5L', 35.0, 50],
      ['D003', '垃圾袋', '日用品', '100只', 12.0, 150]
    ];

    const stmt = db.prepare("INSERT INTO products (product_code, name, category, specs, price, stock) VALUES (?, ?, ?, ?, ?, ?)");
    products.forEach(p => stmt.run(p));
    stmt.finalize();

    db.run("INSERT INTO groups (group_code, name, status) VALUES (?, ?, ?)", ['G20240101', '水果拼团2024-01', 'completed']);
    db.run("INSERT INTO groups (group_code, name, status) VALUES (?, ?, ?)", ['G20240102', '日用品拼团2024-01', 'completed']);
    db.run("INSERT INTO groups (group_code, name, status) VALUES (?, ?, ?)", ['G20240103', '预制菜拼团2024-01', 'pending']);
  });
};

initDatabase();
seedSampleData();

app.get('/api/groups', (req, res) => {
  db.all(`SELECT g.*, 
    (SELECT COUNT(*) FROM orders o WHERE o.group_id = g.id) as order_count,
    (SELECT COUNT(*) FROM orders o WHERE o.group_id = g.id AND o.status = 'out_of_stock') as out_of_stock_count
    FROM groups g ORDER BY g.created_at DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/groups', (req, res) => {
  const { group_code, name } = req.body;
  db.run("INSERT INTO groups (group_code, name) VALUES (?, ?)", [group_code, name], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ id: this.lastID, group_code, name, status: 'pending' });
  });
});

app.put('/api/groups/:id/complete', (req, res) => {
  db.run("UPDATE groups SET status = 'completed' WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/products', (req, res) => {
  db.all("SELECT * FROM products ORDER BY category, name", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/products', (req, res) => {
  const { product_code, name, category, specs, price, stock } = req.body;
  db.run("INSERT INTO products (product_code, name, category, specs, price, stock) VALUES (?, ?, ?, ?, ?, ?)",
    [product_code, name, category, specs, price, stock], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ id: this.lastID, ...req.body });
  });
});

app.put('/api/products/:id', (req, res) => {
  const { name, category, specs, price, stock } = req.body;
  db.run("UPDATE products SET name = ?, category = ?, specs = ?, price = ?, stock = ? WHERE id = ?",
    [name, category, specs, price, stock, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/orders', (req, res) => {
  const { group_id, status } = req.query;
  let sql = `SELECT o.*, p.name as product_name, p.specs as product_specs, g.group_code, g.name as group_name, g.status as group_status
    FROM orders o 
    JOIN products p ON o.product_id = p.id
    JOIN groups g ON o.group_id = g.id`;
  const params = [];
  
  if (group_id) {
    sql += " WHERE o.group_id = ?";
    params.push(group_id);
  }
  if (status) {
    sql += params.length ? " AND o.status = ?" : " WHERE o.status = ?";
    params.push(status);
  }
  sql += " ORDER BY o.created_at DESC";
  
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/orders/import', upload.single('file'), (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    const results = [];
    let processed = 0, failed = 0;
    
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      data.forEach((row, index) => {
        const order_no = row['订单号'] || row['order_no'];
        const group_code = row['拼团号'] || row['group_code'];
        const product_code = row['商品编码'] || row['product_code'];
        const user_name = row['用户名'] || row['user_name'];
        const user_phone = row['手机号'] || row['user_phone'];
        const quantity = parseInt(row['数量'] || row['quantity']) || 1;
        const price = parseFloat(row['单价'] || row['price']) || 0;
        const paid_amount = parseFloat(row['实付金额'] || row['paid_amount']) || price * quantity;
        
        if (!order_no || !group_code || !product_code) {
          failed++;
          return;
        }
        
        db.get("SELECT id FROM groups WHERE group_code = ?", [group_code], (err, group) => {
          if (err || !group) {
            failed++;
            return;
          }
          
          db.get("SELECT id, price, stock FROM products WHERE product_code = ?", [product_code], (err, product) => {
            if (err || !product) {
              failed++;
              return;
            }
            
            const finalPrice = price || product.price;
            const total_amount = finalPrice * quantity;
            
            db.run(`INSERT OR IGNORE INTO orders (order_no, group_id, user_name, user_phone, product_id, quantity, price, total_amount, paid_amount) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [order_no, group.id, user_name, user_phone, product.id, quantity, finalPrice, total_amount, paid_amount],
              function(err) {
                if (err) failed++;
                else if (this.changes > 0) processed++;
              }
            );
          });
        });
      });
      
      setTimeout(() => {
        db.run("COMMIT");
        fs.unlinkSync(req.file.path);
        res.json({ processed, failed, total: data.length });
      }, 1000);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/orders/:id/mark-out-of-stock', (req, res) => {
  const { reason } = req.body;
  db.get("SELECT * FROM orders WHERE id = ?", [req.params.id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: '订单不存在' });
    
    db.get("SELECT status FROM groups WHERE id = ?", [order.group_id], (err, group) => {
      if (err) return res.status(500).json({ error: err.message });
      if (group.status !== 'completed') {
        return res.status(400).json({ error: '拼团未完成，不能标记缺货' });
      }
      
      db.run("UPDATE orders SET status = 'out_of_stock' WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.run(`INSERT INTO compensation_plans (order_id, status, reason) VALUES (?, 'pending', ?)`,
          [req.params.id, reason || '缺货'], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true });
        });
      });
    });
  });
});

app.get('/api/orders/:id/plans', (req, res) => {
  db.all(`SELECT cp.*, o.user_name, o.user_phone, o.total_amount, o.paid_amount,
    p.name as original_product, p.specs as original_specs,
    tp.name as target_product, tp.specs as target_specs, tp.price as target_price
    FROM compensation_plans cp
    JOIN orders o ON cp.order_id = o.id
    JOIN products p ON o.product_id = p.id
    LEFT JOIN products tp ON cp.target_product_id = tp.id
    WHERE cp.order_id = ?`, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/orders/:id/plans', (req, res) => {
  const { plan_type, target_product_id, target_quantity, refund_amount, supplement_amount, reason } = req.body;
  const orderId = req.params.id;
  
  db.get("SELECT * FROM orders WHERE id = ?", [orderId], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: '订单不存在' });
    
    if (refund_amount && refund_amount > order.paid_amount) {
      return res.status(400).json({ error: '退款金额不能超过实付金额' });
    }
    
    db.get("SELECT status FROM groups WHERE id = ?", [order.group_id], (err, group) => {
      if (err) return res.status(500).json({ error: err.message });
      if (group.status !== 'completed') {
        return res.status(400).json({ error: '拼团未完成，不能生成补差方案' });
      }
      
      db.run(`INSERT INTO compensation_plans (order_id, plan_type, target_product_id, target_quantity, refund_amount, supplement_amount, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, plan_type, target_product_id, target_quantity, refund_amount, supplement_amount, reason],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ id: this.lastID, success: true });
        }
      );
    });
  });
});

app.post('/api/plans/:id/confirm', (req, res) => {
  const planId = req.params.id;
  
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    
    db.get("SELECT * FROM compensation_plans WHERE id = ?", [planId], (err, plan) => {
      if (err) {
        db.run("ROLLBACK");
        return res.status(500).json({ error: err.message });
      }
      if (!plan) {
        db.run("ROLLBACK");
        return res.status(404).json({ error: '方案不存在' });
      }
      if (plan.status !== 'pending') {
        db.run("ROLLBACK");
        return res.status(400).json({ error: '方案已确认或已取消' });
      }
      
      db.get("SELECT * FROM orders WHERE id = ?", [plan.order_id], (err, order) => {
        if (err || !order) {
          db.run("ROLLBACK");
          return res.status(500).json({ error: '订单不存在' });
        }
        
        if (plan.plan_type === 'exchange' && plan.target_product_id) {
          db.get("SELECT stock FROM products WHERE id = ?", [plan.target_product_id], (err, product) => {
            if (err) {
              db.run("ROLLBACK");
              return res.status(500).json({ error: err.message });
            }
            if (product.stock < (plan.target_quantity || 1)) {
              db.run("ROLLBACK");
              return res.status(400).json({ error: '目标商品库存不足' });
            }
            
            db.run("UPDATE products SET stock = stock - ? WHERE id = ?", 
              [plan.target_quantity || 1, plan.target_product_id]);
            db.run(`INSERT INTO stock_records (product_id, change_amount, change_type, order_id, remark) 
              VALUES (?, ?, 'out', ?, '换货出库')`,
              [plan.target_product_id, -(plan.target_quantity || 1), plan.order_id]);
            
            db.run("UPDATE products SET stock = stock + ? WHERE id = ?", 
              [order.quantity, order.product_id]);
            db.run(`INSERT INTO stock_records (product_id, change_amount, change_type, order_id, remark) 
              VALUES (?, ?, 'in', ?, '原商品回库')`,
              [order.product_id, order.quantity, plan.order_id]);
          });
        }
        
        db.run("UPDATE compensation_plans SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP WHERE id = ?", [planId]);
        db.run("UPDATE orders SET status = ? WHERE id = ?", 
          [plan.plan_type === 'refund' ? 'refunded' : 'handled', plan.order_id]);
        
        setTimeout(() => {
          db.run("COMMIT");
          res.json({ success: true });
        }, 200);
      });
    });
  });
});

app.get('/api/compensation-summary', (req, res) => {
  const { group_id } = req.query;
  let sql = `SELECT cp.*, o.order_no, o.user_name, o.user_phone, o.total_amount, o.paid_amount,
    p.name as original_product, p.specs as original_specs, p.price as original_price,
    tp.name as target_product, tp.specs as target_specs, tp.price as target_price,
    g.group_code, g.name as group_name
    FROM compensation_plans cp
    JOIN orders o ON cp.order_id = o.id
    JOIN products p ON o.product_id = p.id
    LEFT JOIN products tp ON cp.target_product_id = tp.id
    JOIN groups g ON o.group_id = g.id`;
  
  const params = [];
  if (group_id) {
    sql += " WHERE g.id = ?";
    params.push(group_id);
  }
  sql += " ORDER BY cp.created_at DESC";
  
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const summary = {
      total: rows.length,
      confirmed: rows.filter(r => r.status === 'confirmed').length,
      pending: rows.filter(r => r.status === 'pending').length,
      total_refund: rows.reduce((sum, r) => sum + (r.refund_amount || 0), 0),
      total_supplement: rows.reduce((sum, r) => sum + (r.supplement_amount || 0), 0),
      details: rows
    };
    
    res.json(summary);
  });
});

app.get('/api/export/leader-summary/:groupId', (req, res) => {
  const groupId = req.params.groupId;
  
  db.get("SELECT * FROM groups WHERE id = ?", [groupId], (err, group) => {
    if (err || !group) return res.status(404).json({ error: '拼团不存在' });
    
    db.all(`SELECT cp.*, o.order_no, o.user_name, o.user_phone, o.quantity as original_quantity, o.total_amount, o.paid_amount,
      p.name as original_product, p.specs as original_specs,
      tp.name as target_product, tp.specs as target_specs
      FROM compensation_plans cp
      JOIN orders o ON cp.order_id = o.id
      JOIN products p ON o.product_id = p.id
      LEFT JOIN products tp ON cp.target_product_id = tp.id
      WHERE o.group_id = ? AND cp.status = 'confirmed'
      ORDER BY cp.id`, [groupId], (err, plans) => {
      if (err) return res.status(500).json({ error: err.message });
      
      let markdown = `【${group.name}】补差处理汇总\n\n`;
      markdown += `拼团号: ${group.group_code}\n`;
      markdown += `处理时间: ${new Date().toLocaleString('zh-CN')}\n`;
      markdown += `==============================\n\n`;
      
      const exchangePlans = plans.filter(p => p.plan_type === 'exchange');
      const refundPlans = plans.filter(p => p.plan_type === 'refund');
      const supplementPlans = plans.filter(p => p.plan_type === 'supplement');
      
      if (exchangePlans.length > 0) {
        markdown += `【换货处理】(${exchangePlans.length}单)\n`;
        markdown += `------------------------------\n`;
        exchangePlans.forEach((p, i) => {
          markdown += `${i + 1}. ${p.user_name} (${p.user_phone})\n`;
          markdown += `   原商品: ${p.original_product} ${p.original_specs} × ${p.original_quantity}\n`;
          markdown += `   换为: ${p.target_product || '未指定'} ${p.target_specs || ''} × ${p.target_quantity || 1}\n`;
          markdown += `   原因: ${p.reason || '缺货'}\n\n`;
        });
      }
      
      if (refundPlans.length > 0) {
        markdown += `【退款处理】(${refundPlans.length}单)\n`;
        markdown += `------------------------------\n`;
        let totalRefund = 0;
        refundPlans.forEach((p, i) => {
          totalRefund += (p.refund_amount || 0);
          markdown += `${i + 1}. ${p.user_name} (${p.user_phone})\n`;
          markdown += `   原商品: ${p.original_product} ${p.original_specs} × ${p.original_quantity}\n`;
          markdown += `   退款金额: ¥${(p.refund_amount || 0).toFixed(2)}\n`;
          markdown += `   原因: ${p.reason || '缺货退款'}\n\n`;
        });
        markdown += `退款总计: ¥${totalRefund.toFixed(2)}\n\n`;
      }
      
      if (supplementPlans.length > 0) {
        markdown += `【补差处理】(${supplementPlans.length}单)\n`;
        markdown += `------------------------------\n`;
        let totalSupplement = 0;
        supplementPlans.forEach((p, i) => {
          totalSupplement += (p.supplement_amount || 0);
          markdown += `${i + 1}. ${p.user_name} (${p.user_phone})\n`;
          markdown += `   原商品: ${p.original_product} ${p.original_specs}\n`;
          markdown += `   补款金额: ¥${(p.supplement_amount || 0).toFixed(2)}\n`;
          markdown += `   原因: ${p.reason || '规格差异'}\n\n`;
        });
        markdown += `补款总计: ¥${totalSupplement.toFixed(2)}\n\n`;
      }
      
      markdown += `==============================\n`;
      markdown += `请各位团友核对以上信息，如有疑问请联系团长。\n`;
      
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=团长汇总_${group.group_code}.md`);
      res.send(markdown);
    });
  });
});

app.get('/api/export/excel/:groupId', (req, res) => {
  const groupId = req.params.groupId;
  
  db.all(`SELECT cp.*, o.order_no, o.user_name, o.user_phone, o.quantity as original_quantity, o.total_amount, o.paid_amount,
    p.name as original_product, p.specs as original_specs,
    tp.name as target_product, tp.specs as target_specs,
    g.group_code, g.name as group_name
    FROM compensation_plans cp
    JOIN orders o ON cp.order_id = o.id
    JOIN products p ON o.product_id = p.id
    LEFT JOIN products tp ON cp.target_product_id = tp.id
    JOIN groups g ON o.group_id = g.id
    WHERE o.group_id = ?
    ORDER BY cp.id`, [groupId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const data = rows.map(r => ({
      '拼团号': r.group_code,
      '拼团名称': r.group_name,
      '订单号': r.order_no,
      '用户名': r.user_name,
      '手机号': r.user_phone,
      '原商品': r.original_product,
      '原规格': r.original_specs,
      '原数量': r.original_quantity,
      '原金额': r.total_amount,
      '实付金额': r.paid_amount,
      '处理方式': r.plan_type === 'exchange' ? '换货' : r.plan_type === 'refund' ? '退款' : '补差',
      '目标商品': r.target_product || '',
      '目标规格': r.target_specs || '',
      '目标数量': r.target_quantity || '',
      '退款金额': r.refund_amount || '',
      '补款金额': r.supplement_amount || '',
      '原因': r.reason || '',
      '状态': r.status === 'confirmed' ? '已确认' : '待确认'
    }));
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '补差明细');
    
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=补差明细_${rows[0]?.group_code || 'export'}.xlsx`);
    res.send(buffer);
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
