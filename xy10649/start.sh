#!/bin/bash

echo "======================================"
echo "  企业礼品客户发放管理系统 - 启动脚本"
echo "======================================"
echo ""

echo "检查 Node.js 版本..."
node --version

echo ""
echo "检查 npm 版本..."
npm --version

echo ""
echo "======================================"
echo "  安装后端依赖..."
echo "======================================"
cd backend
npm install

echo ""
echo "======================================"
echo "  初始化数据库..."
echo "======================================"
node init-data.js

echo ""
echo "======================================"
echo "  启动后端服务 (端口: 3001)..."
echo "======================================"
node server.js &
BACKEND_PID=$!

echo ""
echo "======================================"
echo "  安装前端依赖..."
echo "======================================"
cd ../frontend
npm install

echo ""
echo "======================================"
echo "  启动前端服务 (端口: 3000)..."
echo "======================================"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "======================================"
echo "  服务启动完成！"
echo "  前端地址: http://localhost:3000"
echo "  后端地址: http://localhost:3001"
echo ""
echo "  按 Ctrl+C 停止所有服务"
echo "======================================"

trap "echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT

wait
