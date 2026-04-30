const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase, STATUS_FLOW, STATUS_COLORS } = require('./database');

const ticketsRoute = require('./routes/tickets');
const csvRoute = require('./routes/csv');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/tickets', ticketsRoute);
app.use('/api/csv', csvRoute);

app.get('/api/status-flow', (req, res) => {
  res.json({
    success: true,
    data: {
      flow: STATUS_FLOW,
      colors: STATUS_COLORS,
      allStatuses: Object.keys(STATUS_FLOW)
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('错误:', err);
  
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: '请求体解析失败',
      message: '请检查 JSON 格式是否正确'
    });
  }
  
  if (err.message === '只允许上传 CSV 文件') {
    return res.status(400).json({
      success: false,
      error: '文件类型错误',
      message: err.message
    });
  }
  
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : '请稍后重试'
  });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: '接口不存在',
      message: `请求的接口 ${req.method} ${req.path} 不存在`
    });
  } else {
    res.status(404).sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

async function startServer() {
  try {
    console.log('初始化数据库...');
    initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log('========================================');
      console.log('  手机维修工单管理系统');
      console.log('========================================');
      console.log(`服务已启动: http://localhost:${PORT}`);
      console.log(`API 地址: http://localhost:${PORT}/api`);
      console.log('========================================');
    });
  } catch (err) {
    console.error('启动服务失败:', err);
    process.exit(1);
  }
}

startServer();
