import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import cors from 'cors';
import path from 'node:path';
import tracksRouter from './routes/tracks.js';

const app: express.Application = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/tracks', tracksRouter);
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    });
  },
);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'API not found',
  });
});

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Server Error]', error);
  res.status(500).json({
    error: error.message || 'Server internal error',
  });
});

export default app;
