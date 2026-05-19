import express from 'express';
import { initDatabase } from './database';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'cross-border-tax-declaration-api'
  });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log('API 端点:');
      console.log('  POST /api/submit    - 提交申报材料');
      console.log('  GET  /api/query     - 查询申报记录');
      console.log('  GET  /api/statistics - 获取统计数据');
      console.log('  PUT  /api/process/:id - 处理申报(审核通过/退单)');
      console.log('  GET  /api/export    - 导出申报数据');
      console.log('  GET  /health        - 健康检查');
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();
