#!/bin/bash

cd "$(dirname "$0")"

echo "=== 任务取消传播 API 服务启动 ==="
echo ""

if [ ! -f "requirements_installed.txt" ]; then
    echo "正在安装依赖..."
    pip install -r requirements.txt
    if [ $? -eq 0 ]; then
        touch requirements_installed.txt
        echo "依赖安装完成"
    else
        echo "依赖安装失败"
        exit 1
    fi
fi

echo ""
echo "启动 FastAPI 服务..."
echo "API 文档地址: http://localhost:8000/docs"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
