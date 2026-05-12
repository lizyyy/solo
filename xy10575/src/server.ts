import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`生产设备点检 API 服务已启动`);
  console.log(`监听端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`API 基础路径: http://localhost:${PORT}/api`);
});
