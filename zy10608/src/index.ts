import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { initDatabase } from './models/database';
import supplementRoutes from './routes/supplementRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/supplement', supplementRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '物流轨迹补传服务运行正常' });
});

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();

export default app;
