#!/bin/bash

echo "========================================"
echo "  隐患闭环管理系统 - 启动脚本"
echo "========================================"

echo ""
echo "检查Python环境..."
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3，请先安装Python"
    exit 1
fi

echo ""
echo "安装依赖包..."
pip3 install -r requirements.txt

echo ""
echo "创建必要的目录..."
mkdir -p data/imports data/exports data/reports logs app/__pycache__

echo ""
echo "启动FastAPI服务..."
echo "服务地址: http://localhost:8000"
echo "API文档: http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
