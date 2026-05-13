#!/bin/bash

echo "=== 冷链药品配送签收系统 ==="
echo ""

echo "安装后端依赖..."
cd backend
npm install

echo ""
echo "启动后端服务 (端口 3001)..."
npm run dev &
BACKEND_PID=$!

cd ..

echo ""
echo "安装前端依赖..."
cd frontend
npm install

echo ""
echo "启动前端服务 (端口 3000)..."
npm start

echo ""
echo "服务已启动！"
echo "后端 API: http://localhost:3001"
echo "前端界面: http://localhost:3000"

trap "kill $BACKEND_PID" EXIT
wait
