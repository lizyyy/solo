const express = require('express');
const routes = require('./routes');
const initTables = require('./models/initTables');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

const startServer = async () => {
  try {
    await initTables();
    console.log('数据库表初始化完成');
    
    app.listen(PORT, () => {
      console.log(`
=============================================
🚀 培训证书续期 API 服务已启动
📡 服务地址: http://localhost:${PORT}
📚 API 文档: http://localhost:${PORT}/api
💊 健康检查: http://localhost:${PORT}/api/health
=============================================
      `);
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
};

startServer();
