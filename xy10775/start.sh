#!/bin/bash

echo "🚀 启动无障碍检查修复台..."

echo ""
echo "📦 安装后端依赖..."
pip install fastapi uvicorn pydantic python-multipart python-dateutil

echo ""
echo "📦 安装前端依赖..."
cd frontend
npm install

echo ""
echo "🔙 回到根目录..."
cd ..

echo ""
echo "🖥️  启动后端服务 (端口 8000)..."
python3 backend/main.py &
BACKEND_PID=$!

echo ""
echo "⏳ 等待后端启动..."
sleep 3

echo ""
echo "🌐 启动前端服务 (端口 5173)..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 服务已启动!"
echo "📋 前端地址: http://localhost:5173"
echo "🔧 后端API: http://localhost:8000"
echo "📄 API文档: http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "echo '🛑 正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT

wait
