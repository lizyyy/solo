import express from 'express';
import cors from 'cors';
import './database';

import slotsRouter from './routes/slots';
import locksRouter from './routes/locks';
import vouchersRouter from './routes/vouchers';
import conflictsRouter from './routes/conflicts';
import systemsRouter from './routes/systems';
import exportRouter from './routes/export';
import importRouter from './routes/import';
import logsRouter from './routes/logs';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/slots', slotsRouter);
app.use('/api/locks', locksRouter);
app.use('/api/vouchers', vouchersRouter);
app.use('/api/conflicts', conflictsRouter);
app.use('/api/systems', systemsRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);
app.use('/api/logs', logsRouter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '预约号源整合 API 运行正常', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API 文档: http://localhost:${PORT}/api/health`);
});

export default app;
