import express from 'express';
import cors from 'cors';
import topologyRoutes from './routes/topology.js';
import rulesRoutes from './routes/rules.js';
import drillRoutes from './routes/drill.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/topology', topologyRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/drill', drillRoutes);

app.listen(PORT, () => {
  console.log(`服务降级演练台后端运行在 http://localhost:${PORT}`);
});
