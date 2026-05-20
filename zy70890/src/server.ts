import express from 'express';
import cors from 'cors';
import reconciliationRoutes from './routes/reconciliation';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '司法社工对账服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/reconciliation', reconciliationRoutes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     司法社工对账服务已启动                                 ║
║                                                            ║
║     服务地址: http://localhost:${PORT}                     ║
║                                                            ║
║     API端点:                                               ║
║       GET  /health                                        ║
║                                                            ║
║       POST /api/reconciliation/import/sample-data         ║
║       POST /api/reconciliation/reconcile                  ║
║       GET  /api/reconciliation/records/:id                ║
║       GET  /api/reconciliation/records/:id/summary        ║
║       GET  /api/reconciliation/records/:id/with-differences ║
║       POST /api/reconciliation/review                     ║
║       POST /api/reconciliation/correct                    ║
║       POST /api/reconciliation/recalculate/:id            ║
║       GET  /api/reconciliation/export/excel/:id           ║
║       GET  /api/reconciliation/export/csv/:id             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
