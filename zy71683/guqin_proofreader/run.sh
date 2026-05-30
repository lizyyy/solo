#!/bin/bash
set -e
cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt -q

if [ ! -f "guqin_proofreader.db" ]; then
    echo "初始化样例数据..."
    python seed.py
else
    echo "数据库已存在，跳过样例数据初始化（如需重置，删除 guqin_proofreader.db 后重新运行）"
fi

echo "启动服务..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
