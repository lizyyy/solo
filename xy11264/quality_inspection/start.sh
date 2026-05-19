#!/bin/bash

set -e

echo "======================================"
echo "     客服质检系统 - 启动脚本"
echo "======================================"
echo ""

if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

echo "激活虚拟环境..."
source venv/bin/activate

echo "安装依赖..."
pip install -r requirements.txt

echo ""
echo "======================================"
echo "启动服务..."
echo "API文档: http://localhost:8000/docs"
echo "======================================"
echo ""

cd "$(dirname "$0")"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
