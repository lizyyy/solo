import express from 'express';
import certificateRoutes from './routes/certificates';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/certificates', certificateRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`CDN证书续期校验API服务已启动: http://localhost:${PORT}`);
  console.log('API端点:');
  console.log('  POST /api/certificates          - 创建证书记录');
  console.log('  GET  /api/certificates          - 证书列表');
  console.log('  GET  /api/certificates/:id      - 证书详情');
  console.log('  PATCH /api/certificates/:id     - 更新证书');
  console.log('  GET  /api/certificates/:id/history - 操作历史');
  console.log('  POST /api/certificates/import   - 批量导入');
  console.log('  GET  /api/certificates/export/csv - 导出CSV');
});
