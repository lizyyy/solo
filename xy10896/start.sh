#!/bin/bash

echo "=== 依赖破坏提醒系统 - 快速启动 ==="
echo ""

echo "1. 检查并安装后端依赖..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..

echo ""
echo "2. 检查并安装前端依赖..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..

echo ""
echo "3. 启动后端服务 (端口 3001)..."
cd backend
npm start &
BACKEND_PID=$!

sleep 3

echo ""
echo "4. 启动前端服务 (端口 3000)..."
cd ../frontend
npm start

echo ""
echo "后端服务 PID: $BACKEND_PID"
echo "按 Ctrl+C 停止服务"
