#!/usr/bin/env node

import { createApp } from './api/server';

const PORT = process.env.PORT || 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`🚀 民宿运营管理系统已启动`);
  console.log(`📡 API 服务运行在端口 ${PORT}`);
  console.log(`🌐 基础地址: http://localhost:${PORT}/api/v1`);
  console.log(`💡 健康检查: http://localhost:${PORT}/api/v1/health`);
});
