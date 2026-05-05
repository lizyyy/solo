const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const experimentsRouter = require('./routes/experiments');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  }
}));

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    success: false,
    error: '请求频率过高，请稍后再试'
  }
});

const createExperimentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: '创建实验过于频繁，请稍后再试'
  }
});

app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: Date.now(),
    version: '1.0.0'
  });
});

app.get('/api/info', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Reactor/Proactor 网络模型实验台',
      version: '1.0.0',
      description: '一个用于演示和对比 Reactor 和 Proactor 两种网络模型的实验平台',
      features: [
        '可配置连接数、读写事件数',
        '自定义 handler 注册',
        '可调整回调耗时、超时时间',
        '可设置失败率模拟异常场景',
        '事件时间线可视化',
        '线程占用、队列堆积对比',
        'Markdown/JSON 报告导出',
        '预设种子实验数据'
      ],
      models: {
        Reactor: {
          description: '同步 I/O + 事件就绪通知',
          features: [
            '单线程事件循环',
            '应用程序主动读写',
            '适用于短连接、高并发场景'
          ]
        },
        Proactor: {
          description: '异步 I/O + 完成事件通知',
          features: [
            '线程池处理回调',
            '操作系统执行实际读写',
            '适用于长连接、高吞吐场景'
          ]
        }
      }
    }
  });
});

app.use('/api/experiments', (req, res, next) => {
  if (req.method === 'POST' && req.path === '/') {
    return createExperimentLimiter(req, res, next);
  }
  next();
}, experimentsRouter);

const frontendPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}

app.get('/', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      message: 'Reactor/Proactor 网络模型实验台 API 服务',
      endpoints: {
        health: '/api/health',
        info: '/api/info',
        experiments: '/api/experiments',
        seeds: '/api/experiments/seeds'
      }
    });
  }
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: '请求体解析失败，请检查 JSON 格式'
    });
  }

  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use('*', (req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: 'API 端点不存在: ' + req.originalUrl
    });
  } else {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ 
        success: false,
        message: 'Not Found' 
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     Reactor/Proactor 网络模型实验台                           ║
╠══════════════════════════════════════════════════════════════╣
║  服务已启动: http://localhost:${PORT}                            ║
║                                                                  ║
║  API 端点:                                                       ║
║    - GET  /api/health           - 健康检查                     ║
║    - GET  /api/info             - 系统信息                     ║
║    - GET  /api/experiments      - 实验列表                     ║
║    - GET  /api/experiments/seeds - 种子数据                   ║
║    - POST /api/experiments      - 创建实验                     ║
║    - GET  /api/experiments/:id  - 实验详情                     ║
║    - POST /api/experiments/:id/run - 运行实验                  ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
