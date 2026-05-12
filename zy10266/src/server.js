const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '图书馆研讨间预约API运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 图书馆研讨间预约API已启动`);
  console.log(`📡 服务器地址: http://localhost:${PORT}`);
  console.log(`🔍 健康检查: http://localhost:${PORT}/health`);
  console.log(`📚 API文档:`);
  console.log(`   - GET  /api/rooms - 获取房间列表`);
  console.log(`   - GET  /api/rooms/:id - 获取房间详情`);
  console.log(`   - GET  /api/rooms/:id/devices - 获取房间设备`);
  console.log(`   - GET  /api/students - 获取学生列表`);
  console.log(`   - GET  /api/students/:id/credit - 获取学生信誉分`);
  console.log(`   - GET  /api/bookings - 获取预约列表`);
  console.log(`   - POST /api/bookings - 创建预约`);
  console.log(`   - POST /api/bookings/:id/members - 添加预约成员`);
  console.log(`   - POST /api/bookings/:id/cancel - 取消预约`);
  console.log(`   - POST /api/bookings/:id/checkin - 签到`);
  console.log(`   - POST /api/bookings/:id/no-show - 处理爽约`);
  console.log(`\n💡 运行 'npm run seed' 初始化种子数据`);
  console.log(`💡 运行 'npm test' 执行完整流程测试\n`);
});