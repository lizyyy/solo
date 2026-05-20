#!/bin/bash

echo "🚀 启动发布审批系统后端"

if [ ! -d "venv" ]; then
    echo "📦 创建虚拟环境..."
    python3 -m venv venv
fi

echo "🔧 激活虚拟环境..."
source venv/bin/activate

echo "📚 安装依赖..."
pip install -r requirements.txt

echo "🌐 启动 FastAPI 服务器 (http://localhost:8000)"
echo "📖 API 文档: http://localhost:8000/docs"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
