import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

import trainingRoutes from './routes/training.js';
import importRoutes from './routes/import.js';
import reviewRoutes from './routes/review.js';
import exportRoutes from './routes/export.js';

app.use('/api/training', trainingRoutes);
app.use('/api/import', importRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

import { initDB } from './database.js';
initDB();

app.listen(PORT, () => {
  console.log(`消防训练复盘工具后端运行在 http://localhost:${PORT}`);
});
