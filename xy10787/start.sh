#!/bin/bash

echo "🚀 启动多语言文案发布台"

echo "📦 安装后端依赖..."
cd backend
pip install -r requirements.txt

echo "🔧 启动后端服务 (端口: 8000)..."
uvicorn main:app --reload &
BACKEND_PID=$!

echo "📦 安装前端依赖..."
cd ../frontend
npm install

echo "🎨 启动前端服务 (端口: 3000)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 服务启动完成！"
echo "🌐 前端地址: http://localhost:3000"
echo "🔧 后端API: http://localhost:8000"
echo "📚 API文档: http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止服务"

wait $BACKEND_PID $FRONTEND_PID
