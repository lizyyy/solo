#!/bin/bash

echo "=========================================="
echo "学校实验室耗材验收回放链路服务"
echo "=========================================="

if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

echo "激活虚拟环境..."
source venv/bin/activate

echo "安装依赖..."
pip install -r requirements.txt

echo "启动服务..."
python main.py
