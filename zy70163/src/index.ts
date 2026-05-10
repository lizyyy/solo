import express from 'express';
import fs from 'fs';
import { initDatabase } from './database/index';
import routes from './routes';

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());

if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data', { recursive: true });
}

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'object-storage-lifecycle-api',
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized successfully');
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`API base: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
