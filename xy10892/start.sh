#!/bin/bash

echo "======================================"
echo "  文档脱敏任务系统 - 启动脚本"
echo "======================================"

cd backend

if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

echo "激活虚拟环境并安装依赖..."
source venv/bin/activate
pip install -q -r requirements.txt

echo ""
echo "======================================"
echo "  后端服务启动中..."
echo "  API文档: http://localhost:8000/docs"
echo "======================================"
echo ""

uvicorn main:app --reload --host 0.0.0.0 --port 8000
