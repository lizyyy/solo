import express from 'express';
import cors from 'cors';
import { initDatabase } from './database';
import billsRouter from './routes/bills';
import groupsRouter from './routes/groups';
import reportsRouter from './routes/reports';
import eventsRouter from './routes/events';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

async function main() {
  const app = express();

  initDatabase();

  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  }));

  app.use(express.json({ limit: '10mb' }));

  app.use((req, res, next) => {
    if (!req.headers['x-correlation-id']) {
      req.headers['x-correlation-id'] = `corr-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }
    next();
  });

  app.use('/api/bills', billsRouter);
  app.use('/api/groups', groupsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/events', eventsRouter);

  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: Date.now(),
      correlationId: req.headers['x-correlation-id'],
    });
  });

  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      correlationId: req.headers['x-correlation-id'],
    });
  });

  app.listen(PORT, () => {
    console.log(`Bill Split System server running on port ${PORT}`);
    console.log(`API endpoints:
  - GET  /api/health
  - POST /api/bills
  - PUT  /api/bills/:id
  - GET  /api/bills/group/:groupId
  - GET  /api/bills/:id
  - GET  /api/bills/group/:groupId/balances
  - POST /api/groups
  - PUT  /api/groups/:id
  - GET  /api/groups/user/:userId
  - GET  /api/groups/:id
  - POST /api/reports/export
  - GET  /api/events/aggregate/:id
  - GET  /api/events/user/:userId
  - POST /api/events/sync
  - GET  /api/events/sync/state
  - POST /api/events/replay/:aggregateId
  - GET  /api/events/conflicts
  - POST /api/events/conflicts/:id/resolve`);
  });
}

main().catch(console.error);
