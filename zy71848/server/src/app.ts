import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import inspectionsRouter from './routes/inspections';
import batchRouter from './routes/batch';
import exportRouter from './routes/export';
import settingsRouter from './routes/settings';

const app: Express = express();

app.use(cors());
app.use(express.json());

app.get('/api/hello', (req: Request, res: Response) => {
  res.json({ message: 'Hello from Express + TypeScript!' });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/inspections', inspectionsRouter);
app.use('/api/batch', batchRouter);
app.use('/api/export', exportRouter);
app.use('/api/settings', settingsRouter);

export default app;
