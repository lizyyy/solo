import express from 'express';
import { initDatabase } from './database/init';
import warmupRoutes from './routes/warmupRoutes';
import { HealthCheck } from './utils/healthCheck';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/v1/warmup', warmupRoutes);

app.get('/health', async (req, res) => {
  const healthStatus = await HealthCheck.performCheck();
  const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

app.get('/', (req, res) => {
  res.json({
    name: 'Cache Warmup Orchestration API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      batches: '/api/v1/warmup/batches',
      nodes: '/api/v1/warmup/nodes',
      dataSources: '/api/v1/warmup/data-sources'
    }
  });
});

const startServer = async () => {
  try {
    await initDatabase();
    console.log('Database initialized successfully');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`API base: http://localhost:${PORT}/api/v1/warmup`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
