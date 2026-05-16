const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database/db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'compatibility-scoring-service',
    timestamp: new Date().toISOString()
  });
});

app.use(express.static(path.join(__dirname, '../public')));

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    error: '内部服务器错误',
    message: err.message
  });
});

const startServer = async () => {
  try {
    await db.init();
    
    app.listen(PORT, () => {
      console.log(`
=========================================
  兼容评分服务启动成功!
  服务地址: http://localhost:${PORT}
  健康检查: http://localhost:${PORT}/health
  API文档:   http://localhost:${PORT}/
=========================================
      `);
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
};

startServer();
