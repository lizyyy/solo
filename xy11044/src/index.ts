import express from 'express';
import inspectionRoutes from './routes/inspectionRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/inspection', inspectionRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '水产批发档口海鲜到货验收API运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

export default app;
