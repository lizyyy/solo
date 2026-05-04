import express from 'express';
import cors from 'cors';
import { indexRouter } from './routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({
    name: 'Database Index Experiment Platform API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      createExperiment: 'POST /api/experiment/create',
      runExperiment: 'POST /api/experiment/:id/run',
      runQuery: 'POST /api/experiment/:id/run-query',
      getBPlusVisualization: 'GET /api/experiment/:id/visualization/bplus',
      getHashVisualization: 'GET /api/experiment/:id/visualization/hash',
      getStats: 'GET /api/experiment/:id/stats',
      deleteExperiment: 'DELETE /api/experiment/:id',
      getDefaultTemplate: 'GET /api/templates/default',
    },
  });
});

app.use('/api', indexRouter);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Database Index Experiment Platform Backend`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`📚 API docs available at http://localhost:${PORT}\n`);
});
