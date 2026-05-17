import express from 'express';
import { initDatabase, initializeSchema } from './database';
import exportRoutes from './routes/export.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Audit Log Proof API', 
    version: '1.0.0',
    endpoints: {
      create: 'POST /api/export',
      list: 'GET /api/export',
      get: 'GET /api/export/:id',
      approve: 'POST /api/export/:id/approve',
      reject: 'POST /api/export/:id/reject',
      verify: 'POST /api/export/:id/verify',
      report: 'POST /api/export/:id/report',
      export: 'GET /api/export/:id/export',
      history: 'GET /api/export/:id/history'
    }
  });
});

app.use('/api/export', exportRoutes);

async function startServer() {
  try {
    console.log('Initializing database...');
    const db = await initDatabase();
    await initializeSchema(db);
    console.log('Database initialized');
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`API Base: http://localhost:${PORT}/api/export`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export default app;
