import express, { Express, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openapiSpec } from './openapi';
import {
  filmVersionsRouter,
  auditoriumsRouter,
  kdmsRouter,
  schedulesRouter,
  importExportRouter,
  auditRouter,
} from './routes';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { getDatabasePath } from './storage';

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Powered-By', 'Cinema Guardian');
  next();
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: '影厅密钥排片卫士',
  });
});

app.use('/api/v1/film-versions', filmVersionsRouter);
app.use('/api/v1/auditoriums', auditoriumsRouter);
app.use('/api/v1/kdms', kdmsRouter);
app.use('/api/v1/schedules', schedulesRouter);
app.use('/api/v1/import-export', importExportRouter);
app.use('/api/v1/audit-logs', auditRouter);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.get('/api-docs.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(openapiSpec);
});

app.use((err: Error, req: Request, res: Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

function ensureDataDirectory(): void {
  const dbPath = getDatabasePath();
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }
}

if (require.main === module) {
  ensureDataDirectory();
  
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎬 影厅密钥排片卫士已启动                                ║
║                                                           ║
║   服务地址: http://localhost:${PORT}                      ║
║   API 文档: http://localhost:${PORT}/api-docs             ║
║   健康检查: http://localhost:${PORT}/api/health           ║
║                                                           ║
║   数据库: ${getDatabasePath()}                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

export { app };
