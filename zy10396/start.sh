#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           API 调用成本分摊服务 - 启动脚本                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

if [ ! -d "venv" ]; then
    echo "📦 创建虚拟环境..."
    python3 -m venv venv
fi

echo "🔧 激活虚拟环境..."
source venv/bin/activate

echo "📚 安装依赖..."
pip install -r requirements.txt -q

echo ""
echo "🚀 启动服务..."
echo ""
echo "🌐 管理面板: http://localhost:8000/admin"
echo "📚 API 文档: http://localhost:8000/docs"
echo "🔍 ReDoc:    http://localhost:8000/redoc"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

uvicorn app.main:app --reload
