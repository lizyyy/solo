import express from 'express';
import reviewRoutes from './routes/reviewRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/review', reviewRoutes);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '模型评测复核API运行正常',
    timestamp: new Date()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.path,
    method: req.method,
    timestamp: new Date()
  });
});

app.listen(PORT, () => {
  console.log(`
=========================================
  模型评测复核API服务已启动
  端口: ${PORT}
  健康检查: http://localhost:${PORT}/health
  API根路径: http://localhost:${PORT}/api/v1/review
=========================================
  `);
});
