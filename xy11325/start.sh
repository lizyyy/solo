#!/bin/bash
echo "========================================"
echo "  农机合作社财务管理系统"
echo "========================================"
echo ""
echo "正在安装依赖..."
pip install -r requirements.txt
echo ""
echo "启动服务..."
python main.py
