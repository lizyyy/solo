const express = require('express');
const cors = require('cors');
const config = require('./config');
const { initDatabase } = require('./models/database');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/batches', require('./routes/batches'));
app.use('/api', require('./routes/query'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '汽修连锁门店后端服务运行正常', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误', message: err.message });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(config.port, () => {
      console.log(`服务已启动，监听端口 ${config.port}`);
      console.log(`健康检查: http://localhost:${config.port}/api/health`);
    });
  } catch (err) {
    console.error('服务启动失败:', err);
    process.exit(1);
  }
}

startServer();
