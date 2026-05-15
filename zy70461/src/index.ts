import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import { initDatabase } from '../scripts/init-db';

const PORT = process.env.PORT || 3000;
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`\n============================================================`);
  console.log(`  依赖器合约服务已启动`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  API 前缀: http://localhost:${PORT}/api`);
  console.log(`  健康检查: http://localhost:${PORT}/api/health`);
  console.log(`============================================================\n`);
});

export default app;
