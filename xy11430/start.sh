#!/bin/bash

echo "正在启动学校实验室耗材异常回执状态机服务..."

if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "安装依赖..."
pip install -r requirements.txt

echo "启动服务..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
