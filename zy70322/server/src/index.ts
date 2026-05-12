import express from 'express';
import cors from 'cors';
import { initDatabase } from './db';
import { initSampleData } from './sampleData';
import router from './routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', router);

async function startServer() {
  try {
    await initDatabase();
    initSampleData();
    
    app.listen(PORT, () => {
      console.log(`Tenant Migration Checker server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
