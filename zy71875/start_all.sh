#!/bin/bash

echo "========================================"
echo "  食堂备餐预测系统 - 一键启动"
echo "========================================"
echo ""

echo "请确保已安装："
echo "  • Python 3.8+"
echo "  • Node.js 16+"
echo ""
echo "后端将在端口 8000 启动"
echo "前端将在端口 3000 启动"
echo ""
echo "如果是首次运行，请先分别启动前后端完成依赖安装"
echo ""
echo "按 Ctrl+C 可停止所有服务"
echo ""
echo "========================================"
echo ""

cd "$(dirname "$0")"

trap "echo '正在停止服务...'; kill 0; exit" SIGINT SIGTERM

cd backend && bash start.sh &
BACKEND_PID=$!

sleep 3

cd ../frontend && bash start.sh &
FRONTEND_PID=$!

wait
