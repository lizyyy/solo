import express from 'express';
import cors from 'cors';
import quoteRoutes from './routes/quoteRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

import('./scripts/seed');

app.use('/health', (req, res) => {
  res.json({
    success: true,
    message: '维修服务站上门维修报价API运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/quotes', quoteRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: '请求的接口不存在',
      suggestedAction: '请检查API路径是否正确'
    }
  });
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('  维修服务站上门维修报价 API');
  console.log('========================================');
  console.log(`服务已启动，监听端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API基础路径: http://localhost:${PORT}/api/quotes`);
  console.log('========================================');
  console.log('');
  console.log('主要接口:');
  console.log('  GET    /api/quotes              - 获取所有报价列表');
  console.log('  GET    /api/quotes/:id          - 根据ID获取报价详情');
  console.log('  GET    /api/quotes/number/:number - 根据单号获取报价详情');
  console.log('  POST   /api/quotes              - 创建报价');
  console.log('  POST   /api/quotes/:id/submit   - 提交报价审批');
  console.log('  POST   /api/quotes/:id/accept   - 客户接受报价');
  console.log('  POST   /api/quotes/:id/add-hidden-fault - 追加隐藏故障');
  console.log('  POST   /api/quotes/:id/review-supplement/:recordId - 审核追加报价');
  console.log('  POST   /api/quotes/:id/complete - 完成维修');
  console.log('  GET    /api/quotes/:id/change-records - 获取报价变更记录');
  console.log('');
  console.log('种子数据已加载，包含4条报价记录:');
  console.log('  - COMPLETED (已完成)');
  console.log('  - PENDING_SUPPLEMENT (补录待确认)');
  console.log('  - REJECTED (驳回)');
  console.log('  - CUSTOMER_ACCEPTED (客户已接受)');
  console.log('');
  console.log('========================================');
});
