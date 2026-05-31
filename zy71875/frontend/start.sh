#!/bin/bash

echo "========================================"
echo "  食堂备餐预测系统 - 前端启动脚本"
echo "========================================"
echo ""

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
    echo "正在安装前端依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "依赖安装失败，请检查网络连接或 package.json"
        exit 1
    fi
    echo "依赖安装完成"
    echo ""
fi

echo "========================================"
echo "  前端服务启动中..."
echo "  访问地址: http://localhost:3000"
echo "========================================"
echo ""

npm run dev
