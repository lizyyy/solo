const express = require('express');
const sequelize = require('./config/database');
const whitelistRoutes = require('./routes/whitelistRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/whitelists', whitelistRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '白名单解释API服务运行正常' });
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    await sequelize.sync({ alter: false });
    console.log('数据库模型同步完成');

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();
