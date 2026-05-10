const express = require('express');
const bodyParser = require('body-parser');
const petRoutes = require('./routes/pets');
const medicationPlanRoutes = require('./routes/medicationPlans');
const executionReceiptRoutes = require('./routes/executionReceipts');
const summaryRoutes = require('./routes/summary');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.use('/api/pets', petRoutes);
app.use('/api/medication-plans', medicationPlanRoutes);
app.use('/api/execution-receipts', executionReceiptRoutes);
app.use('/api/summary', summaryRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '宠物寄养喂药提醒 API 运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: '服务器内部错误',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`宠物寄养喂药提醒 API 运行在 http://localhost:${PORT}`);
});
