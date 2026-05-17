#!/bin/bash

echo "安装依赖..."
pip install -r requirements.txt

echo ""
echo "启动服务..."
echo "API文档将在: http://localhost:8000/docs"
echo "按 Ctrl+C 停止服务"
echo ""

python main.py
