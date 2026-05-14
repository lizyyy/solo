#!/bin/bash

echo "=========================================="
echo "  图片转码任务控制台 - 后端启动脚本"
echo "=========================================="
echo ""

cd backend

if [ ! -d "venv" ]; then
    echo "📦 创建Python虚拟环境..."
    python3 -m venv venv
    echo "✅ 虚拟环境创建完成"
fi

echo "🔧 激活虚拟环境..."
source venv/bin/activate

echo "📚 安装依赖..."
pip install -r requirements.txt

echo ""
echo "🚀 启动后端服务..."
echo "📄 API文档: http://localhost:8000/docs"
echo ""

uvicorn main:app --reload --host 0.0.0.0 --port 8000
