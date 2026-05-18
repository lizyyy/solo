import express from 'express';
import cors from 'cors';
import appealRoutes from './routes/appealRoutes';
import { seedDatabase } from './scripts/seedData';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

seedDatabase();

app.use('/api/appeals', appealRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '社区篮球联赛犯规申诉API服务正常运行',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/', (req, res) => {
  res.json({
    name: '社区篮球联赛组联赛犯规申诉API',
    version: '1.0.0',
    description: '完整的篮球比赛犯规申诉管理系统，包含状态流转、跨引用检测、一致性评分等功能',
    endpoints: {
      health: 'GET /api/health',
      createAppeal: 'POST /api/appeals',
      submitAppeal: 'POST /api/appeals/submit',
      reviewAppeal: 'POST /api/appeals/review',
      supplementInfo: 'POST /api/appeals/supplement',
      getAppeal: 'GET /api/appeals/:id',
      listAppeals: 'GET /api/appeals',
      getStats: 'GET /api/appeals/stats/summary',
      exportCSV: 'GET /api/appeals/export/csv'
    },
    features: [
      '完整的申诉状态流转引擎',
      '同一犯规多球队引用自动检测',
      '申诉材料完整性一致性评分',
      '完整的操作审计日志记录',
      '失败响应带可操作建议',
      'CSV数据导出功能',
      '预置真实社区联赛样例数据'
    ],
    statuses: {
      draft: '草稿',
      submitted: '待审核',
      under_review: '审核中',
      needs_more_info: '需补充',
      approved: '已通过',
      rejected: '已驳回'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 社区篮球联赛组联赛犯规申诉API服务已启动`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`📊 API文档: http://localhost:${PORT}/`);
  console.log(`💡 健康检查: http://localhost:${PORT}/api/health`);
});

export default app;
