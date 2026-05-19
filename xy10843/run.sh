#!/bin/bash

echo "检测 Python 环境..."
if command -v python3 &> /dev/null; then
    PYTHON=python3
    PIP=pip3
elif command -v python &> /dev/null; then
    PYTHON=python
    PIP=pip
else
    echo "错误: 未找到 Python，请先安装 Python"
    exit 1
fi

echo "安装依赖..."
$PIP install -r requirements.txt

echo "启动服务..."
cd backend && $PYTHON -m uvicorn main:app --reload --host 0.0.0.0 --port 8000