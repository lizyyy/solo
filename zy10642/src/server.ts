import express from 'express';
import reviewRoutes from './routes/reviewRoutes';
import { initSampleData } from './data/sampleData';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

initSampleData();

app.use('/api/reviews', reviewRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '客服质检系统抽检结果复议 API 运行正常' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
}

export default app;
