const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 根路由 - 健康检查
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '餐饮预制菜追溯 API 服务运行中',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      stores: '/stores - 门店管理',
      batches: '/batches - 批次管理',
      outbound: '/outbound - 出库',
      cold_chain: '/cold-chain - 冷链运输',
      receive: '/receive - 门店接收',
      thaw: '/thaw - 解冻',
      sales: '/sales - 销售',
      recalls: '/recalls - 召回',
      damages: '/damages - 报损',
      inventory: '/inventory - 库存查询',
      reports: '/reports - 报告导出'
    }
  });
});

// API 路由
app.use('/api', routes);

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 初始化数据库后启动服务
const startServer = async () => {
  try {
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`餐饮预制菜追溯 API 服务已启动`);
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log(`API 基础路径: http://localhost:${PORT}/api`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
