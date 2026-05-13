#!/bin/bash

echo "========================================"
echo "装修材料进场验收系统 - 快速启动脚本"
echo "========================================"
echo ""

echo "正在检查 Node.js 版本..."
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js，请先安装 Node.js >= 16.0.0"
    exit 1
fi
node --version
echo ""

echo "正在安装根目录依赖..."
npm install

echo ""
echo "正在安装后端依赖..."
cd server
npm install

echo ""
echo "正在安装前端依赖..."
cd ../client
npm install

echo ""
echo "正在初始化数据库和样例数据..."
cd ../server
npm run seed

echo ""
echo "========================================"
echo "初始化完成！"
echo ""
echo "启动方式1：分别启动"
echo "  后端: cd server && npm run dev (端口3001)"
echo "  前端: cd client && npm start (端口3000)"
echo ""
echo "启动方式2：同时启动（在根目录）"
echo "  npm run dev"
echo ""
echo "访问地址: http://localhost:3000"
echo "========================================"
