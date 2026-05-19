#!/bin/bash

echo "======================================"
echo "  仓库夜班排班管理系统启动脚本"
echo "======================================"

echo ""
echo "检查 Python 环境..."
python3 --version

echo ""
echo "安装依赖..."
pip3 install -r requirements.txt

echo ""
echo "启动服务..."
echo "API 文档: http://localhost:8000/docs"
echo "健康检查: http://localhost:8000/health"
echo ""

python3 main.py
