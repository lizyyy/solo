import express from 'express';
import cors from 'cors';
import { initDatabase } from './database.js';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import activitiesRouter from './routes/activities.js';
import devicesRouter from './routes/devices.js';
import risksRouter from './routes/risks.js';
import importRouter from './routes/import.js';
import exportRouter from './routes/export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = join(__dirname, '../../data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

initDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/activities', activitiesRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/risks', risksRouter);
app.use('/api/import', importRouter);
app.use('/api/export', exportRouter);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Astronomy Observing Night Precheck API Server`);
  console.log(`📍 Server running on http://localhost:${PORT}`);
  console.log(`📊 Data directory: ${dataDir}`);
  console.log(`✅ Ready to accept requests`);
});
