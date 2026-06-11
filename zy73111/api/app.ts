import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import authRoutes from './routes/auth.js';
import collisionRoutes from './routes/collisions.js';
import { AuditController, ExportController, UserController } from './controllers/OthersController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app: express.Application = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

app.use('/api/auth', authRoutes);
app.use('/api/collisions', collisionRoutes);
app.get('/api/audit-logs', AuditController.list);
app.get('/api/export/preview', ExportController.preview);
app.get('/api/export/csv', ExportController.csv);
app.get('/api/users/me', UserController.me);

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({ success: true, message: 'ok' });
  },
);

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[API ERROR]', error);
  res.status(500).json({
    success: false,
    error: 'Server internal error: ' + error.message,
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'API not found' });
});

export default app;
