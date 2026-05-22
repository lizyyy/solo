#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "============================================"
echo "乡镇药房近效期验收回放链路 API"
echo "============================================"

if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "安装依赖..."
pip install -q -r requirements.txt

if [ ! -f "data/pharmacy_audit.db" ]; then
    echo "初始化数据库..."
    python scripts/init_db.py
fi

echo ""
echo "启动服务..."
echo "API文档: http://localhost:8000/docs"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
