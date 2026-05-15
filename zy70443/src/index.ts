import express from 'express';
import { initDatabase } from './database';
import { insertDemoData } from './data/demoData';
import auditRoutes from './routes/auditRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function startServer() {
  try {
    await initDatabase();
    await insertDemoData();

    app.use('/api', auditRoutes);

    app.get('/health', (req, res) => {
      res.json({
        success: true,
        code: 200,
        message: '白盒审计服务运行正常',
        data: {
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        },
      });
    });

    app.listen(PORT, () => {
      console.log(`
========================================
白盒审计服务已启动
========================================
服务地址: http://localhost:${PORT}
健康检查: http://localhost:${PORT}/health

API 接口:
POST /api/audit/execute          - 执行审计
GET  /api/audit/batches          - 获取审计批次列表
GET  /api/audit/batches/:id      - 获取指定批次详情
GET  /api/audit/batches/:id/anomalies  - 获取异常记录
POST /api/audit/batches/:id/export-anomalies  - 导出异常记录
POST /api/audit/batches/:id/export-report    - 导出完整报告
========================================
      `);
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
}

startServer();
