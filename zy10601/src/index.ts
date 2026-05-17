import 'reflect-metadata';
import express from 'express';
import * as dotenv from 'dotenv';
import { AppDataSource } from './data-source';
import appealRoutes from './routes/appeal';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/appeals', appealRoutes);

async function bootstrap() {
  try {
    await AppDataSource.initialize();
    console.log('数据库连接成功');

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     SaaS账单中心套餐超额冻结申诉系统                        ║
║                                                            ║
║     服务已启动: http://localhost:${PORT}                        ║
║                                                            ║
║     API 接口:                                              ║
║       GET  /api/appeals              - 申诉列表（支持筛选）  ║
║       GET  /api/appeals/:id          - 申诉详情             ║
║       GET  /api/appeals/:id/histories - 申诉历史记录        ║
║       POST /api/appeals/:id/restore  - 提交恢复请求（防重）  ║
║       GET  /api/appeals/export/csv   - 导出CSV              ║
║       GET  /api/appeals/statistics/summary - 统计概览       ║
║                                                            ║
║     初始化数据: npm run seed                                ║
║     运行验收: npm run test                                  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

bootstrap();
