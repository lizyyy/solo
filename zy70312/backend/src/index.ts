import express from 'express';
import cors from 'cors';
import { initDatabase } from './db/index.js';
import dashboardRoutes from './routes/dashboard.js';
import { generateSampleData } from './services/sampleData.js';

initDatabase();
generateSampleData();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api', dashboardRoutes);

app.listen(PORT, () => {
  console.log(`API错误预算看板后端运行在 http://localhost:${PORT}`);
});
