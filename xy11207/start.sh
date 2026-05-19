#!/bin/bash

echo "社区药房冷链药品管理系统启动中..."

if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

echo "激活虚拟环境并安装依赖..."
source venv/bin/activate
pip install -r requirements.txt

echo "创建必要目录..."
mkdir -p data/uploads data/exports

echo "启动服务..."
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
