const express = require('express');
const store = require('./data/store');

const workOrdersRouter = require('./routes/workOrders');
const requisitionsRouter = require('./routes/requisitions');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

store.initSampleData();

app.use('/api/work-orders', workOrdersRouter);
app.use('/api/requisitions', requisitionsRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '维修备件领用API运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`维修备件领用API已启动，运行在 http://localhost:${PORT}`);
  console.log('示例数据已初始化:');
  console.log('  - 维修人员: 张师傅(S001), 李师傅(S002)');
  console.log('  - 设备: 中央空调A-01(E001), 驱动电机M-05(E002), 温度传感器TS-12(E003)');
  console.log('  - 备件: 空调类、电机类、传感器类各2种，共6种');
});

module.exports = app;
