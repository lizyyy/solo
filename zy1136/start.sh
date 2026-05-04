#!/bin/bash

# 公司网络管理台启动脚本

echo "========================================"
echo "   公司网络管理台"
echo "   Network Management Console"
echo "========================================"
echo ""

# 检查Node.js版本
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未检测到 Node.js，请先安装 Node.js 18+"
    echo "   下载地址: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  警告: 当前 Node.js 版本为 $(node --version)，建议使用 18+"
fi

echo "✅ Node.js 版本: $(node --version)"
echo "✅ npm 版本: $(npm --version)"
echo ""

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装根目录依赖..."
    npm install
fi

if [ ! -d "backend/node_modules" ]; then
    echo "📦 安装后端依赖..."
    cd backend
    npm install
    cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 安装前端依赖..."
    cd frontend
    npm install
    cd ..
fi

echo ""
echo "🚀 启动服务..."
echo ""
echo "   后端服务: http://localhost:3001"
echo "   前端服务: http://localhost:3000"
echo ""
echo "   按 Ctrl+C 停止服务"
echo "========================================"
echo ""

# 启动前后端服务
npm run dev
