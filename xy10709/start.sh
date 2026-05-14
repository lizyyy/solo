#!/bin/bash

echo "🚀 启动文件上传扫描流水线"

echo ""
echo "📦 检查后端依赖..."
cd backend
if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt

echo ""
echo "🗄️  初始化数据库..."
python init_data.py

echo ""
echo "🌐 启动后端服务 (端口 8000)..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo ""
echo "📦 检查前端依赖..."
cd ../frontend
npm install

echo ""
echo "🎨 启动前端服务 (端口 3000)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 服务启动完成!"
echo "📊 前端地址: http://localhost:3000"
echo "📚 API 文档: http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止服务"

wait $BACKEND_PID $FRONTEND_PID
