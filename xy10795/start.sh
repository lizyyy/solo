#!/bin/bash

echo "========================================"
echo "项目风险周报生成器 - 启动脚本"
echo "========================================"

echo ""
echo "📦 安装后端依赖..."
cd backend
pip3 install -q fastapi uvicorn sqlalchemy pydantic python-dotenv python-multipart

echo ""
echo "🔧 初始化数据库..."
python3 -c "
from database import engine, Base
from models import *
Base.metadata.create_all(bind=engine)
print('✅ 数据库表创建成功')
"

echo ""
echo "🚀 启动后端服务 (端口 8000)..."
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo ""
echo "📦 安装前端依赖..."
cd ../frontend
npm install 2>/dev/null

echo ""
echo "🌐 启动前端服务 (端口 3000)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "✅ 服务启动完成！"
echo "========================================"
echo ""
echo "🌐 前端地址: http://localhost:3000"
echo "🔧 后端API: http://localhost:8000"
echo "📚 API文档: http://localhost:8000/docs"
echo ""
echo "进程ID: 后端=$BACKEND_PID, 前端=$FRONTEND_PID"
echo ""
echo "按 Ctrl+C 停止所有服务..."

trap "echo ''; echo '🛑 正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '✅ 已停止所有服务'; exit" INT

wait
