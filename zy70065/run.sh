#!/bin/bash

echo "========================================"
echo "  图书预约取书 API 系统"
echo "========================================"

cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "正在创建虚拟环境..."
    python3 -m venv venv
    source venv/bin/activate
    echo "正在安装依赖..."
    pip install -q -r requirements.txt
else
    source venv/bin/activate
fi

echo ""
echo "启动服务器..."
echo "接口文档: http://localhost:8000/docs"
echo "ReDoc:    http://localhost:8000/redoc"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
