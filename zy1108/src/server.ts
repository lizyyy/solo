import express, { Request, Response } from 'express';
import { createTables } from './database/schema';
import { errorHandler } from './middleware/error-handler';
import routes from './routes';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/api', routes);

app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Dance Studio API',
    version: '1.0.0',
    endpoints: {
      students: '/api/students',
      teachers: '/api/teachers',
      classes: '/api/classes',
      packages: '/api/packages',
      lessons: '/api/lessons',
      bookings: '/api/bookings',
      notifications: '/api/notifications',
      export: '/api/export',
      health: '/api/health',
    },
  });
});

app.use(errorHandler);

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

createTables();

app.listen(PORT, () => {
  console.log(`Dance Studio API is running on http://localhost:${PORT}`);
  console.log(`API documentation: http://localhost:${PORT}`);
});

export default app;
