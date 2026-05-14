#!/bin/bash

echo "=== OAuth 授权撤回中心 启动脚本 ==="

echo ""
echo "1. 启动后端服务..."
cd backend
pip install -q -r requirements.txt
python main.py &
BACKEND_PID=$!

echo ""
echo "2. 等待后端启动..."
sleep 5

echo ""
echo "3. 启动前端服务..."
cd ../frontend
npm install -s
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=== 服务启动完成 ==="
echo "后端 API: http://localhost:8000"
echo "API 文档: http://localhost:8000/docs"
echo "前端控制台: http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止所有服务"

wait
