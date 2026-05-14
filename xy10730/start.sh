#!/bin/bash

echo "===================================="
echo "内部服务健康巡检系统 - 启动脚本"
echo "===================================="
echo ""

echo "检查Python环境..."
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到Python3，请先安装Python"
    exit 1
fi

echo "检查Node.js环境..."
if ! command -v node &> /dev/null; then
    echo "❌ 未找到Node.js，请先安装Node.js"
    exit 1
fi

echo ""
echo "1. 安装后端依赖..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt -q
echo "✅ 后端依赖安装完成"

echo ""
echo "2. 启动后端服务 (端口: 8000)..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"' && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"'
else
    gnome-terminal -- bash -c "cd $(pwd) && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
fi

echo "✅ 后端服务启动中..."

echo ""
echo "3. 安装前端依赖..."
cd ../frontend
npm install -q
echo "✅ 前端依赖安装完成"

echo ""
echo "4. 启动前端服务 (端口: 3000)..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"' && npm run dev"'
else
    gnome-terminal -- bash -c "cd $(pwd) && npm run dev"
fi

echo ""
echo "===================================="
echo "🎉 服务启动完成！"
echo ""
echo "后端API文档: http://localhost:8000/docs"
echo "前端访问地址: http://localhost:3000"
echo "===================================="
