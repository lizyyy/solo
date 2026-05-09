const express = require('express');
const { initDatabase } = require('./database/schema');
const fishGroupRoutes = require('./routes/fishGroupRoutes');
const tankRoutes = require('./routes/tankRoutes');
const isolationRuleRoutes = require('./routes/isolationRuleRoutes');
const isolationRoutes = require('./routes/isolationRoutes');
const summaryRoutes = require('./routes/summaryRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/fish-groups', fishGroupRoutes);
app.use('/api/tanks', tankRoutes);
app.use('/api/isolation-rules', isolationRuleRoutes);
app.use('/api/isolation', isolationRoutes);
app.use('/api/summary', summaryRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    service: 'aquarium-isolation-api',
    version: '1.0.0',
    status: 'running'
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '水族馆鱼病隔离调度 API',
    endpoints: {
      'POST /api/fish-groups': '鱼群档案管理',
      'POST /api/tanks': '缸体管理',
      'POST /api/isolation-rules': '隔离规则管理',
      'POST /api/isolation/request': '创建隔离请求',
      'POST /api/isolation/:sessionId/advance': '推进隔离',
      'POST /api/isolation/:sessionId/withdraw': '撤回隔离',
      'POST /api/isolation/:sessionId/complete': '完成隔离',
      'GET /api/summary/dashboard': '汇总仪表盘',
      'GET /api/health': '健康检查'
    }
  });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  水族馆鱼病隔离调度 API`);
      console.log(`  服务已启动: http://localhost:${PORT}`);
      console.log(`  健康检查: http://localhost:${PORT}/api/health`);
      console.log(`========================================\n`);
    });
  } catch (err) {
    console.error('服务器启动失败:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
