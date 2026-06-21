import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import recordsRoutes from './routes/records.js';
import { initRepository, recordRepository } from './services/repository.js';
import { ensureSeed } from './services/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

initRepository();
{
  const { seeded, demoId } = ensureSeed();
  if (seeded) {
    console.log(
      `[seed] 仓储为空，已注入示例记录 PRJ-DEMO (record_id=${demoId})`,
    );
  } else {
    console.log(
      `[seed] 仓储已存在记录 ${recordRepository.count()} 条，跳过注入；示例 ID=${demoId}`,
    );
  }
}

const app: express.Application = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/records', recordsRoutes);

app.get(
  '/api/health',
  (req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
      timestamp: new Date().toISOString(),
      stats: {
        records: recordRepository.count(),
        initialized: recordRepository.initialized,
      },
    });
  },
);

app.get('/', (req: Request, res: Response): void => {
  res.status(200).json({
    service: '结构加固方案比选 - 后端 API',
    version: '1.0.0',
    docs: {
      health: 'GET /api/health',
      list: 'GET /api/records',
      detail: 'GET /api/records/:id',
      create: 'POST /api/records',
      update_viewpoint: 'PUT /api/records/:id/viewpoint',
      add_material: 'POST /api/records/:id/materials',
      add_remark: 'POST /api/records/:id/materials/:itemId/remarks',
      update_screenshot:
        'POST /api/records/:id/materials/:itemId/collisions/:colId/screenshot',
      resolve_pending: 'POST /api/records/:id/pending/:pendingId/resolve',
      revise: 'POST /api/records/:id/revise',
      export: 'GET /api/records/:id/export',
      audit: 'GET /api/records/:id/audit',
    },
  });
});

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[express] 未处理异常:', error);
  res.status(500).json({
    success: false,
    error: 'Server internal error',
    message: error.message,
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
    path: req.path,
  });
});

export default app;
