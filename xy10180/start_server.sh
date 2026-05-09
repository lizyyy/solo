#!/bin/bash

set -e

echo "=============================================="
echo "  设备保养计划 API - 启动脚本"
echo "=============================================="

cd "$(dirname "$0")"

if [ -f "./maintenance.db" ]; then
    echo "清理旧数据库..."
    rm -f ./maintenance.db
fi

if [ ! -d "./venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

echo "激活虚拟环境..."
source venv/bin/activate

echo "安装依赖..."
pip install -q -r requirements.txt

echo "启动 API 服务..."
echo "服务地址: http://127.0.0.1:8000"
echo "API文档:   http://127.0.0.1:8000/docs"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

uvicorn main:app --host 127.0.0.1 --port 8000 --reload
