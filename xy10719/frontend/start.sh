#!/bin/bash

echo "========================================"
echo "  数据脱敏规则试验台 - 前端启动脚本"
echo "========================================"
echo ""

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到Node.js，请先安装Node.js"
    exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装npm依赖包..."
    npm install
fi

echo ""
echo "🚀 启动前端服务..."
echo "🌐 访问地址: http://localhost:3000"
echo ""

npm start
