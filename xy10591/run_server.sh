#!/bin/bash

echo "=========================================="
echo "  农产品检测溯源 API - 启动脚本"
echo "=========================================="

if [ ! -d "venv" ]; then
    echo "📦 创建虚拟环境..."
    python3 -m venv venv
fi

echo "🔧 激活虚拟环境..."
source venv/bin/activate

echo "📦 安装依赖..."
pip install -r requirements.txt -q

if [ ! -f "data/db.json" ]; then
    echo ""
    echo "📊 暂无数据，是否生成样例数据？(y/n)"
    read -r choice
    if [ "$choice" = "y" ] || [ "$choice" = "Y" ]; then
        echo "🗂️  生成样例数据..."
        python3 sample_data.py << EOF
y
EOF
    fi
fi

echo ""
echo "🚀 启动 API 服务..."
echo ""
echo "📖 文档地址: http://127.0.0.1:8000/docs"
echo "🔍 健康检查: http://127.0.0.1:8000/health"
echo "📊 状态概览: http://127.0.0.1:8000/status"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
