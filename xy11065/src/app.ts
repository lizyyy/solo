import express from 'express';
import visitorRoutes from './routes/visitorRoutes';
import { initSampleData } from './data/sampleData';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/visitors', visitorRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: '共享工位前台工位访客放行 API 运行正常' });
});

app.post('/api/init-sample', (_req, res) => {
  const visitors = initSampleData();
  res.json({ 
    message: '样例数据初始化成功', 
    count: visitors.length,
    visitors: visitors.map(v => ({ id: v.id, name: v.visitorName, status: v.status }))
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

export default app;
