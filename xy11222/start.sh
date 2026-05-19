#!/bin/bash

echo "=== 门店品控系统启动 ==="
echo ""

echo "1. 检查Python环境..."
python3 --version
echo ""

echo "2. 安装依赖..."
pip3 install -r requirements.txt
echo ""

echo "3. 启动服务..."
echo "服务地址: http://localhost:8000"
echo "API文档: http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

python3 main.py
