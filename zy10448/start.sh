#!/bin/bash

echo "========================================"
echo "用量异常事故 API - 启动脚本"
echo "========================================"

if [ ! -f "requirements.txt" ]; then
    echo "错误: 找不到 requirements.txt 文件"
    exit 1
fi

echo ""
echo "检查 Python 虚拟环境..."
if [ -d "venv" ]; then
    echo "发现虚拟环境，激活中..."
    source venv/bin/activate
else
    echo "未找到虚拟环境，使用系统 Python"
fi

echo ""
echo "安装依赖包..."
pip install -q -r requirements.txt

if [ $? -ne 0 ]; then
    echo "警告: 依赖安装可能不完整"
fi

echo ""
echo "初始化样例数据..."
python sample_data.py

echo ""
echo "启动 API 服务器..."
echo "API 文档地址: http://127.0.0.1:8000/docs"
echo "按 Ctrl+C 停止服务器"
echo ""

python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
