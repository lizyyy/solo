import express, { Request, Response } from 'express';
import employeesRouter from './routes/employees';
import batchesRouter from './routes/batches';
import couponsRouter from './routes/coupons';
import collectionRouter from './routes/collection';
import exportRouter from './routes/export';
import auditRouter from './routes/audit';
import prisma from './utils/prisma';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req: Request, res: Response) => {
  res.json({
    name: '工会福利领用追踪系统',
    version: '1.0.0',
    endpoints: {
      employees: '/api/employees',
      batches: '/api/batches',
      coupons: '/api/coupons',
      collection: '/api/collection',
      export: '/api/export',
      audit: '/api/audit',
    },
  });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/employees', employeesRouter);
app.use('/api/batches', batchesRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/collection', collectionRouter);
app.use('/api/export', exportRouter);
app.use('/api/audit', auditRouter);

app.use((err: any, req: Request, res: Response, next: any) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

app.listen(PORT, async () => {
  console.log(`工会福利领用追踪系统已启动: http://localhost:${PORT}`);
  console.log(`API 文档:`);
  console.log(`  GET  /api/health - 健康检查`);
  console.log(`  POST /api/employees/import - 导入员工数据`);
  console.log(`  GET  /api/employees - 查询员工列表`);
  console.log(`  POST /api/batches - 新增福利批次`);
  console.log(`  GET  /api/batches - 查询批次列表`);
  console.log(`  POST /api/coupons/import - 导入券码`);
  console.log(`  POST /api/coupons/generate - 批量生成券码`);
  console.log(`  POST /api/collection/import/csv - 导入领用CSV`);
  console.log(`  GET  /api/collection - 查询领用记录（支持多维度筛选）`);
  console.log(`  POST /api/collection/:id/approve - 批准领用`);
  console.log(`  POST /api/collection/:id/reject - 拒绝领用`);
  console.log(`  POST /api/collection/:id/return - 退回修改`);
  console.log(`  GET  /api/collection/:id/trace - 追踪记录流转历史`);
  console.log(`  GET  /api/export/collection - 导出领用明细`);
  console.log(`  GET  /api/audit - 查询审计日志`);

  try {
    await prisma.$connect();
    console.log('数据库连接成功');
  } catch (error) {
    console.error('数据库连接失败:', error);
  }
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
