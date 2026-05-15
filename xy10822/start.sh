#!/bin/bash

echo "=== 支付对账接口台 - 启动脚本 ==="

# 检查后端依赖
echo ""
echo "检查后端依赖..."
cd backend
if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
cd ..

# 检查前端依赖
echo "检查前端依赖..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install --silent
fi
cd ..

echo ""
echo "=== 启动后端服务 (端口 8000) ==="
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

sleep 3

echo ""
echo "=== 启动前端服务 (端口 3000) ==="
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "=== 服务已启动 ==="
echo "后端 API: http://localhost:8000"
echo "后端文档: http://localhost:8000/docs"
echo "前端界面: http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap "echo '正在停止服务...'; kill $BACKEND_PID 2>/dev/null; kill $FRONTEND_PID 2>/dev/null; exit" INT
wait
