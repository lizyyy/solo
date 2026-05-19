#!/bin/bash

echo "====================================="
echo "    社区药房库存管理系统启动脚本"
echo "====================================="
echo ""

if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

echo "激活虚拟环境..."
source venv/bin/activate

echo "安装依赖..."
pip install fastapi uvicorn sqlalchemy pydantic pydantic-settings python-multipart pandas openpyxl python-jose passlib python-dotenv

echo ""
echo "启动服务..."
echo "API文档地址: http://localhost:8000/docs"
echo ""
echo "默认账号:"
echo "  admin / admin123 (管理员)"
echo "  keeper / keeper123 (库管员)"
echo "  reviewer / reviewer123 (复核员)"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
