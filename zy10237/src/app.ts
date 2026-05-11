import express from 'express';
import prescriptionRoutes from './routes/prescriptionRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/prescription', prescriptionRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: '处方流转服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           线上问诊处方流转 API 服务已启动                     ║
╠════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                             ║
║  健康检查: http://localhost:${PORT}/health                      ║
║  API 前缀: http://localhost:${PORT}/api/prescription            ║
╠════════════════════════════════════════════════════════════╣
║  接口列表:                                                   ║
║    POST /consultation      - 问诊建单                        ║
║    POST /prescription      - 医生开方                        ║
║    POST /pharmacist-review - 药师审核                        ║
║    POST /payment           - 支付确认                        ║
║    POST /ship              - 出库配送                        ║
║    POST /cancel            - 驳回撤销                        ║
║    GET  /consultation/:id  - 查询问诊详情                    ║
║    GET  /summary           - 状态汇总                        ║
║    GET  /logs              - 状态变更日志                    ║
╚════════════════════════════════════════════════════════════╝
  `);
});
