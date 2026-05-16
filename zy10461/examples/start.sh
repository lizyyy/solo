#!/bin/bash

# 应用启动脚本
export APP_NAME=my-shell-app
export APP_ENV=production
export APP_DEBUG=false

# 数据库配置
DB_HOST=shell-db-host
DB_PORT=5432
DB_NAME=shell_db

# API密钥
export API_KEY=shell-api-key-67890
export SECRET_KEY=shell-secret-fghij

# 服务配置
SERVICE_PORT=8080
LOG_LEVEL=info

# 这是一个格式不正确的行
EXPORT WRONG_CASE=test
another@invalid#line

echo "Starting application..."
