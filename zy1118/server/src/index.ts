import express from 'express';
import cors from 'cors';
import { initDatabase } from './database';
import plansRouter from './routes/plans';
import importRouter from './routes/import';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Exhibition Planner API is running',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/plans', plansRouter);
app.use('/api/import', importRouter);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`Starting Exhibition Planner Server...`);
  console.log(`Initializing database...`);
  initDatabase();
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/plans`);
  console.log(`  POST /api/plans`);
  console.log(`  GET  /api/plans/:id`);
  console.log(`  PUT  /api/plans/:id`);
  console.log(`  DELETE /api/plans/:id`);
  console.log(`  GET  /api/plans/:id/validate`);
  console.log(`  GET  /api/plans/:id/report?format=json|markdown|html`);
  console.log(`  GET  /api/plans/compare/:planAId/:planBId`);
  console.log(`  POST /api/import/hall`);
  console.log(`  POST /api/import/booths`);
  console.log(`  POST /api/import/flow`);
  console.log(`  POST /api/import/power-zones`);
});
