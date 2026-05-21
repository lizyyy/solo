#!/bin/bash

echo "=== 开发者访问申请台 ==="
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/backend"

echo "检查 Python 环境..."
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 python3，请先安装 Python 3.8+"
    exit 1
fi

echo ""
echo "安装 Python 依赖..."
pip3 install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败，请检查网络或 pip 配置"
    exit 1
fi

echo ""
echo "========================================"
echo "✅ 后端服务即将启动"
echo "📊 API 地址: http://localhost:8000"
echo "📚 API 文档: http://localhost:8000/docs"
echo "🌐 前端页面: $SCRIPT_DIR/frontend/index.html"
echo "⏰ 后台任务: 自动回收过期凭证（每分钟检查一次）"
echo "========================================"
echo ""

python3 main.py
