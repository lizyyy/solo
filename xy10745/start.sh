#!/bin/bash

echo "=== 在线判题队列后台管理系统 ==="

echo ""
echo "1. 启动后端服务..."
cd backend
python3 app.py &
BACKEND_PID=$!

echo ""
echo "2. 等待后端启动..."
sleep 3

echo ""
echo "3. 后端服务已启动: http://localhost:5000"
echo ""
echo "4. 请在浏览器中打开 frontend/index.html 访问前端页面"
echo ""
echo "按 Ctrl+C 停止服务"

wait $BACKEND_PID
