const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const authRoutes = require('./routes/auth');
const batchRoutes = require('./routes/batches');
const importRoutes = require('./routes/import');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/import', importRoutes);
app.use('/api/reports', reportRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           汽修连锁对账服务已启动                           ║
╠════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                           ║
║  健康检查: http://localhost:${PORT}/health                   ║
║                                                            ║
║  默认账号:                                                 ║
║    admin      / admin123   (系统管理员)                   ║
║    manager_hq / store123   (总部旗舰店店长)                ║
║    manager_hd / store123   (海淀分店店长)                  ║
║                                                            ║
║  首次启动请先执行: npm run init-db                        ║
╚════════════════════════════════════════════════════════════╝
  `);
});
