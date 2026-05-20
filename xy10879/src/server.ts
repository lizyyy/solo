import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import './database';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`优惠码滥用风控 API 服务已启动，端口: ${PORT}`);
});
