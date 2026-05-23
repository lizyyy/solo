const express = require('express');
const path = require('path');
const initDatabase = require('./models/init');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/exports', express.static(path.join(__dirname, '../exports')));

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在', path: req.path });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误', detail: err.message });
});

async function startServer() {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`快递驿站滞留 API 服务已启动`);
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/api/health`);
      console.log(`数据库位置: ${path.join(__dirname, '../data/station.db')}`);
    });
  } catch (error) {
    console.error('启动服务失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
