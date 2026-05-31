#!/bin/bash

cd "$(dirname "$0")"

echo "=========================================="
echo "  空压机能耗诊断系统 - 启动脚本"
echo "=========================================="
echo ""

if [ ! -d "venv" ]; then
    echo "检测到虚拟环境不存在，正在创建..."
    python3 -m venv venv
    echo "虚拟环境创建完成。"
    echo ""
fi

echo "激活虚拟环境..."
source venv/bin/activate

echo "检查并安装依赖..."
pip install -r requirements.txt -q

echo ""
echo "检查示例数据..."
if [ ! -f "data/sample_data_generated.flag" ]; then
    echo "首次运行，正在生成示例数据..."
    python3 generate_sample_data.py
    touch data/sample_data_generated.flag
    echo "示例数据生成完成。"
fi

echo ""
echo "启动服务..."
echo "服务地址: http://localhost:8000"
echo "API文档:   http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止服务"
echo "=========================================="
echo ""

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
