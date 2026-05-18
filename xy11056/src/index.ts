import express from 'express';
import { db } from './database';
import invoiceRoutes from './routes/invoiceRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/invoices', invoiceRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '社区维修基金票据 API 服务运行正常' });
});

function startServer() {
  try {
    db.init();
    console.log('数据库初始化成功');
    
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export default app;
