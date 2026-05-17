import express from 'express';
import { articleController } from './controllers/articleController';
import { rollbackController } from './controllers/rollbackController';
import { initSampleData } from './data/sampleData';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '知识库回滚服务运行正常' });
});

app.post('/api/articles', articleController.createArticle);
app.get('/api/articles/:id', articleController.getArticle);
app.put('/api/articles/:id', articleController.updateArticle);
app.post('/api/articles/:id/publish', articleController.publishArticle);
app.get('/api/articles/:id/versions', articleController.getArticleVersions);

app.get('/api/rollbacks', rollbackController.getRollbackRecords);
app.get('/api/rollbacks/:id', rollbackController.getRollbackRecord);
app.get('/api/articles/:articleId/rollbacks', rollbackController.getRollbackHistory);
app.post('/api/rollbacks', rollbackController.requestRollback);
app.put('/api/rollbacks/:id/status', rollbackController.updateRollbackStatus);
app.get('/api/rollbacks/export/csv', rollbackController.exportToCSV);

initSampleData();

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('API 文档:');
  console.log('  GET  /health - 健康检查');
  console.log('  POST /api/articles - 创建文章');
  console.log('  GET  /api/articles/:id - 获取文章详情');
  console.log('  PUT  /api/articles/:id - 更新文章');
  console.log('  POST /api/articles/:id/publish - 发布文章');
  console.log('  GET  /api/articles/:id/versions - 获取文章版本历史');
  console.log('  GET  /api/rollbacks - 查询回滚记录列表');
  console.log('  GET  /api/rollbacks/:id - 获取回滚记录详情');
  console.log('  GET  /api/articles/:articleId/rollbacks - 获取文章回滚历史');
  console.log('  POST /api/rollbacks - 请求回滚');
  console.log('  PUT  /api/rollbacks/:id/status - 更新回滚状态');
  console.log('  GET  /api/rollbacks/export/csv - 导出回滚记录CSV');
});
