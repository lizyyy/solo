import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import correctionRoutes from './routes/correction';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'asset-tag-correction-api'
  });
});

app.use('/api/corrections', correctionRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    path: req.path
  });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`
=========================================
  资产标签纠错 API 服务已启动
  服务地址: http://localhost:${PORT}
  健康检查: http://localhost:${PORT}/health
  API 文档: /api/corrections
=========================================
  `);
});
