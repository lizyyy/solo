#!/bin/bash

echo "🚀 正在启动功能开关 API 控制台..."

cd "$(dirname "$0")"

# 检查 Python 环境
if ! command -v python3 &> /dev/null; then
    echo "❌ 请先安装 Python 3"
    exit 1
fi

# 安装后端依赖
echo "📦 安装后端依赖..."
pip3 install -r backend/requirements.txt

# 确保 app 目录存在且有 __init__.py
mkdir -p backend/app
touch backend/app/__init__.py

# 启动服务
echo "🌐 启动服务..."
cd backend && python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
