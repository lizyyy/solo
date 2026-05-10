#!/bin/bash

echo "=================================="
echo "  内部包版本废弃管理系统"
echo "=================================="

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "请先安装 Python 3"
    exit 1
fi

# 安装依赖
echo ""
echo "正在检查并安装依赖..."
pip3 install -q -r requirements.txt
if [ $? -ne 0 ]; then
    echo "依赖安装失败"
    exit 1
fi

# 启动服务
echo ""
echo "正在启动服务，示例数据已自动加载..."
echo ""
echo "系统访问地址："
echo "  API 文档: http://localhost:8000/docs"
echo "  健康检查: http://localhost:8000/health"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

python3 app.py
