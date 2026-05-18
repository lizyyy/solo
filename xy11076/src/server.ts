import express from 'express';
import { initDatabase } from './database';
import { errorHandler } from './middleware/errorHandler';
import overdueRoutes from './routes/overdueRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/overdue', overdueRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '摄影器材租赁店相机租赁逾期API服务正常运行',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    name: '摄影器材租赁店相机租赁逾期API',
    version: '1.0.0',
    description: '完整的相机租赁逾期管理系统，支持部分归还处理和账单一致性检查',
    endpoints: {
      health_check: 'GET /api/health',
      get_overdue_bills: 'GET /api/overdue/bills',
      create_overdue_bill: 'POST /api/overdue/bills',
      return_equipment: 'POST /api/overdue/return',
      review_bill: 'POST /api/overdue/bills/:billId/review',
      check_partial_return: 'GET /api/overdue/orders/:orderId/partial-return',
      check_consistency: 'GET /api/overdue/orders/:orderId/consistency'
    },
    features: [
      '客户先还镜头后还机身的特殊场景处理',
      '逾期账单一致性自动检查',
      '详细的中文错误响应',
      '真实业务字段和种子数据',
      '人工审核流程支持'
    ]
  });
});

app.use(errorHandler);

const startServer = async () => {
  try {
    await initDatabase();
    console.log('数据库初始化完成');

    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  摄影器材租赁店相机租赁逾期API v1.0.0                          ║
║                                                               ║
║  服务器已启动: http://localhost:${PORT}                          ║
║                                                               ║
║  主要功能:                                                    ║
║    • 客户先还镜头后还机身的特殊场景处理                        ║
║    • 逾期账单一致性自动检查                                   ║
║    • 详细的中文错误响应                                       ║
║    • 真实业务字段和种子数据                                   ║
║    • 人工审核流程支持                                         ║
║                                                               ║
║  初始化数据: npm run seed                                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();
