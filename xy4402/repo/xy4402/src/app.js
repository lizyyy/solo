const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { syncDatabase } = require('./models');

const batchesRouter = require('./routes/batches');
const storesRouter = require('./routes/stores');
const vehiclesRouter = require('./routes/vehicles');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static('public'));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '餐厨废油回收 REST API 服务',
    version: '1.0.0',
    endpoints: {
      batches: '/api/batches',
      stores: '/api/stores',
      vehicles: '/api/vehicles',
      health: '/health'
    }
  });
});

app.use('/api/batches', batchesRouter);
app.use('/api/stores', storesRouter);
app.use('/api/vehicles', vehiclesRouter);

app.use((err, req, res, next) => {
  console.error('错误:', err.message);
  
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: '无效的 JSON 数据'
    });
  }
  
  res.status(500).json({
    success: false,
    error: err.message || '服务器内部错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

const startServer = async () => {
  try {
    await syncDatabase(false);
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`服务已启动，监听端口 ${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
      console.log(`API 文档: http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
