const express = require('express');
const { sequelize } = require('./models');

const contractsRouter = require('./routes/contracts');
const repaymentsRouter = require('./routes/repayments');
const forbearanceRouter = require('./routes/forbearance');
const collectionsRouter = require('./routes/collections');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/contracts', contractsRouter);
app.use('/api/repayments', repaymentsRouter);
app.use('/api/forbearance', forbearanceRouter);
app.use('/api/collections', collectionsRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '小贷还款宽限 API 运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    await sequelize.sync({ alter: false });
    console.log('数据库同步完成');

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
