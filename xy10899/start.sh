#!/bin/bash

echo "🚀 发布就绪度管理平台 - 一键启动脚本"
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "📦 正在安装后端依赖..."
cd "$SCRIPT_DIR/backend"
npm install

echo ""
echo "🗄️  正在初始化数据库..."
npm run init-db

echo ""
echo "📦 正在安装前端依赖..."
cd "$SCRIPT_DIR/frontend"
npm install

echo ""
echo "✅ 依赖安装完成！"
echo ""
echo "请分别在两个终端窗口执行以下命令启动服务："
echo ""
echo "📡  启动后端服务 (端口 3000):"
echo "   cd backend && npm start"
echo ""
echo "🎨  启动前端应用 (端口 5173):"
echo "   cd frontend && npm run dev"
echo ""
echo "🌐  访问地址: http://localhost:5173"
