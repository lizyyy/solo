# 示例项目

这是一个用于测试 `env-checker` 工具的示例项目。

## 环境变量配置

### 必需变量

在运行此项目之前，请确保设置以下环境变量：

```bash
# 数据库配置
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=myapp
export DB_USER=postgres
export DB_PASSWORD=your_password

# API 配置
export API_BASE_URL=https://api.example.com
export API_KEY=your_api_key

# 应用配置
export NODE_ENV=development
export PORT=3000
```

### 可选变量

```bash
# 调试模式
export DEBUG=true
export LOG_LEVEL=debug

# Redis 配置（可选）
export REDIS_URL=redis://localhost:6379

# 构建配置
export BUILD_ENV=staging
```

## 快速开始

1. 复制 `.env.example` 为 `.env.local`
2. 编辑 `.env.local` 填入你的真实值
3. 运行 `npm run dev` 启动开发服务器

## Docker 部署

```bash
docker-compose up -d
```

这将启动以下服务：
- web 应用 (端口 ${PORT})
- PostgreSQL 数据库
- Redis 缓存
