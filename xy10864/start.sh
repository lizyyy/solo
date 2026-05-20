#!/bin/bash

# 事故复盘资料系统 - 启动脚本

echo "============================================="
echo "🚀 事故复盘资料系统 - 启动检查"
echo "============================================="

# 检查 MongoDB
echo ""
echo "📊 检查 MongoDB..."
if lsof -i :27017 > /dev/null 2>&1; then
    echo "✅ MongoDB 运行中"
else
    echo "⚠️  MongoDB 未运行！"
    echo ""
    echo "请选择启动方式："
    echo "1) 使用 Homebrew 启动"
    echo "2) 使用 Docker 启动"
    echo "3) 跳过，稍后手动启动"
    echo ""
    read -p "请输入选项 [1-3]: " choice

    case $choice in
        1)
            echo "启动 MongoDB via brew..."
            brew services start mongodb-community
            sleep 3
            ;;
        2)
            echo "启动 MongoDB via Docker..."
            docker run -d -p 27017:27017 --name incident-mongo mongo:latest 2>/dev/null || docker start incident-mongo
            sleep 3
            ;;
        *)
            echo "跳过 MongoDB 启动，请确保稍后手动启动"
            ;;
    esac
fi

echo ""
echo "============================================="
echo "📦 启动后端服务 (端口 3001)"
echo "============================================="

cd backend
if [ ! -d "node_modules" ]; then
    echo "安装后端依赖..."
    npm install
fi

# 在后台启动后端
npm start &
BACKEND_PID=$!
cd ..

sleep 3

echo ""
echo "============================================="
echo "🎨 启动前端服务 (端口 3000)"
echo "============================================="

cd frontend
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install
fi

# 启动前端
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "============================================="
echo "✅ 服务启动完成！"
echo "============================================="
echo "前端地址: http://localhost:3000"
echo "后端地址: http://localhost:3001"
echo "健康检查: http://localhost:3001/api/health"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo "============================================="

# 等待用户中断
trap "echo ''; echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
