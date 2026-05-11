import * as express from 'express';
import * as cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import * as multer from 'multer';
import * as csv from 'csv-parser';
import { initDatabase, db } from './database';
import { seedSampleData } from './seedData';
import { calculatePrediction, getRiskProducts } from './prediction';
import * as dayjs from 'dayjs';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

initDatabase();

app.post('/api/seed', async (req, res) => {
  try {
    await seedSampleData();
    res.json({ success: true, message: '样例数据已生成' });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

const upload = multer({ dest: path.join(__dirname, '../uploads/') });

app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products ORDER BY category, name', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.get('/api/sales-history', (req, res) => {
  const { productId, startDate, endDate } = req.query;
  let query = `SELECT sh.*, p.name as product_name, p.category, p.unit
               FROM sales_history sh
               JOIN products p ON sh.product_id = p.id
               WHERE 1=1`;
  const params: any[] = [];
  
  if (productId) {
    query += ' AND sh.product_id = ?';
    params.push(productId);
  }
  if (startDate) {
    query += ' AND sh.date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND sh.date <= ?';
    params.push(endDate);
  }
  query += ' ORDER BY sh.date DESC LIMIT 100';
  
  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.get('/api/stock-records', (req, res) => {
  db.all(`SELECT sr.*, p.name as product_name, p.category, p.unit
          FROM stock_records sr
          JOIN products p ON sr.product_id = p.id
          ORDER BY sr.date DESC LIMIT 100`, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.get('/api/weather-tags', (req, res) => {
  db.all('SELECT * FROM weather_tags ORDER BY date', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.get('/api/holidays', (req, res) => {
  db.all('SELECT * FROM holidays ORDER BY date', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.post('/api/weather-tags', (req, res) => {
  const { date, tag } = req.body;
  db.run('INSERT OR REPLACE INTO weather_tags (date, tag) VALUES (?, ?)', [date, tag], (err: any) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ success: true });
  });
});

app.post('/api/holidays', (req, res) => {
  const { date, name } = req.body;
  db.run('INSERT OR REPLACE INTO holidays (date, name) VALUES (?, ?)', [date, name], (err: any) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ success: true });
  });
});

app.post('/api/upload/sales', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const results: any[] = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      const stmt = db.prepare('INSERT INTO sales_history (product_id, date, quantity, weather_tag, is_holiday) VALUES (?, ?, ?, ?, ?)');
      
      db.serialize(() => {
        results.forEach((row: any) => {
          stmt.run(row.product_id, row.date, parseFloat(row.quantity), row.weather_tag || null, row.is_holiday ? 1 : 0);
        });
        stmt.finalize();
      });
      
      fs.unlinkSync(req.file!.path!);
      res.json({ imported: results.length });
    });
});

app.get('/api/predictions', async (req, res) => {
  try {
    const { targetDate } = req.query;
    const date = (targetDate as string) || dayjs().format('YYYY-MM-DD');
    
    db.all('SELECT * FROM products ORDER BY category, name', async (err, products: any[]) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const predictions = [];
      for (const product of products) {
        const prediction = await calculatePrediction({
          productId: product.id,
          targetDate: date
        });
        predictions.push({
          ...product,
          ...prediction
        });
      }
      
      res.json(predictions);
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/orders', (req, res) => {
  const { status, deliveryDate } = req.query;
  let query = `SELECT o.*, p.name as product_name, p.category, p.unit
               FROM orders o
               JOIN products p ON o.product_id = p.id
               WHERE 1=1`;
  const params: any[] = [];
  
  if (status) {
    query += ' AND o.status = ?';
    params.push(status);
  }
  if (deliveryDate) {
    query += ' AND o.delivery_date = ?';
    params.push(deliveryDate);
  }
  query += ' ORDER BY o.delivery_date DESC, o.order_date DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.post('/api/orders', (req, res) => {
  const { orders, orderDate, deliveryDate } = req.body;
  
  db.get(
    'SELECT COUNT(*) as count FROM orders WHERE order_date = ?',
    [orderDate],
    (err, row: any) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (row.count > 0) {
        return res.status(400).json({
          error: 'duplicate_order',
          message: `${orderDate} 已存在报货单，请不要重复报货`
        });
      }
      
      const insertOrder = db.prepare(`INSERT INTO orders 
        (product_id, order_date, delivery_date, suggested_qty, adjusted_qty, adjustment_reason, status)
        VALUES (?, ?, ?, ?, ?, ?, 'submitted')`);
      
      const insertHistory = db.prepare(`INSERT INTO adjustment_history
        (order_id, product_id, suggested_qty, adjusted_qty, adjustment_reason)
        VALUES (?, ?, ?, ?, ?)`);
      
      db.serialize(() => {
        orders.forEach((order: any) => {
          insertOrder.run(
            order.productId,
            orderDate,
            deliveryDate,
            order.suggestedQty,
            order.adjustedQty,
            order.adjustmentReason,
            function(err: any) {
              if (err) return;
              if (order.adjustedQty !== order.suggestedQty && order.adjustmentReason) {
                insertHistory.run(
                  this.lastID,
                  order.productId,
                  order.suggestedQty,
                  order.adjustedQty,
                  order.adjustmentReason
                );
              }
            }
          );
        });
        
        insertOrder.finalize(() => {
          insertHistory.finalize();
          res.json({ success: true, count: orders.length });
        });
      });
    }
  );
});

app.put('/api/orders/:id/receive', (req, res) => {
  const { id } = req.params;
  const { actualQty, wastageQty, explanation } = req.body;
  
  db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order: any) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    if (actualQty > order.adjusted_qty && !explanation) {
      return res.status(400).json({
        error: 'excess_delivery',
        message: '实际到货数量大于采购数量，请说明原因'
      });
    }
    
    const wastageRate = actualQty > 0 ? wastageQty / actualQty : 0;
    if (wastageRate > 0.15 && !explanation) {
      db.run(`INSERT INTO alerts (type, product_id, order_id, message)
        VALUES ('high_wastage', ?, ?, ?)`,
        [order.product_id, id, `损耗率达${(wastageRate * 100).toFixed(1)}%，异常偏高，请复盘原因`]
      );
    }
    
    db.run(
      `UPDATE orders SET actual_qty = ?, wastage_qty = ?, status = 'received' WHERE id = ?`,
      [actualQty, wastageQty, id],
      (err: any) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ success: true });
      }
    );
  });
});

app.get('/api/adjustment-history', (req, res) => {
  db.all(`SELECT ah.*, o.order_date, o.delivery_date, p.name as product_name, p.category, p.unit
          FROM adjustment_history ah
          JOIN orders o ON ah.order_id = o.id
          JOIN products p ON ah.product_id = p.id
          ORDER BY ah.adjustment_date DESC LIMIT 100`, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.get('/api/alerts', (req, res) => {
  db.all(`SELECT a.*, p.name as product_name, p.category, p.unit
          FROM alerts a
          LEFT JOIN products p ON a.product_id = p.id
          ORDER BY a.date DESC`, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.put('/api/alerts/:id/resolve', (req, res) => {
  db.run('UPDATE alerts SET resolved = 1 WHERE id = ?', [req.params.id], (err: any) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ success: true });
  });
});

app.get('/api/dashboard', (req, res) => {
  const results: any = {};
  
  db.all(`SELECT p.category, 
                 SUM(o.suggested_qty) as total_suggested,
                 SUM(o.adjusted_qty) as total_adjusted,
                 COUNT(*) as order_count
          FROM orders o
          JOIN products p ON o.product_id = p.id
          WHERE o.status = 'submitted'
          GROUP BY p.category`, (err, categoryStats) => {
    if (err) return res.status(500).json({ error: err.message });
    results.categoryStats = categoryStats;
    
    getRiskProducts().then(riskProducts => {
      results.riskProducts = riskProducts;
      
      db.all(`SELECT ah.*, o.order_date, o.delivery_date, p.name as product_name, p.category
              FROM adjustment_history ah
              JOIN orders o ON ah.order_id = o.id
              JOIN products p ON ah.product_id = p.id
              ORDER BY ah.adjustment_date DESC LIMIT 20`, (err, adjustments) => {
        if (err) return res.status(500).json({ error: err.message });
        results.adjustments = adjustments;
        
        db.all(`SELECT o.*, p.name as product_name, p.category, p.unit
                FROM orders o
                JOIN products p ON o.product_id = p.id
                WHERE o.status = 'submitted'
                ORDER BY o.order_date DESC`, (err, pendingOrders) => {
          if (err) return res.status(500).json({ error: err.message });
          results.pendingOrders = pendingOrders;
          res.json(results);
        });
      });
    });
  });
});

app.get('/api/review', (req, res) => {
  db.all(`SELECT 
            o.*,
            p.name as product_name,
            p.category,
            p.unit,
            ah.adjustment_reason as manual_adjustment_reason,
            CASE WHEN o.actual_qty IS NOT NULL 
                 THEN (o.wastage_qty / o.actual_qty * 100) 
                 ELSE NULL 
            END as wastage_rate,
            CASE WHEN o.adjusted_qty > 0 
                 THEN (o.actual_qty / o.adjusted_qty * 100) 
                 ELSE NULL 
            END as delivery_rate
          FROM orders o
          JOIN products p ON o.product_id = p.id
          LEFT JOIN adjustment_history ah ON o.id = ah.order_id
          WHERE o.status = 'received'
          ORDER BY o.delivery_date DESC`, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  seedSampleData().then(() => {
    console.log('Sample data initialized');
  }).catch(err => {
    console.error('Error initializing sample data:', err);
  });
});
