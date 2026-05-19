#!/bin/bash

echo "========================================"
echo "  提示词模板审批台 - 启动脚本"
echo "========================================"
echo ""

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到 Python3，请先安装 Python"
    exit 1
fi

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

echo "✅ Python 和 Node.js 环境检查通过"
echo ""

# 创建必要的目录
mkdir -p backend/data
mkdir -p backend/exports

echo "📦 安装后端依赖..."
cd backend
pip3 install -r requirements.txt -q
if [ $? -ne 0 ]; then
    echo "❌ 后端依赖安装失败"
    exit 1
fi
echo "✅ 后端依赖安装完成"
echo ""

echo "📦 安装前端依赖..."
cd ../frontend
npm install --silent
if [ $? -ne 0 ]; then
    echo "❌ 前端依赖安装失败"
    exit 1
fi
echo "✅ 前端依赖安装完成"
echo ""

echo "========================================"
echo "  启动服务..."
echo "========================================"
echo ""

# 启动后端
echo "🚀 启动后端服务 (端口 5000)..."
cd ../backend
python3 app.py &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# 启动前端
echo "🚀 启动前端服务 (端口 3000)..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "  服务启动成功！"
echo "========================================"
echo ""
echo "🌐 前端地址: http://localhost:3000"
echo "🔧 后端地址: http://localhost:5000"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 等待用户中断
wait

# 清理进程
echo ""
echo "🛑 正在停止服务..."
kill $BACKEND_PID 2>/dev/null
kill $FRONTEND_PID 2>/dev/null
echo "✅ 服务已停止"
