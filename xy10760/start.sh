#!/bin/bash

echo "========================================"
echo "审批规则模拟器 - 启动脚本"
echo "========================================"

echo ""
echo "启动后端服务 (端口 8000)..."
cd backend
pip install -q -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo ""
echo "等待后端启动..."
sleep 5

echo ""
echo "启动前端服务 (端口 3000)..."
cd ../frontend
npm install -q
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "服务启动完成！"
echo "后端API文档: http://localhost:8000/docs"
echo "前端访问地址: http://localhost:3000"
echo "========================================"
echo ""
echo "按 Ctrl+C 停止所有服务"

wait
