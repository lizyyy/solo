#!/bin/bash

echo "======================================"
echo "  药企QA样品管理系统 - 启动脚本"
echo "======================================"

echo ""
echo "检查依赖是否已安装..."
if ! python -c "import fastapi, uvicorn, pandas" 2>/dev/null; then
    echo "正在安装依赖..."
    pip install -r requirements.txt
else
    echo "依赖已就绪"
fi

echo ""
echo "启动API服务..."
echo "API文档: http://localhost:8000/docs"
echo "按 Ctrl+C 停止服务"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0
