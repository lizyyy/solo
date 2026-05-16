const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database/schema');
const replayRoutes = require('./routes/replayRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api/replay', replayRoutes);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'replay-isolation-api',
    version: '1.0.0'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: '数据回放隔离API',
    version: '1.0.0',
    endpoints: {
      spaces: 'POST /api/replay/spaces - 创建隔离空间',
      batches: 'POST /api/replay/batches - 创建事件批次',
      payloads: 'POST /api/replay/batches/:id/payloads - 添加脱敏载荷',
      state: 'POST /api/replay/batches/:id/state - 推进回放状态',
      interceptions: 'POST /api/replay/batches/:id/interceptions - 记录写入拦截',
      exceptions: 'POST /api/replay/batches/:id/exceptions - 记录异常',
      corrections: 'POST /api/replay/batches/:id/corrections - 创建人工修正',
      reviews: 'POST /api/replay/batches/:id/reviews - 创建复盘摘要',
      detail: 'GET /api/replay/batches/:id/detail - 查询批次详情',
      export: 'GET /api/replay/batches/:id/export - 导出数据',
      audit: 'GET /api/replay/audit - 查询审计日志',
      desensitize: 'POST /api/replay/desensitize - 数据脱敏工具'
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: '内部服务器错误',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

const startServer = async () => {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`数据回放隔离API服务已启动`);
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('服务启动失败:', err);
    process.exit(1);
  }
};

startServer();
