#!/bin/bash

echo "=== 门诊服务台陪检调度系统 ==="
echo ""

# 检查 Python 是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到 Python3，请先安装 Python 3.8+"
    exit 1
fi

# 检查依赖是否安装
echo "📦 检查依赖..."
if [ ! -d "venv" ]; then
    echo "   创建虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
echo "   安装/更新依赖..."
pip install -q -r requirements.txt

echo ""
echo "🚀 启动服务..."
echo "   API 文档: http://localhost:8000/docs"
echo "   健康检查: http://localhost:8000/health"
echo ""
echo "   按 Ctrl+C 停止服务"
echo ""

# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000