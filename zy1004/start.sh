#!/bin/bash

echo "=================================="
echo "家电维修店接单排期工作台"
echo "=================================="
echo ""

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 请先安装 Python 3.8+"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装 Node.js 16+"
    exit 1
fi

echo "📦 安装后端依赖..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt -q
echo "✅ 后端依赖安装完成"

echo ""
echo "📦 安装前端依赖..."
cd ../frontend
npm install 2>/dev/null
echo "✅ 前端依赖安装完成"

echo ""
echo "🚀 启动后端服务 (端口 8000)..."
cd ../backend
source venv/bin/activate

# 启动后端（后台运行）
python run.py &
BACKEND_PID=$!

echo "⏳ 等待后端启动..."
sleep 3

echo "🚀 启动前端服务 (端口 3000)..."
cd ../frontend

# 打开浏览器（根据操作系统）
if command -v open &> /dev/null; then
    open "http://localhost:3000"
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:3000"
fi

# 启动前端
npm run dev

# 清理后台进程
kill $BACKEND_PID 2>/dev/null
