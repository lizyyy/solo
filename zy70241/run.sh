#!/bin/bash

echo "========================================"
echo "净水站滤芯寿命预测器 - 启动脚本"
echo "========================================"

echo ""
echo "[1/4] 检查 Python 环境..."
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 python3，请先安装 Python 3.8+"
    exit 1
fi

echo ""
echo "[2/4] 安装依赖..."
pip install -r requirements.txt -q

echo ""
echo "[3/4] 初始化数据（首次运行）..."
if [ ! -f "water_filter.db" ]; then
    python init_data.py
else
    echo "数据库已存在，跳过初始化"
    echo "如需重新初始化，请删除 water_filter.db 文件"
fi

echo ""
echo "[4/4] 启动服务..."
echo ""
echo "访问地址: http://localhost:8000"
echo "API文档: http://localhost:8000/docs"
echo "健康检查: http://localhost:8000/health"
echo ""
echo "按 Ctrl+C 停止服务"
echo "========================================"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
