import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { initDatabase } from './database';
import validationRoutes from './routes/validation';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

initDatabase();

app.use('/api/validation', validationRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: '冻结窗口校验服务运行正常'
  });
});

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
============================================
  冻结窗口校验后端服务已启动
  服务地址: http://localhost:${PORT}
  
  API端点:
  - GET  /health                              - 健康检查
  - POST /api/validation/validate            - 单样本校验
  - GET  /api/validation/query/:businessNo   - 按业务单号查询
  - GET  /api/validation/query               - 查询所有样本
  - GET  /api/validation/failures            - 查询失败记录
  - GET  /api/validation/anomalies           - 查询异常样本
  - POST /api/validation/batch/preview       - 批量操作预览
  - POST /api/validation/batch/execute/:id   - 执行批量操作
  - GET  /api/validation/summary             - 获取摘要
  - GET  /api/validation/summary/report      - 获取摘要报告
  - GET  /api/validation/statistics/errors   - 获取错误统计
  - GET  /api/validation/window/check        - 检查当前冻结窗口
============================================
  `);
});
