const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../public')));

const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const pickupSlotsRouter = require('./routes/pickup-slots');
const replacementsRouter = require('./routes/replacements');
const csvRouter = require('./routes/csv');

app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/pickup-slots', pickupSlotsRouter);
app.use('/api/replacements', replacementsRouter);
app.use('/api/csv', csvRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: '小区团购预售订单管理系统 API 服务正常运行'
  });
});

app.get('/api/stats', (req, res) => {
  const db = require('./db/index');
  
  db.serialize(() => {
    db.get('SELECT COUNT(*) as count FROM products', (err, productCount) => {
      db.get('SELECT COUNT(*) as count FROM orders', (err, orderCount) => {
        db.get('SELECT COUNT(*) as count FROM orders WHERE status = "needs_replacement"', (err, pendingReplacementCount) => {
          db.all('SELECT status, COUNT(*) as count FROM orders GROUP BY status', (err, orderStatuses) => {
            db.all('SELECT pickup_time, COUNT(*) as count FROM orders GROUP BY pickup_time ORDER BY pickup_time', (err, pickupStats) => {
              res.json({
                products: productCount ? productCount.count : 0,
                orders: orderCount ? orderCount.count : 0,
                pending_replacements: pendingReplacementCount ? pendingReplacementCount.count : 0,
                order_statuses: orderStatuses || [],
                pickup_stats: pickupStats || []
              });
            });
          });
        });
      });
    });
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  console.error('错误:', err.stack);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`小区团购预售订单管理系统`);
  console.log(`========================================`);
  console.log(`服务已启动: http://localhost:${PORT}`);
  console.log(`API 地址: http://localhost:${PORT}/api`);
  console.log(`数据库路径: ${dataDir}`);
  console.log(`========================================\n`);
});
