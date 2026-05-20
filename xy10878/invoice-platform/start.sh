#!/bin/bash
# 用量计费发票台 - 启动脚本

echo "======================================="
echo "    用量计费发票台 - 启动脚本"
echo "======================================="
echo ""

cd "$(dirname "$0")"

# 创建exports目录
mkdir -p exports

# 检查Python环境
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到 python3，请先安装 Python"
    exit 1
fi

# 检查并安装依赖
echo "📦 检查依赖..."
cd backend
if [ ! -d "venv" ]; then
    echo "   创建虚拟环境..."
    python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt
echo "   ✓ 依赖已安装"

# 初始化测试数据
echo ""
echo "🧪 初始化测试数据..."
python init_test_data.py

echo ""
echo "🚀 启动后端服务..."
echo "   API地址: http://localhost:8000"
echo "   API文档: http://localhost:8000/docs"
echo ""
echo "📱 前端页面: 请用浏览器打开 ../frontend/index.html"
echo ""
echo "按 Ctrl+C 停止服务"
echo "======================================="
echo ""

uvicorn main:app --reload --host 0.0.0.0 --port 8000
