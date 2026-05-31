#!/bin/bash

echo "========================================"
echo "  食堂备餐预测系统 - 后端启动脚本"
echo "========================================"
echo ""

cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "正在创建 Python 虚拟环境..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "创建虚拟环境失败，请检查 Python 是否安装正确"
        exit 1
    fi
    echo "虚拟环境创建完成"
    echo ""
fi

echo "激活虚拟环境..."
source venv/bin/activate

echo "检查依赖..."
pip install -r requirements.txt -q
if [ $? -ne 0 ]; then
    echo "依赖安装失败，请检查网络连接或 requirements.txt"
    exit 1
fi
echo "依赖检查完成"
echo ""

echo "========================================"
echo "  后端服务启动中..."
echo "  访问地址: http://localhost:8000"
echo "  API文档: http://localhost:8000/docs"
echo "========================================"
echo ""

python main.py
