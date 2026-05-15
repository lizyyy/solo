#!/bin/bash

echo "启动重放结果比对器后端服务..."

if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "安装依赖..."
pip install -r requirements.txt

echo "启动服务..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
