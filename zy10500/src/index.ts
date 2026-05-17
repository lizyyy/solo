import express from 'express';
import routes from './routes';
import { requestLogger, errorHandler } from './middleware';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(requestLogger);
app.use('/api', routes);
app.use(errorHandler);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`变更单依赖冻结API服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log('');
  console.log('API接口列表:');
  console.log('  POST   /api/change-orders              - 创建变更单');
  console.log('  GET    /api/change-orders              - 查询所有变更单');
  console.log('  GET    /api/change-orders/:id          - 根据ID查询变更单');
  console.log('  GET    /api/change-orders/no/:no       - 根据单号查询变更单');
  console.log('  POST   /api/change-orders/:id/start-freeze   - 启动冻结流程');
  console.log('  POST   /api/change-orders/:id/dependencies/:depId/freeze  - 冻结单个依赖');
  console.log('  POST   /api/change-orders/:id/dependencies/:depId/confirm - 确认冻结回执');
  console.log('  POST   /api/change-orders/:id/dependencies/:depId/delay   - 延期依赖');
  console.log('  POST   /api/change-orders/:id/exception - 标记异常');
  console.log('  POST   /api/change-orders/:id/manual-correction - 人工修正');
  console.log('  GET    /api/change-orders/:id/export   - 导出变更单');
  console.log('  POST   /api/change-orders/:id/approve  - 审批变更单');
});
