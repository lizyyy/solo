#!/bin/bash

echo "🎨 青年艺术展挂墙管理系统 - 启动脚本"
echo "========================================="

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

cleanup() {
    echo ""
    echo "正在停止服务..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo "服务已停止"
    exit 0
}

trap cleanup SIGINT SIGTERM

echo ""
echo "📦 检查并安装后端依赖..."
cd "$PROJECT_DIR/backend"
if [ ! -d "venv" ]; then
    echo "创建Python虚拟环境..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt

echo ""
echo "📦 检查并安装前端依赖..."
cd "$PROJECT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo "安装npm依赖..."
    npm install --silent
fi

echo ""
echo "🚀 启动后端服务 (端口 8000)..."
cd "$PROJECT_DIR/backend"
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo ""
echo "🚀 启动前端服务 (端口 3000)..."
cd "$PROJECT_DIR/frontend"
BROWSER=none npm start &
FRONTEND_PID=$!

echo ""
echo "========================================="
echo "✅ 系统启动中..."
echo ""
echo "📱 前端地址: http://localhost:3000"
echo "🔧 后端API:  http://localhost:8000"
echo "📚 API文档:  http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo "========================================="

wait
