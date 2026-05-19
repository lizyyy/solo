#!/bin/bash

echo "消防维保管理系统 - 本地启动脚本"
echo "=================================="

if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

echo "激活虚拟环境并安装依赖..."
source venv/bin/activate
pip install -r requirements.txt

echo ""
echo "生成测试数据..."
python generate_test_data.py

echo ""
echo "启动服务..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
