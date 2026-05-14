#!/bin/bash

echo "=== API密钥轮换中心 ==="
echo ""

echo "检查Python环境..."
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3"
    exit 1
fi

echo "创建虚拟环境..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

echo "激活虚拟环境并安装依赖..."
source venv/bin/activate
pip install -q -r requirements.txt

echo ""
echo "启动后端服务..."
echo "服务地址: http://localhost:5000"
echo "前端页面: 直接打开 index.html 文件"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

cd backend
python app.py
