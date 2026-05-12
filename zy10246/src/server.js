import express from 'express';
import { initDB } from './config/database.js';
import voucherRoutes from './routes/vouchers.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use('/api/vouchers', voucherRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '机场贵宾厅券核销 API 运行正常' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

async function startServer() {
  try {
    await initDB();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log('健康检查: http://localhost:${PORT}/health');
      console.log('API 文档:');
      console.log('  POST /api/vouchers/issue - 发券');
      console.log('  POST /api/vouchers/bind - 绑定旅客');
      console.log('  POST /api/vouchers/redeem - 核销');
      console.log('  POST /api/vouchers/refund - 退券');
      console.log('  GET  /api/vouchers/quota/:corporateId - 额度查询');
      console.log('  POST /api/vouchers/reconcile/:sourceId - 对账');
      console.log('  GET  /api/vouchers/reconcile/:sourceId/details - 对账明细');
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

startServer();