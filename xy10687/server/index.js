const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const { initDatabase, getDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const orderRoutes = require('./routes/orders');
const technicianRoutes = require('./routes/technicians');
const sparePartRoutes = require('./routes/spareParts');

app.use('/api/orders', orderRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/spare-parts', sparePartRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '道路救援备件派单系统运行正常' });
});

initDatabase((err) => {
  if (err) {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  }
  
  require('./initData')();
  
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
});
