#!/bin/bash

echo "正在启动私教课包消课退款管理系统..."

mkdir -p data

echo "启动后端服务 (端口 3001)..."
node server/index.js &
SERVER_PID=$!

sleep 3

echo ""
echo "========================================"
echo "系统启动成功！"
echo "后端服务: http://localhost:3001"
echo "健康检查: http://localhost:3001/api/health"
echo "========================================"
echo ""
echo "如需启动前端，请在新终端运行:"
echo "  cd client && npm start"
echo ""
echo "按 Ctrl+C 停止服务"

wait $SERVER_PID
