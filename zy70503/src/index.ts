import express from 'express';
import leaseRoutes from './routes/leaseRoutes';
import { leaseService } from './services/leaseService';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', leaseRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'permission-lease-api'
  });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: '服务器内部错误'
  });
});

let expirationCheckInterval: NodeJS.Timeout;

function startExpirationCheck() {
  expirationCheckInterval = setInterval(async () => {
    console.log(`[${new Date().toISOString()}] Checking for expired leases...`);
    try {
      const result = await leaseService.handleExpiredLeases();
      if (result.processedCount && result.processedCount > 0) {
        console.log(`[${new Date().toISOString()}] Processed ${result.processedCount} expired leases`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error checking expired leases:`, error);
    }
  }, 5 * 60 * 1000);
}

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║       权限租约 API 服务已启动                                 ║
║       Permission Lease API Service Started                   ║
║                                                              ║
║       服务地址: http://localhost:${PORT}                      ║
║       健康检查: http://localhost:${PORT}/health               ║
║                                                              ║
║       API 接口前缀: /api                                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
  
  startExpirationCheck();
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  clearInterval(expirationCheckInterval);
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  clearInterval(expirationCheckInterval);
  process.exit(0);
});

export default app;
