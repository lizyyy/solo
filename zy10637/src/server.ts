import express from 'express';
import redApplyRoutes from './routes/redApplyRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api/red-apply', redApplyRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (_req, res) => {
  res.json({
    message: '电子发票服务红票申请材料核验API',
    version: '1.0.0',
    endpoints: {
      import: 'POST /api/red-apply/import - 批量导入',
      startVerify: 'POST /api/red-apply/:id/start-verify - 开始核验',
      approve: 'POST /api/red-apply/:id/approve - 核验通过完成红冲',
      reject: 'POST /api/red-apply/:id/reject - 驳回申请',
      forceVerify: 'POST /api/red-apply/:id/force-verify - 人工强制核验',
      list: 'GET /api/red-apply/list - 查询列表',
      detail: 'GET /api/red-apply/:id/detail - 查询详情',
      history: 'GET /api/red-apply/:id/history - 查询历史记录',
      statistics: 'GET /api/red-apply/statistics - 统计信息',
      export: 'POST /api/red-apply/export - 导出CSV'
    }
  });
});

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '接口不存在',
      type: 'BUSINESS_RULE_VIOLATION',
      suggestion: '请检查请求路径'
    }
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
}

export default app;
