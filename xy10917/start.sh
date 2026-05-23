#!/bin/bash

echo "=================================="
echo "  剧场座位保留 API 服务启动脚本"
echo "=================================="

echo ""
echo "检查 Python 环境..."
python3 --version

echo ""
echo "安装依赖..."
pip3 install -r requirements.txt

echo ""
echo "生成样例数据（可选）..."
read -p "是否重新生成样例数据? (y/n): " regenerate
if [ "$regenerate" = "y" ]; then
    python3 generate_sample_data.py
fi

echo ""
echo "启动 API 服务..."
echo "API 文档地址: http://127.0.0.1:8000/docs"
echo "按 Ctrl+C 停止服务"
echo ""

python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload