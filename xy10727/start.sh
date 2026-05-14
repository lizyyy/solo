#!/bin/bash

echo "========================================"
echo "  地址解析纠偏服务启动脚本"
echo "========================================"

check_python() {
    if command -v python3 &> /dev/null; then
        echo "Python3 已安装"
        return 0
    else
        echo "错误: 未找到 Python3，请先安装 Python3"
        return 1
    fi
}

check_node() {
    if command -v node &> /dev/null; then
        echo "Node.js 已安装"
        return 0
    else
        echo "错误: 未找到 Node.js，请先安装 Node.js"
        return 1
    fi
}

setup_backend() {
    echo ""
    echo "设置后端环境..."
    cd backend
    
    if [ ! -d "venv" ]; then
        echo "创建虚拟环境..."
        python3 -m venv venv
    fi
    
    echo "激活虚拟环境并安装依赖..."
    source venv/bin/activate
    pip install -r requirements.txt
    
    cd ..
}

setup_frontend() {
    echo ""
    echo "设置前端环境..."
    cd frontend
    
    if [ ! -d "node_modules" ]; then
        echo "安装依赖..."
        npm install
    fi
    
    cd ..
}

start_backend() {
    echo ""
    echo "启动后端服务 (端口: 8000)..."
    cd backend
    source venv/bin/activate
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    echo "后端服务 PID: $BACKEND_PID"
    cd ..
}

start_frontend() {
    echo ""
    echo "启动前端服务 (端口: 3000)..."
    cd frontend
    npm run dev &
    FRONTEND_PID=$!
    echo "前端服务 PID: $FRONTEND_PID"
    cd ..
}

cleanup() {
    echo ""
    echo "正在停止服务..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo "后端服务已停止"
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        echo "前端服务已停止"
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

# 主程序
check_python || exit 1
check_node || exit 1

setup_backend
setup_frontend

start_backend
start_frontend

echo ""
echo "========================================"
echo "  服务启动完成！"
echo "  后端 API: http://localhost:8000"
echo "  API 文档: http://localhost:8000/docs"
echo "  前端页面: http://localhost:3000"
echo "========================================"
echo ""
echo "按 Ctrl+C 停止所有服务"

wait
