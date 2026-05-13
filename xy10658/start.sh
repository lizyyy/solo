#!/bin/bash

echo "========================================"
echo "  公寓租约续租押金管理系统 - 启动脚本"
echo "========================================"
echo ""

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js 16+"
    exit 1
fi

echo "✅ Node.js 已安装"
node --version
echo ""

# 后端目录
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backend"
# 前端目录
FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/frontend"

# 检查后端目录
if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ 错误: 后端目录不存在"
    exit 1
fi

# 检查前端目录
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ 错误: 前端目录不存在"
    exit 1
fi

# 安装后端依赖
echo "📦 检查后端依赖..."
cd "$BACKEND_DIR"
if [ ! -d "node_modules" ]; then
    echo "   正在安装后端依赖..."
    npm install
    echo "   后端依赖安装完成"
else
    echo "   后端依赖已存在"
fi

# 初始化数据库
if [ ! -f "data/database.db" ]; then
    echo ""
    echo "🗄️  初始化数据库..."
    npm run init-db
    echo "   数据库初始化完成"
else
    echo "   数据库已存在"
fi

# 安装前端依赖
echo ""
echo "📦 检查前端依赖..."
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
    echo "   正在安装前端依赖..."
    npm install
    echo "   前端依赖安装完成"
else
    echo "   前端依赖已存在"
fi

echo ""
echo "========================================"
echo "  启动服务"
echo "========================================"
echo ""
echo "🌐  后端服务将在: http://localhost:3001"
echo "🌐  前端服务将在: http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 启动后端（后台运行）
cd "$BACKEND_DIR"
npm start &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# 启动前端（前台运行）
cd "$FRONTEND_DIR"
npm start &
FRONTEND_PID=$!

# 捕获退出信号
trap "echo ''; echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

# 等待任意进程结束
wait
