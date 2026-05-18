import express from 'express';
import cors from 'cors';
import path from 'path';
import { db } from './store/database';
import deductionRoutes from './routes/deduction.routes';
import orderRoutes from './routes/order.routes';
import stateMachineRoutes from './routes/state-machine.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

db.load();

app.use('/api/deductions', deductionRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/state-machine', stateMachineRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '短租公寓前台押金扣项 API 服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  短租公寓前台押金扣项 API 服务已启动`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  API 文档: http://localhost:${PORT}/`);
  console.log(`  健康检查: http://localhost:${PORT}/api/health`);
  console.log(`========================================\n`);
});

export default app;