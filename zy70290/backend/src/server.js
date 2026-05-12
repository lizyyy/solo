import express from 'express';
import cors from 'cors';
import uploadRoutes from './routes/upload.js';
import exhibitionRoutes from './routes/exhibition.js';
import heatmapRoutes from './routes/heatmap.js';
import securityRoutes from './routes/security.js';
import problemRoutes from './routes/problem.js';
import statusRoutes from './routes/status.js';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/upload', uploadRoutes);
app.use('/api/exhibitions', exhibitionRoutes);
app.use('/api/heatmap', heatmapRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/status', statusRoutes);

app.listen(PORT, () => {
  console.log(`美术馆观众动线热区台后端服务已启动: http://localhost:${PORT}`);
});
