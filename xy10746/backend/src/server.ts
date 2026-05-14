import express from 'express';
import cors from 'cors';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`插件市场审核平台服务运行在 http://localhost:${PORT}`);
  console.log(`API 文档：http://localhost:${PORT}/api/health`);
});

export default app;
