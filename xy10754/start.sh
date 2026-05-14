#!/bin/bash

echo "=== 优惠规则试算器 ==="
echo ""
echo "安装依赖..."
pip3 install -r backend/requirements.txt

echo ""
echo "启动后端服务 (端口 5000)..."
cd backend && python3 app.py &
BACKEND_PID=$!

echo ""
echo "后端服务已启动，PID: $BACKEND_PID"
echo ""
echo "请打开浏览器访问: $(cd ../frontend && pwd)/index.html"
echo ""
echo "停止服务请按 Ctrl+C"

wait $BACKEND_PID
