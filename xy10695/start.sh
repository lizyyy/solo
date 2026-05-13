#!/bin/bash

echo "========================================"
echo "  试制件版本装车追踪系统 - 快速启动"
echo "========================================"
echo ""

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "正在安装后端依赖..."
    npm install
fi

if [ ! -d "client/node_modules" ]; then
    echo "正在安装前端依赖..."
    cd client
    npm install
    cd ..
fi

# 检查数据库是否存在
if [ ! -f "data/prototype_tracking.db" ]; then
    echo "正在初始化数据库和样例数据..."
    mkdir -p data
    node server/seedData.js
fi

echo ""
echo "启动后端服务 (端口 5000)..."
node server/index.js &
BACKEND_PID=$!

echo "等待后端服务启动..."
sleep 3

echo ""
echo "启动前端服务 (端口 3000)..."
cd client
npm start &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "  系统启动完成！"
echo "  前端地址: http://localhost:3000"
echo "  后端API:  http://localhost:5000/api"
echo "========================================"
echo ""
echo "按 Ctrl+C 停止所有服务"

wait
