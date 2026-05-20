import express from 'express';
import boothRoutes from './routes/boothRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/booth', boothRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║          快闪摊位证照审核系统 API 服务已启动                  ║
╠═══════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                           ║
║                                                           ║
║  API 接口:                                                ║
║    POST   /api/booth/upload          - 上传摊位申请CSV   ║
║    GET    /api/booth/reports         - 获取报告列表        ║
║    GET    /api/booth/reports/:id     - 获取单个报告        ║
║    GET    /api/booth/trace/:id        - 追踪验证结果      ║
║    GET    /api/booth/applications/:id/trace - 申请追踪    ║
║    GET    /api/booth/calendar         - 场​​地日历          ║
║    GET    /api/booth/submissions      - 提交记录          ║
║    GET    /health                    - 健康检查            ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
