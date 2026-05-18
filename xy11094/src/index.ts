import express from 'express';
import bodyParser from 'body-parser';
import detentionFeeRoutes from './routes/detention-fee.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/detention-fee', detentionFeeRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '口岸仓储代理口岸滞箱费用 API 服务正常运行' });
});

app.listen(PORT, () => {
  console.log(`口岸仓储代理口岸滞箱费用 API 服务运行在端口 ${PORT}`);
});

export default app;
