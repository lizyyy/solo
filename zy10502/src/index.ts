import express from 'express';
import { windowsRouter } from './routes/windows';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'readonly-window-api' });
});

app.use('/api/windows', windowsRouter);

app.listen(PORT, () => {
  console.log(`Readonly Window API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API base: http://localhost:${PORT}/api/windows`);
});

export default app;
