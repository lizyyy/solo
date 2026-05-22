import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { initDatabase } from './database/init';
import { PreparationDAO } from './database/dao';
import { PreparationService } from './services/preparation';
import { authMiddleware } from './middleware/auth';
import { createInspectionRouter } from './routes/inspection';
import { createRepairRouter } from './routes/repair';
import { createPhotoRouter } from './routes/photo';
import { createLedgerRouter } from './routes/ledger';
import { createFailedRouter } from './routes/failed';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  const db = initDatabase();
  const dao = new PreparationDAO(db);
  const service = new PreparationService(dao);

  app.get('/health', (req, res) => {
    res.json({
      success: true,
      message: '二手车整备权限追责台账 API 运行正常',
      timestamp: Date.now(),
      uptime: process.uptime()
    });
  });

  app.use(authMiddleware);

  app.use('/api/inspection', createInspectionRouter(service));
  app.use('/api/repair', createRepairRouter(service));
  app.use('/api/photo', createPhotoRouter(service));
  app.use('/api/ledger', createLedgerRouter(service));
  app.use('/api/failed', createFailedRouter(service));

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: '接口不存在',
      timestamp: Date.now()
    });
  });

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('服务器错误:', err);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
      timestamp: Date.now()
    });
  });

  return { app, db, service };
}

export default createApp;
