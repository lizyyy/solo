const express = require('express');
const cors = require('cors');
const accountsRouter = require('./routes/accounts');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/accounts', accountsRouter);

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: '测试账号借用API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    service: '测试账号借用管理系统',
    version: '1.0.0',
    features: [
      '账号管理：创建、查询、状态跟踪',
      '借用管理：借用、归还、超时检测',
      '设备绑定：冲突检测、占用跟踪',
      '异常处理：强制回收、人工修正',
      '历史记录：操作日志、借用历史',
      '数据导出：CSV格式导出'
    ],
    endpoints: {
      accounts: '/api/accounts',
      health: '/api/health',
      status: '/api/status'
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'API端点不存在',
    path: req.path,
    method: req.method
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║       测试账号借用管理 API 服务已启动                        ║
║                                                            ║
║       服务地址: http://localhost:${PORT}                      ║
║       健康检查: http://localhost:${PORT}/api/health            ║
║       状态信息: http://localhost:${PORT}/api/status            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
