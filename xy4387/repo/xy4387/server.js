const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');

const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保必要的目录存在
const ensureDirectories = () => {
  const dirs = ['./data', './uploads', './public'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

ensureDirectories();

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// API路由
app.use('/api', apiRoutes);

// 首页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.stack);
  
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: `文件上传错误: ${err.message}`
    });
  }
  
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

// 404处理
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: 'API接口不存在'
    });
  } else {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  3D打印夜班管理系统已启动`);
  console.log(`========================================`);
  console.log(`  本地访问地址: http://localhost:${PORT}`);
  console.log(`  API地址: http://localhost:${PORT}/api`);
  console.log(`========================================`);
  console.log(`  功能说明:`);
  console.log(`  - 数据导入: 支持CSV, JSON, G-code文件和文件夹`);
  console.log(`  - 问题检测: 温度不兼容、超时、维护过期、排队冲突等`);
  console.log(`  - 复核页面: 可改判问题状态和添加备注`);
  console.log(`  - 数据导出: Markdown夜班开机单和JSON审计包`);
  console.log(`========================================`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n正在关闭服务器...');
  process.exit(0);
});
