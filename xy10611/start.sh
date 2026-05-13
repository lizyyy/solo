#!/bin/bash

echo "🏨 酒店布草洗涤追踪系统 - 快速启动脚本"
echo "============================================"

echo ""
echo "📦 安装后端依赖..."
cd backend
npm install

echo ""
echo "🗄️  初始化数据库..."
node scripts/init-db.js

echo ""
echo "🚀 启动后端服务 (端口: 3001)..."
npm start &
BACKEND_PID=$!

echo ""
echo "📦 安装前端依赖..."
cd ../frontend
npm install

echo ""
echo "🎨 启动前端服务 (端口: 3000)..."
npm start &

echo ""
echo "✅ 服务启动中..."
echo "后端: http://localhost:3001"
echo "前端: http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止所有服务"

wait $BACKEND_PID