#!/bin/bash

echo "=================================="
echo "  排污许可超标预警 API 启动脚本"
echo "=================================="
echo ""

if [ ! -d "venv" ]; then
    echo "[1/4] 创建虚拟环境..."
    python3 -m venv venv
fi

echo "[2/4] 激活虚拟环境..."
source venv/bin/activate

echo "[3/4] 安装依赖..."
pip install -q -r requirements.txt

echo "[4/4] 启动服务 (端口 8000)..."
echo ""
echo "API 文档: http://127.0.0.1:8000/docs"
echo "健康检查: http://127.0.0.1:8000/health"
echo ""

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
