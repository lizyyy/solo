const express = require('express');
const bodyParser = require('body-parser');
const { sequelize } = require('./models');
const teamChangeRoutes = require('./routes/teamChangeRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/team-change', teamChangeRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '户外研学改队系统运行正常' });
});

async function startServer() {
  try {
    await sequelize.sync({ force: false });
    console.log('数据库连接成功');
    
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
