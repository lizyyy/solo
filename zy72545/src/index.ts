import express from 'express';
import { initDatabase, flush } from './database';
import routes from './routes';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

initDatabase();

app.use(express.json());
app.use('/api', routes);

function gracefulShutdown(signal: string) {
  console.log(`\n收到 ${signal}，正在保存数据...`);
  flush();
  console.log('数据已保存，退出');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

const server = app.listen(PORT, () => {
  console.log(`工艺参数推荐回看系统已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`数据持久化: 启用（重启不丢失）`);
});

export default app;
