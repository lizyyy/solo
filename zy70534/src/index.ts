import express from 'express';
import { QuotaService } from './service';
import { createRouter } from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const service = new QuotaService();
app.use('/api', createRouter(service));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Quota API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API base: http://localhost:${PORT}/api`);
});

export default app;
