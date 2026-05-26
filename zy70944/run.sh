#!/bin/bash

echo "=============================================="
echo "   装修申请处理系统 - 启动脚本"
echo "=============================================="
echo ""

if [ ! -f "property.db" ]; then
    echo "📦 首次运行，正在安装依赖..."
    pip install -r requirements.txt -q
    echo ""
    echo "🗂️ 正在初始化示例数据..."
    python init_data.py
else
    echo "✅ 数据库已存在，跳过初始化"
    echo "   如需重新初始化，请删除 property.db 文件后运行此脚本"
fi

echo ""
echo "🚀 正在启动服务..."
echo "   API文档: http://localhost:8000/docs"
echo "   按 Ctrl+C 停止服务"
echo ""

uvicorn main:app --reload --host 0.0.0.0 --port 8000
