#!/bin/bash

echo "启动缓存预热失效中心系统..."

echo "1. 启动后端服务..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py &
BACKEND_PID=$!

sleep 3

echo "2. 启动前端服务..."
cd ../frontend
npm install
npm run dev &
FRONTEND_PID=$!

echo ""
echo "系统启动完成!"
echo "后端API: http://localhost:5000"
echo "前端页面: http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止服务"

wait $FRONTEND_PID $BACKEND_PID
