#!/bin/bash

echo "=========================================="
echo "  实时指标迟到修正服务 - 启动脚本"
echo "=========================================="
echo ""

if [ ! -d "venv" ]; then
    echo "未检测到虚拟环境，正在创建..."
    python3 -m venv venv
    echo "虚拟环境创建完成"
    echo ""
fi

echo "激活虚拟环境..."
source venv/bin/activate

echo ""
echo "安装依赖..."
pip install -q -r requirements.txt

echo ""
echo "启动服务..."
echo "  - 服务地址: http://localhost:8000"
echo "  - API文档: http://localhost:8000/docs"
echo "  - 健康检查: http://localhost:8000/health"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
