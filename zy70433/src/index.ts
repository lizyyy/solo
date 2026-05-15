import express from 'express';
import quotaRoutes from './routes/quotaRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/quota', quotaRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: '配额发放服务',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║       🚀 配额发放服务已启动!                               ║
║                                                           ║
║       服务地址: http://localhost:${PORT}                       ║
║       健康检查: http://localhost:${PORT}/api/health            ║
║                                                           ║
║       API 端点:                                           ║
║         POST /api/quota/allocate      - 配额发放          ║
║         GET  /api/quota/records       - 统一查询入口      ║
║         GET  /api/quota/whitelist/review - 白名单复核    ║
║         POST /api/quota/report/generate - 生成报告        ║
║         POST /api/quota/payment/receipt - 上传支付回执    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
