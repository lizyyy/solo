#!/bin/bash

echo "========================================"
echo "  法院卷宗借阅管理API系统 - 快速启动脚本"
echo "========================================"
echo ""

echo "步骤 1: 检查Python环境..."
python3 --version
if [ $? -ne 0 ]; then
    echo "错误: 未找到Python3，请先安装Python"
    exit 1
fi

echo ""
echo "步骤 2: 安装依赖..."
pip3 install -r requirements.txt

echo ""
echo "步骤 3: 启动服务..."
echo ""
echo "服务启动后，可访问以下地址："
echo "  - API文档: http://localhost:8000/docs"
echo "  - 健康检查: http://localhost:8000/api/health"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

uvicorn main:app --reload --host 0.0.0.0 --port 8000