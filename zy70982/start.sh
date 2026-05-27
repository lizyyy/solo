#!/bin/bash

echo "市政运维对账服务启动中..."

if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

echo "激活虚拟环境..."
source venv/bin/activate

echo "安装依赖..."
pip install -r requirements.txt

echo "启动服务..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
