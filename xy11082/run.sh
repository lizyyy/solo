#!/bin/bash

set -e

echo "=========================================="
echo "  中药代煎房代煎处方排队系统"
echo "=========================================="
echo ""

if [ ! -d "venv" ]; then
    echo "正在创建虚拟环境..."
    python3 -m venv venv
    echo "虚拟环境创建完成"
fi

echo "正在激活虚拟环境并安装依赖..."
source venv/bin/activate
pip install -q -r requirements.txt
echo "依赖安装完成"

echo ""
echo "正在初始化样例数据..."
python sample_data.py

echo ""
echo "=========================================="
echo "  启动选项"
echo "=========================================="
echo "1) 运行所有规则验证测试"
echo "2) 启动 API 服务器 (http://localhost:8000)"
echo "3) 同时运行测试和启动服务器"
echo ""
read -p "请选择选项 (1-3): " choice

case $choice in
    1)
        echo ""
        echo "正在运行规则验证测试..."
        python test_queue_rules.py
        ;;
    2)
        echo ""
        echo "正在启动 API 服务器..."
        echo "API 文档: http://localhost:8000/docs"
        echo "按 Ctrl+C 停止服务器"
        uvicorn main:app --reload
        ;;
    3)
        echo ""
        echo "正在运行规则验证测试..."
        python test_queue_rules.py
        echo ""
        echo "正在启动 API 服务器..."
        echo "API 文档: http://localhost:8000/docs"
        echo "按 Ctrl+C 停止服务器"
        uvicorn main:app --reload
        ;;
    *)
        echo "无效选项"
        exit 1
        ;;
esac
