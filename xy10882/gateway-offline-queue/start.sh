#!/bin/bash

echo "=================================="
echo "   网关离线指令队列系统启动"
echo "=================================="

cd "$(dirname "$0")"

echo ""
echo "📦 安装后端依赖..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q fastapi uvicorn sqlalchemy pydantic python-multipart

echo ""
echo "🔧 初始化演示数据..."
python init_data.py

echo ""
echo "🚀 启动后端服务 (端口 8000)..."
uvicorn main:app --reload --host 0.0.0.0 &
BACKEND_PID=$!

sleep 2

echo ""
echo "📦 安装前端依赖..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    npm install 2>/dev/null
fi

echo ""
echo "🚀 启动前端服务 (端口 3000)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=================================="
echo "   服务启动完成！"
echo ""
echo "🌐 前端地址: http://localhost:3000"
echo "📡 后端API:  http://localhost:8000"
echo "📚 API文档: http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo "=================================="

wait $BACKEND_PID $FRONTEND_PID
