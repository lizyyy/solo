#!/bin/bash

echo "🎉 婚礼物料归还 API 启动脚本"
echo "=============================="

echo ""
echo "📦 检查依赖..."
python3 -c "import fastapi; import uvicorn; import sqlalchemy; import pydantic; print('✅ 依赖检查通过')" 2>/dev/null || pip3 install fastapi uvicorn sqlalchemy pydantic requests python-multipart

echo ""
echo "🚀 启动服务..."
echo "📖 API 文档地址: http://localhost:8000/docs"
echo "💾 数据库文件: wedding_materials.db"
echo ""

uvicorn main:app --reload --host 0.0.0.0 --port 8000