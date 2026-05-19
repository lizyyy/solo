#!/bin/bash

echo "========================================"
echo "  换电运营工单系统 - 启动脚本"
echo "========================================"

echo ""
echo "检查 Python 环境..."
python3 --version

echo ""
echo "安装依赖..."
pip3 install -r requirements.txt

echo ""
echo "启动服务..."
echo "API文档地址: http://localhost:8000/docs"
echo "默认账号: admin / admin123"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload