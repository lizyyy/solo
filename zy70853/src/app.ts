import express from 'express';
import { Request, Response } from 'express';
import { upload } from './middleware/upload';
import { matchController } from './controllers/matchController';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req: Request, res: Response) => {
  res.json({
    message: '公交客服中心 - 失物匹配系统 API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      upload: 'POST /api/match/upload',
      history: 'GET /api/batch/history'
    }
  });
});

app.get('/health', matchController.healthCheck);

app.post('/api/match/upload', upload.array('files', 10), matchController.uploadAndMatch);

app.get('/api/batch/history', matchController.getBatchHistory);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || '文件上传失败'
    });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`失物匹配系统已启动: http://localhost:${PORT}`);
  console.log('');
  console.log('API 端点:');
  console.log(`  GET  http://localhost:${PORT}/health          - 健康检查`);
  console.log(`  POST http://localhost:${PORT}/api/match/upload - 上传文件并匹配`);
  console.log(`  GET  http://localhost:${PORT}/api/batch/history - 获取批次历史`);
  console.log('');
});

export default app;
