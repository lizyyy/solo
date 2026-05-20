#!/bin/bash

echo "=========================================="
echo "  定时任务互斥锁 API - 启动脚本"
echo "=========================================="
echo ""

PROJECT_DIR=$(pwd)

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到 python3，请先安装 Python"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 node，请先安装 Node.js"
    exit 1
fi

echo "✅ 环境检查通过"
echo ""

# 启动后端
echo "📦 启动后端服务 (端口 8000)..."
cd "$PROJECT_DIR/backend"

if [ ! -d "venv" ]; then
    echo "   创建虚拟环境..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "   安装 Python 依赖..."
pip install -q -r requirements.txt

# 后端在后台运行
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

echo "   后端 PID: $BACKEND_PID"
echo ""

# 启动前端
echo "🎨 启动前端服务 (端口 3000)..."
cd "$PROJECT_DIR/frontend"

if [ ! -d "node_modules" ]; then
    echo "   安装 Node.js 依赖..."
    npm install
fi

npm run dev &
FRONTEND_PID=$!

echo "   前端 PID: $FRONTEND_PID"
echo ""

echo "=========================================="
echo "  服务启动成功！"
echo ""
echo "  🌐 前端地址: http://localhost:3000"
echo "  📚 API 文档: http://localhost:8000/docs"
echo ""
echo "  按 Ctrl+C 停止所有服务"
echo "=========================================="
echo ""

# 等待用户中断
trap "echo ''; echo '🛑 正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '✅ 服务已停止'; exit" INT

wait
