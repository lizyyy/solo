import express from 'express';
import cancelRequestRoutes from './routes/cancelRequest';
import { CancelRequestStatus, RetainResultPolicy, TaskExecutionStatus } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'async-job-cancel-api'
  });
});

app.get('/api/constants', (req, res) => {
  res.json({
    cancelRequestStatus: CancelRequestStatus,
    taskExecutionStatus: TaskExecutionStatus,
    retainResultPolicy: RetainResultPolicy
  });
});

app.use('/api/cancel-requests', cancelRequestRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

app.use((err: Error, req: express.Request, res: express.Response) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║        Async Job Cancel API                                  ║
║        异步作业撤销API - 内部使用                            ║
║                                                              ║
║        Server running on http://localhost:${PORT}             ║
║                                                              ║
║        Health Check:  GET  /health                           ║
║        Constants:     GET  /api/constants                    ║
║        API Base:      /api/cancel-requests                   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
