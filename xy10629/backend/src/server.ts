import express from 'express';
import cors from 'cors';
import packageRoutes from './routes/packages';
import recoveryRoutes from './routes/recovery';
import cleaningRoutes from './routes/cleaning';
import sterilizationRoutes from './routes/sterilization';
import isolationRoutes from './routes/isolation';
import distributionRoutes from './routes/distribution';
import statisticsRoutes from './routes/statistics';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/packages', packageRoutes);
app.use('/api/recovery', recoveryRoutes);
app.use('/api/cleaning', cleaningRoutes);
app.use('/api/sterilization', sterilizationRoutes);
app.use('/api/isolation', isolationRoutes);
app.use('/api/distribution', distributionRoutes);
app.use('/api/statistics', statisticsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '服务器运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
