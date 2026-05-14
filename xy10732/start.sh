#!/bin/bash

echo "=== 定时任务日历中心 ==="

echo "1. 安装后端依赖..."
cd backend
pip3 install -r requirements.txt

echo "2. 初始化示例数据..."
python3 init_data.py

echo "3. 启动后端服务 (端口: 8000)..."
python3 main.py &
BACKEND_PID=$!

echo "4. 安装前端依赖..."
cd ../frontend
npm install

echo "5. 启动前端服务 (端口: 3000)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=== 服务启动成功 ==="
echo "后端API: http://localhost:8000"
echo "API文档: http://localhost:8000/docs"
echo "前端页面: http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止服务"

trap "echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT

wait
