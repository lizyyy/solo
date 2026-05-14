#!/bin/bash

echo "=========================================="
echo "  图片转码任务控制台 - 前端启动脚本"
echo "=========================================="
echo ""

cd frontend

if [ ! -d "node_modules" ]; then
    echo "📦 安装npm依赖..."
    npm install
    echo "✅ 依赖安装完成"
fi

echo ""
echo "🚀 启动前端开发服务器..."
echo "🌐 访问地址: http://localhost:3000"
echo ""

npm run dev
