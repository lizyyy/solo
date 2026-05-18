import express from 'express';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: '积分结算平台积分过期补偿 API' });
});

app.listen(PORT, () => {
  console.log(`积分结算平台积分过期补偿 API 已启动，端口: ${PORT}`);
});

export default app;
