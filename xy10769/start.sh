#!/bin/bash

echo "🚀 启动爬虫数据去重合并系统"
echo ""

echo "📦 安装后端依赖..."
cd backend
pip install fastapi uvicorn python-multipart pydantic python-dotenv

echo ""
echo "🔧 启动后端服务 (端口 8000)..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo ""
echo "🌐 启动前端服务 (端口 3000)..."
cd ../frontend
python3 -m http.server 3000 &
FRONTEND_PID=$!

echo ""
echo "✅ 服务启动完成！"
echo "📱 前端地址: http://localhost:3000"
echo "⚙️  后端API: http://localhost:8000"
echo "📚 API文档: http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止服务"

wait $BACKEND_PID $FRONTEND_PID
