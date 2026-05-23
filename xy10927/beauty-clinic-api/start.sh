#!/bin/bash

echo "====================================="
echo "美容院疗程核销API服务启动脚本"
echo "====================================="

echo ""
echo "1. 检查并安装依赖..."
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "依赖已存在，跳过安装"
fi

echo ""
echo "2. 初始化数据库..."
node src/scripts/initDB.js

echo ""
echo "3. 导入样例数据..."
node src/scripts/sampleData.js

echo ""
echo "4. 启动API服务..."
echo ""
echo "服务将在 http://localhost:3000 启动"
echo "按 Ctrl+C 停止服务"
echo ""
echo "====================================="
echo ""

npm start
