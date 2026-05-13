#!/bin/bash

echo "====================================="
echo "法律咨询冲突分派系统 - 启动脚本"
echo "====================================="

echo ""
echo "安装后端依赖..."
cd backend
npm install

echo ""
echo "初始化数据库..."
npm run init-db

echo ""
echo "插入样例数据..."
npm run seed

echo ""
echo "启动后端服务..."
npm start &
BACKEND_PID=$!

echo ""
echo "安装前端依赖..."
cd ../frontend
npm install

echo ""
echo "启动前端服务..."
npm run dev &

echo ""
echo "====================================="
echo "系统启动中..."
echo "后端: http://localhost:3001"
echo "前端: http://localhost:3000"
echo "====================================="

wait
