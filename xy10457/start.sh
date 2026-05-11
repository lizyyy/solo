#!/bin/bash

echo "========================================"
echo "      服装尺码换货台 - 启动脚本"
echo "========================================"
echo ""

echo "📍 项目目录: $(pwd)"
echo ""

echo "📦 正在安装后端依赖..."
cd server
npm install
echo "✅ 后端依赖安装完成"
echo ""

echo "📦 正在安装前端依赖..."
cd ../client
npm install
echo "✅ 前端依赖安装完成"
echo ""

echo "🚀 正在启动后端服务 (端口 3000)..."
cd ../server
node app.js &
SERVER_PID=$!

echo "⏳ 等待后端服务启动..."
sleep 3

echo "🚀 正在启动前端服务 (端口 8080)..."
cd ../client
npx http-server -p 8080 -c-1 public &
CLIENT_PID=$!

echo ""
echo "========================================"
echo "✅ 服务已启动！"
echo ""
echo "🌐 前端地址: http://localhost:8080"
echo "🔧 后端地址: http://localhost:3000"
echo "🔍 健康检查: http://localhost:3000/api/health"
echo ""
echo "📝 样例订单号:"
echo "   - ORD20260501001 (T恤 - 张三)"
echo "   - ORD20260502002 (鞋子 - 李四)"
echo "   - ORD20260503003 (外套 - 王五)"
echo ""
echo "⚠️  按 Ctrl+C 停止所有服务"
echo "========================================"

trap "echo ''; echo '🛑 正在停止服务...'; kill $SERVER_PID $CLIENT_PID 2>/dev/null; echo '✅ 服务已停止'; exit" INT

wait
