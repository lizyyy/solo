#!/bin/bash

echo "=========================================="
echo "  接口灰度回放校验系统 - 快速启动"
echo "=========================================="
echo ""

if [ ! -d "venv" ]; then
    echo "📦 创建虚拟环境..."
    python3 -m venv venv
fi

echo "🔧 激活虚拟环境并安装依赖..."
source venv/bin/activate
pip install -r requirements.txt -q

if [ ! -f ".env" ]; then
    echo "📄 复制环境变量配置文件..."
    cp .env.example .env
fi

echo ""
echo "🚀 启动服务..."
echo "📚 API 文档: http://localhost:8000/docs"
echo "🔴 按 Ctrl+C 停止服务"
echo ""

python main.py
