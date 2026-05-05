const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');
const importRoutes = require('./routes/import');
const riskRoutes = require('./routes/risk');
const escalatorRoutes = require('./routes/escalator');
const maintenanceRoutes = require('./routes/maintenance');
const repairRoutes = require('./routes/repair');
const inspectionRoutes = require('./routes/inspection');
const currentLogRoutes = require('./routes/currentLog');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

db.init().then(() => {
  console.log('数据库初始化完成');
}).catch((err) => {
  console.error('数据库初始化失败:', err);
});

app.use('/api/import', importRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/escalator', escalatorRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/repair', repairRoutes);
app.use('/api/inspection', inspectionRoutes);
app.use('/api/current-log', currentLogRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`扶梯停梯复盘工具后端服务运行在 http://localhost:${PORT}`);
});
