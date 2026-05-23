import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logInfo } from './services/logger';
import submissionRoutes from './routes/submission';
import queueRoutes from './routes/queue';
import deadLetterRoutes from './routes/deadLetter';
import historyRoutes from './routes/history';
import compensationRoutes from './routes/compensation';
import exportRoutes from './routes/export';
import auditRoutes from './routes/audit';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});

app.use('/api/submission', submissionRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/dead-letter', deadLetterRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/compensation', compensationRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/audit', auditRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
    },
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  logInfo(`Server started on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
  });
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation:`);
  console.log(`   POST /api/submission/submit - Submit records`);
  console.log(`   GET  /api/queue/statistics - Queue statistics`);
  console.log(`   GET  /api/audit/all - Run all audit checks`);
  console.log(`   GET  /api/export/retriable-classification - Retry classification`);
});

export default app;
