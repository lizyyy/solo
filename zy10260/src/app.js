const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database');

const bedsRouter = require('./routes/beds');
const { router: devicesRouter } = require('./routes/devices');
const inspectionsRouter = require('./routes/inspections');
const faultsRouter = require('./routes/faults');
const disinfectionRouter = require('./routes/disinfection');
const recoveriesRouter = require('./routes/recoveries');
const { router: historyRouter } = require('./routes/history');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/beds', bedsRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/inspections', inspectionsRouter);
app.use('/api/faults', faultsRouter);
app.use('/api/disinfection', disinfectionRouter);
app.use('/api/recoveries', recoveriesRouter);
app.use('/api/history', historyRouter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '医院床旁设备巡检 API 运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '服务器内部错误', error: err.message });
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('API 文档：');
    console.log('  GET  /api/health - 健康检查');
    console.log('  床位管理: /api/beds');
    console.log('  设备管理: /api/devices');
    console.log('  巡检管理: /api/inspections');
    console.log('  故障管理: /api/faults');
    console.log('  消毒记录: /api/disinfection');
    console.log('  恢复入库: /api/recoveries');
    console.log('  操作历史: /api/history');
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
});
