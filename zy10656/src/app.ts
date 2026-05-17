import express from 'express';
import diffRoutes from './routes/diffRoutes';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/diff', diffRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: '采购协同系统到货差异确认 API'
  });
});

export default app;
