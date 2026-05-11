import express from 'express';
import router from './routes';
import { seedSampleData } from './seed';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api', router);

seedSampleData();

app.listen(PORT, () => {
  console.log(`仓储库龄预警 API 服务已启动: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`查询待办预警: http://localhost:${PORT}/api/alerts/pending`);
  console.log(`查看样例数据: http://localhost:${PORT}/api/samples`);
});
