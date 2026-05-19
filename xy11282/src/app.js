const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const medicinesRouter = require('./routes/medicines');
const petsRouter = require('./routes/pets');
const inventoryRouter = require('./routes/inventory');
const prescriptionsRouter = require('./routes/prescriptions');
const auditLogsRouter = require('./routes/auditLogs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    name: '宠物医院药房管理系统',
    version: '1.0.0',
    description: '宠物医院药房后端API服务',
    endpoints: {
      medicines: '/api/medicines',
      pets: '/api/pets',
      inventory: '/api/inventory',
      prescriptions: '/api/prescriptions',
      auditLogs: '/api/audit-logs'
    }
  });
});

app.use('/api/medicines', medicinesRouter);
app.use('/api/pets', petsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/prescriptions', prescriptionsRouter);
app.use('/api/audit-logs', auditLogsRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    reason: '请求的路径未找到'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message,
    reason: err.message
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 宠物医院药房管理系统启动成功!`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📚 API文档: 请查看 README.md\n`);
});

module.exports = app;
