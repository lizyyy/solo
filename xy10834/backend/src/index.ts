import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLockMiddleware } from './middleware/requestLock';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLockMiddleware);

app.use('/api', routes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`配置分发一致性台后端服务已启动: http://localhost:${PORT}`);
  console.log(`API文档: http://localhost:${PORT}/api/health`);
});
