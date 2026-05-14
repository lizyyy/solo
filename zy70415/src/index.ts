import express from 'express';
import './database';
import archiveRoutes from './routes/archive';
import recordsRoutes from './routes/records';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use('/api/archive', archiveRoutes);
app.use('/api/records', recordsRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '审计日志归档服务运行正常',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  审计日志归档服务已启动`);
  console.log(`  端口: ${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/api/health`);
  console.log(`========================================\n`);
  console.log(`API 端点:`);
  console.log(`  POST /api/archive/candidates        - 生成归档候选清单（含保留期判断）`);
  console.log(`  POST /api/archive/execute/:id       - 执行归档`);
  console.log(`  POST /api/archive/export/:id        - 导出归档供复核`);
  console.log(`  POST /api/archive/rollback-candidates/:id - 生成回滚候选清单`);
  console.log(`  POST /api/archive/rollback-execute/:id   - 确认候选清单后执行回滚`);
  console.log(`  GET  /api/records                   - 查询值班记录`);
  console.log(`  POST /api/records/correct/:id       - 人工修正记录（保留系统判断）`);
  console.log(`  GET  /api/records/batches           - 查询归档批次`);
  console.log(`  GET  /api/records/batches/:id/details - 查询批次明细`);
  console.log(`  GET  /api/records/erase-requests    - 查询擦除申请`);
  console.log(`  GET  /api/records/audit/trace       - 复盘追踪（按执行时间）`);
  console.log(`  GET  /api/records/operation-logs    - 查询操作日志`);
  console.log(`\n安全特性:`);
  console.log(`  ✓ 归档候选: 只归档超过保留期的记录（默认30天）`);
  console.log(`  ✓ 回滚安全: 必须先生成回滚候选清单，确认后执行`);
  console.log(`  ✓ 人工修正: 禁止覆盖系统判断字段，仅添加复核标记`);
  console.log(`  ✓ 操作留痕: 所有操作均记录完整审计日志`);
  console.log(`\n`);
});