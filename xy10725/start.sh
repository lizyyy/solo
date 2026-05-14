#!/bin/bash

echo "========================================"
echo "  支付沙箱对账台 - 启动脚本"
echo "========================================"
echo ""

echo "正在检查 Python 环境..."
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 python3，请先安装 Python"
    exit 1
fi

echo "✅ Python 环境正常"
echo ""

echo "正在进入后端目录..."
cd backend

echo "正在安装/检查依赖..."
pip3 install -q -r requirements.txt

echo ""
echo "========================================"
echo "  后端服务启动中..."
echo "  API 地址: http://localhost:8000"
echo "  API 文档: http://localhost:8000/docs"
echo "========================================"
echo ""
echo "前端使用说明:"
echo "  - 请在另一个终端中打开 frontend/index.html"
echo "  - 或使用: cd frontend && python3 -m http.server 8080"
echo "  - 然后访问: http://localhost:8080"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

python3 main.py
