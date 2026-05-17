import express from 'express';
import { initDatabase } from './database/schema';
import { RecycleRepository } from './database/repository';
import { RecycleService } from './services/recycle.service';
import { createRecycleRouter } from './routes/recycle.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

async function bootstrap() {
  const db = await initDatabase();
  const repository = new RecycleRepository(db);
  const service = new RecycleService(repository);
  
  try {
    await service.createSeedData();
    console.log('Seed data created successfully');
  } catch (e) {
    console.log('Seed data may already exist');
  }

  const recycleRouter = createRecycleRouter(service);
  app.use('/api/recycle', recycleRouter);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'trial-recycle-api' });
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API base: http://localhost:${PORT}/api/recycle`);
  });
}

bootstrap().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
