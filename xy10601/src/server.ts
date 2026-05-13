import express from 'express';
import cors from 'cors';
import path from 'path';
import ordersRouter from './routes/orders';
import productsRouter from './routes/products';

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/orders', ordersRouter);
app.use('/api/products', productsRouter);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`
  ==========================================
  社区团购截单补货系统已启动
  访问地址: http://localhost:${PORT}
  ==========================================
  `);
});
