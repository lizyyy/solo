#!/bin/bash

echo "======================================"
echo "  地铁站自动扶梯停梯复盘工具"
echo "  启动脚本"
echo "======================================"
echo ""

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "项目目录: $PROJECT_DIR"
echo ""

check_node() {
    if ! command -v node &> /dev/null; then
        echo "❌ 错误: 未找到 Node.js，请先安装 Node.js"
        exit 1
    fi
    echo "✅ Node.js 版本: $(node --version)"
}

check_npm() {
    if ! command -v npm &> /dev/null; then
        echo "❌ 错误: 未找到 npm，请先安装 npm"
        exit 1
    fi
    echo "✅ npm 版本: $(npm --version)"
}

install_dependencies() {
    echo ""
    echo "📦 检查并安装依赖..."
    
    if [ ! -d "$BACKEND_DIR/node_modules" ]; then
        echo "🔧 安装后端依赖..."
        cd "$BACKEND_DIR" && npm install
        if [ $? -ne 0 ]; then
            echo "❌ 后端依赖安装失败"
            exit 1
        fi
    else
        echo "✅ 后端依赖已存在"
    fi
    
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        echo "🔧 安装前端依赖..."
        cd "$FRONTEND_DIR" && npm install
        if [ $? -ne 0 ]; then
            echo "❌ 前端依赖安装失败"
            exit 1
        fi
    else
        echo "✅ 前端依赖已存在"
    fi
}

start_services() {
    echo ""
    echo "🚀 启动服务..."
    
    mkdir -p "$BACKEND_DIR/data"
    
    echo "🔧 启动后端服务 (端口 3000)..."
    cd "$BACKEND_DIR" && npm start &
    BACKEND_PID=$!
    
    sleep 3
    
    echo "🔧 启动前端服务 (端口 5173)..."
    cd "$FRONTEND_DIR" && npm run dev &
    FRONTEND_PID=$!
    
    echo ""
    echo "======================================"
    echo "  服务已启动!"
    echo "======================================"
    echo ""
    echo "🌐 前端地址: http://localhost:5173"
    echo "🔧 后端地址: http://localhost:3000"
    echo ""
    echo "📁 示例数据位于: $PROJECT_DIR/sample-data/"
    echo ""
    echo "按 Ctrl+C 停止所有服务"
    echo ""
    
    wait $BACKEND_PID $FRONTEND_PID
}

trap 'echo ""; echo "🛑 正在停止服务..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0' SIGINT SIGTERM

check_node
check_npm
install_dependencies
start_services
