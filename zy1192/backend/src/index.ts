import express from 'express';
import cors from 'cors';
import simulatorRoutes from './routes/simulator';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', simulatorRoutes);

app.get('/', (_req, res) => {
  res.json({
    name: '并发原语可视化实验台 - 后端服务',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      examples: 'GET /api/examples',
      simulate: 'POST /api/simulate',
      abaDemo: 'POST /api/simulate/aba-demo',
      exportMarkdown: 'POST /api/export/markdown',
      exportJson: 'POST /api/export/json',
    },
  });
});

app.listen(PORT, () => {
  console.log(`🚀 并发原语可视化实验台后端服务`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`🔗 API 文档: http://localhost:${PORT}/`);
});
