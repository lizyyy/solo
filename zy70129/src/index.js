const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database/init');
const { cleanupExpired } = require('./utils/idempotency');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

initDatabase();

app.use(express.static(path.join(__dirname, '../public')));

const ordersRouter = require('./routes/orders');
const checklistsRouter = require('./routes/checklists');
const damageRouter = require('./routes/damage');
const utilityRouter = require('./routes/utility');
const feesRouter = require('./routes/fees');
const refundsRouter = require('./routes/refunds');
const reportsRouter = require('./routes/reports');

app.use('/api/orders', ordersRouter);
app.use('/api/checklists', checklistsRouter);
app.use('/api/damage', damageRouter);
app.use('/api/utility', utilityRouter);
app.use('/api/fees', feesRouter);
app.use('/api/refunds', refundsRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/constants', (req, res) => {
  res.json({
    order_status: require('./utils/constants').ORDER_STATUS,
    refund_status: require('./utils/constants').REFUND_QUEUE_STATUS,
    refund_method: require('./utils/constants').REFUND_METHOD,
    damage_degree: require('./utils/constants').DAMAGE_DEGREE,
    utility_type: require('./utils/constants').UTILITY_TYPE,
    adjustment_type: require('./utils/constants').ADJUSTMENT_TYPE
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    code: 500,
    message: err.message || '服务器内部错误',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`场馆押金退还服务启动成功`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API 文档: http://localhost:${PORT}/`);
  
  setInterval(() => {
    try {
      const cleaned = cleanupExpired();
      if (cleaned > 0) {
        console.log(`清理了 ${cleaned} 个过期的幂等性记录`);
      }
    } catch (err) {
      console.error('清理幂等性记录失败:', err.message);
    }
  }, 60 * 60 * 1000);
});
