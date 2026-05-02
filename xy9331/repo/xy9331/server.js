const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const shiftRoutes = require('./routes/shifts');
const swapRequestRoutes = require('./routes/swapRequests');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

app.use(express.static(publicDir));

app.use('/api/auth', authRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/swap-requests', swapRequestRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('  小餐馆排班换班系统已启动');
  console.log('========================================');
  console.log('');
  console.log('访问地址: http://localhost:' + PORT);
  console.log('');
  console.log('首次使用请先执行:');
  console.log('  1. npm install');
  console.log('  2. npm run init-data (初始化示例数据)');
  console.log('  3. npm start (启动服务)');
  console.log('');
  console.log('登录账号:');
  console.log('  店长: username=manager, password=manager123');
  console.log('  员工: username=zhangsan, password=123456');
  console.log('  员工: username=lisi, password=123456');
  console.log('  员工: username=wangwu, password=123456');
  console.log('  员工: username=zhaoliu, password=123456');
  console.log('');
});
