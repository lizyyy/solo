#!/bin/bash

echo "======================================"
echo "     OAuth 回调调试站 - 启动脚本"
echo "======================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}错误: 未找到 python3，请先安装 Python 3.8+${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Python 已安装"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未找到 node，请先安装 Node.js 16+${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js 已安装"

echo ""
echo "安装后端依赖..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
echo -e "${GREEN}✓${NC} 后端依赖安装完成"

echo ""
echo "安装前端依赖..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    npm install --silent
fi
echo -e "${GREEN}✓${NC} 前端依赖安装完成"

echo ""
echo "======================================"
echo "启动服务..."
echo "======================================"

# 启动后端（后台运行）
cd ../backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# 启动前端（后台运行）
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "======================================"
echo "服务启动完成！"
echo "======================================"
echo ""
echo -e "后端 API:    ${GREEN}http://localhost:8000${NC}"
echo -e "API 文档:    ${GREEN}http://localhost:8000/docs${NC}"
echo -e "前端页面:    ${GREEN}http://localhost:3000${NC}"
echo ""
echo "后端 PID: $BACKEND_PID"
echo "前端 PID: $FRONTEND_PID"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap "echo ''; echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '已停止'; exit" INT
wait
