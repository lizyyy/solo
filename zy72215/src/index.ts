import express from 'express';
import routes from './api/routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/performance-attribution', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: '交易员绩效归因报表-风控系统' });
});

app.listen(PORT, () => {
  console.log(`
=============================================
  交易员绩效归因报表 - 风控系统
  服务已启动: http://localhost:${PORT}
=============================================

  健康检查: GET /health
  
  API 端点:
  - POST /api/performance-attribution/import - 导入交易记录
  - GET  /api/performance-attribution/report/:date - 获取完整报表
  - GET  /api/performance-attribution/page/:date - 获取页面展示数据
  - GET  /api/performance-attribution/export/:date - 获取导出数据
  - GET  /api/performance-attribution/record/:id - 获取单条记录详情
  - GET  /api/performance-attribution/record/:id/audit - 获取审计日志
  - POST /api/performance-attribution/record/:id/submit-review - 提交风控复核
  - POST /api/performance-attribution/record/:id/review-normal - 复核通过-正常
  - POST /api/performance-attribution/record/:id/review-adjust - 复核通过-调整
  - POST /api/performance-attribution/record/:id/summarize - 纳入摘要
  - POST /api/performance-attribution/record/:id/rollback - 回滚状态
  - GET  /api/performance-attribution/summary/manager/:date - 负责人摘要
  - GET  /api/performance-attribution/zero-reversal/:date? - 金额为0待冲正记录
  - GET  /api/performance-attribution/pending-review/:date? - 待复核记录
  `);
});

export default app;
