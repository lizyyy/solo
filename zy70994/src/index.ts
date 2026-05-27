import * as express from 'express';
import * as bodyParser from 'body-parser';
import reconciliationRoutes from './routes/reconciliationRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.use('/api/reconciliation', reconciliationRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`
  ==============================================
    学校后勤对账服务已启动
    服务地址: http://localhost:${PORT}
    健康检查: http://localhost:${PORT}/health
    API文档:
      - POST /api/reconciliation/batches - 创建对账批次
      - POST /api/reconciliation/import/subsidy - 导入补贴名单(JSON)
      - POST /api/reconciliation/import/swipe - 导入刷卡记录(CSV)
      - POST /api/reconciliation/import/refund - 导入退款表(CSV)
      - POST /api/reconciliation/batches/:id/process - 开始自动对账
      - GET /api/reconciliation/batches/:id/summary - 获取汇总
      - POST /api/reconciliation/details/:id/review - 人工复核
      - GET /api/reconciliation/batches/:id/report/xlsx - 下载Excel报告
  ==============================================
  `);
});

export default app;
