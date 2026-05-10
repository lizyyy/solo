const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(bodyParser.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '供应商资质冻结 API 服务运行中' });
});

const qualificationRouter = require('./routes/qualification');
const orderRouter = require('./routes/order');
const supplementRouter = require('./routes/supplement');
const recoveryRouter = require('./routes/recovery');
const riskRouter = require('./routes/risk');
const ruleRouter = require('./routes/rule');
const exceptionRouter = require('./routes/exception');
const exportRouter = require('./routes/export');

app.use('/api/qualifications', qualificationRouter);
app.use('/api/orders', orderRouter);
app.use('/api/supplements', supplementRouter);
app.use('/api/recoveries', recoveryRouter);
app.use('/api/risks', riskRouter);
app.use('/api/rules', ruleRouter);
app.use('/api/exceptions', exceptionRouter);
app.use('/api/export', exportRouter);

app.use((err, req, res, next) => {
  console.error('未捕获的错误:', err);
  res.status(500).json({ 
    success: false, 
    error: '服务器内部错误',
    message: err.message
  });
});

async function startServer() {
  try {
    await db.init();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`供应商资质冻结 API 服务已启动`);
      console.log(`监听端口: ${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
      console.log('');
      console.log('API 端点:');
      console.log('  资质管理:      http://localhost:3000/api/qualifications');
      console.log('  订单管理:      http://localhost:3000/api/orders');
      console.log('  补证申请:      http://localhost:3000/api/supplements');
      console.log('  恢复申请:      http://localhost:3000/api/recoveries');
      console.log('  风险清单:      http://localhost:3000/api/risks');
      console.log('  到期规则:      http://localhost:3000/api/rules');
      console.log('  异常记录:      http://localhost:3000/api/exceptions');
      console.log('  导出复核:      http://localhost:3000/api/export/full');
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
