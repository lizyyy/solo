#!/bin/bash
echo "=========================================="
echo "知识库文章发布同步系统 - 快速启动脚本"
echo "=========================================="

echo ""
echo "步骤 1/5: 检查Node环境..."
if ! command -v node &> /dev/null; then
    echo "❌ Node未安装，请先安装Node.js"
    exit 1
fi
echo "✅ Node版本: $(node -v)"
echo "✅ npm版本: $(npm -v)"

echo ""
echo "步骤 2/5: 安装后端依赖..."
if [ ! -d "node_modules" ]; then
    npm install --no-audit --no-fund
fi
echo "✅ 后端依赖安装完成"

echo ""
echo "步骤 3/5: 安装前端依赖..."
if [ ! -d "client/node_modules" ]; then
    cd client && npm install --no-audit --no-fund && cd ..
fi
echo "✅ 前端依赖安装完成"

echo ""
echo "步骤 4/5: 初始化数据库..."
if [ ! -d "data" ]; then
    npm run init-db
    npm run seed-data
fi
echo "✅ 数据库初始化完成"

echo ""
echo "=========================================="
echo "环境准备完成！"
echo ""
echo "启动方式："
echo "  方式一（推荐）：npm run dev"
echo "  方式二：分别启动"
echo "    - 后端：npm run server (端口3000)"
echo "    - 前端：cd client && npm run serve (端口8080)"
echo ""
echo "访问地址：http://localhost:8080"
echo "=========================================="
