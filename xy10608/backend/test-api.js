
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const { initDatabase } = require('./src/database');
const { seedData } = require('./src/seedData');

// 导入路由
const menuRecipesRouter = require('./src/routes/menuRecipes');
const ingredientBatchesRouter = require('./src/routes/ingredientBatches');
const substitutionsRouter = require('./src/routes/substitutions');
const allergenRestrictionsRouter = require('./src/routes/allergenRestrictions');
const returnAcceptancesRouter = require('./src/routes/returnAcceptances');
const storeCostsRouter = require('./src/routes/storeCosts');
const operationsRouter = require('./src/routes/operations');

const app = express();
const PORT = 3000;

// 确保 data 目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 初始化数据库
initDatabase();

// 初始化样例数据
const { db } = require('./src/database');
seedData(db);

// 中间件
app.use(cors());
app.use(bodyParser.json());

// 日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 路由
app.use('/api/menu-recipes', menuRecipesRouter);
app.use('/api/ingredient-batches', ingredientBatchesRouter);
app.use('/api/substitutions', substitutionsRouter);
app.use('/api/allergen-restrictions', allergenRestrictionsRouter);
app.use('/api/return-acceptances', returnAcceptancesRouter);
app.use('/api/store-costs', storeCostsRouter);
app.use('/api/operations', operationsRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
const server = app.listen(PORT, () => {
  console.log(`中央厨房系统后端服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
});

// 防止进程退出
process.on('SIGINT', () => {
  console.log('正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号');
  server.close(() => {
    process.exit(0);
  });
});
