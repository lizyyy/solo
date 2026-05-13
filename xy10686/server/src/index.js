const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { sequelize } = require('./models');
const routes = require('./routes');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '材料验收系统后端运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    await sequelize.sync({ alter: false });
    console.log('数据表同步完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
};

app.listen(PORT, async () => {
  await initDatabase();
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

module.exports = app;
