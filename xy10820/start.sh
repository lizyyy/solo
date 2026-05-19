#!/bin/bash

echo "=== 供应商目录映射系统启动脚本 ==="

echo "1. 启动后端服务..."
cd backend
if [ ! -d "venv" ]; then
    echo "创建 Python 虚拟环境..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "安装 Python 依赖..."
pip install -r requirements.txt -q

echo "后端服务启动中 (http://localhost:8000)..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo ""
echo "2. 启动前端服务..."
cd ../frontend

echo "安装 Node 依赖..."
npm install -q

echo "前端服务启动中 (http://localhost:3000)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=== 服务启动完成 ==="
echo "后端 API: http://localhost:8000"
echo "API 文档: http://localhost:8000/docs"
echo "前端界面: http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止所有服务"

wait $BACKEND_PID $FRONTEND_PID