#!/bin/bash

echo "=========================================="
echo "  翻译记忆版本API - 启动脚本"
echo "=========================================="
echo ""

echo "检查Python环境..."
python3 --version

echo ""
echo "安装依赖..."
pip3 install -r requirements.txt

echo ""
echo "启动服务..."
echo "API文档地址: http://localhost:8000/docs"
echo "按 Ctrl+C 停止服务"
echo ""

uvicorn main:app --reload --host 0.0.0.0 --port 8000