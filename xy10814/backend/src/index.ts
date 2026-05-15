import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import { AppDataSource } from './config/database';
import contractsRouter from './routes/contracts';
import scenesRouter from './routes/scenes';
import exceptionsRouter from './routes/exceptions';
import historyRouter from './routes/history';
import replayRouter from './routes/replay';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/contracts', contractsRouter);
app.use('/api/scenes', scenesRouter);
app.use('/api/exceptions', exceptionsRouter);
app.use('/api/history', historyRouter);
app.use('/api/replay', replayRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

AppDataSource.initialize()
  .then(() => {
    console.log('Database connected successfully');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`API Base: http://localhost:${PORT}/api`);
      console.log(`Replay Endpoint: http://localhost:${PORT}/api/replay/*`);
    });
  })
  .catch((error) => {
    console.error('Database connection failed:', error);
    process.exit(1);
  });
