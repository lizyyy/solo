#!/bin/bash

echo "=========================================="
echo "租赁押金冻结台 - 启动脚本"
echo "=========================================="

echo ""
echo "正在检查并安装后端依赖..."
cd backend
npm install

echo ""
echo "正在启动后端服务..."
node server.js &
BACKEND_PID=$!

sleep 2

echo ""
echo "后端服务已启动: http://localhost:3001"
echo ""
echo "=========================================="
echo "请在浏览器中打开 frontend/index.html 以使用前端界面"
echo ""
echo "使用说明："
echo "1. 首次使用请点击 '生成样例数据' 按钮"
echo "2. 查看4个不同场景的样例订单"
echo "3. 可创建新订单、处理续租、扣款、退押等"
echo "=========================================="

echo ""
echo "按 Ctrl+C 停止服务"

trap "kill $BACKEND_PID 2>/dev/null; echo ''; echo '服务已停止'; exit" INT

wait
