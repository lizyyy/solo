import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import memberRoutes from './routes/memberRoutes';
import measurementRoutes from './routes/measurementRoutes';
import injuryRoutes from './routes/injuryRoutes';
import planRoutes from './routes/planRoutes';
import sessionRoutes from './routes/sessionRoutes';
import paymentRoutes from './routes/paymentRoutes';
import exportRoutes from './routes/exportRoutes';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '私教体测方案调整台服务运行中' });
});

app.use('/api/members', memberRoutes);
app.use('/api/measurements', measurementRoutes);
app.use('/api/injuries', injuryRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/export', exportRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`私教体测方案调整台服务已启动，端口: ${PORT}`);
});

export const prisma = new PrismaClient();
