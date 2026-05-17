import express from 'express';
import checklistRoutes from './routes/checklist.routes';
import './database';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/checklists', checklistRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '医院预约接口检查单占号释放服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务已启动，监听端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API文档: http://localhost:${PORT}/api/checklists`);
});

export default app;
