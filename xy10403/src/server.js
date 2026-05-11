const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { PORT } = require('./config');
const initDatabase = require('./models/init');
const { startRecycleJob } = require('./controllers/recycleController');

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const appointmentRoutes = require('./routes/appointments');
const approvalRoutes = require('./routes/approvals');
const vehicleRoutes = require('./routes/vehicles');
const gateRoutes = require('./routes/gates');
const queryRoutes = require('./routes/queries');
const recycleRoutes = require('./routes/recycle');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/gates', gateRoutes);
app.use('/api/queries', queryRoutes);
app.use('/api/recycle', recycleRoutes);

app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: '服务运行正常', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ code: 500, message: '服务器内部错误', error: err.message });
});

const startServer = async () => {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  园区门禁访客 API 服务已启动`);
      console.log(`  访问地址: http://localhost:${PORT}`);
      console.log(`  健康检查: http://localhost:${PORT}/api/health`);
      console.log(`========================================\n`);
      console.log(`数据库文件: data/park-access.db`);
      console.log(`默认账号:`);
      console.log(`  admin    / 123456  (系统管理员)`);
      console.log(`  approver / 123456  (审批员)`);
      console.log(`  gate1    / 123456  (东门闸口操作员)`);
      console.log(`  gate2    / 123456  (西门闸口操作员)\n`);
      
      startRecycleJob();
    });
  } catch (err) {
    console.error('服务器启动失败:', err);
    process.exit(1);
  }
};

startServer();
