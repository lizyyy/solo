#!/bin/bash

echo "============================================="
echo "    水站桶押金流转API服务启动脚本"
echo "============================================="

echo ""
echo "1. 创建必要的目录..."
mkdir -p db exports src/models src/controllers src/routes src/services src/middleware scripts
echo "   目录创建完成"

echo ""
echo "2. 检查 Node.js 环境..."
if ! command -v node &> /dev/null; then
    echo "   错误: 未找到 Node.js，请先安装 Node.js"
    exit 1
fi
echo "   Node.js 版本: $(node -v)"

echo ""
echo "3. 安装项目依赖..."
npm install
if [ $? -ne 0 ]; then
    echo "   依赖安装失败，请检查网络或 npm 配置"
    exit 1
fi
echo "   依赖安装完成"

echo ""
echo "4. 初始化数据库..."
npm run init-db
if [ $? -ne 0 ]; then
    echo "   数据库初始化失败"
    exit 1
fi
echo "   数据库初始化完成"

echo ""
echo "5. 导入样例数据..."
npm run seed-data
if [ $? -ne 0 ]; then
    echo "   样例数据导入失败"
    exit 1
fi
echo "   样例数据导入完成"

echo ""
echo "============================================="
echo "    启动服务..."
echo "============================================="
echo ""
echo "服务地址: http://localhost:3000"
echo "健康检查: http://localhost:3000/api/health"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

npm start
