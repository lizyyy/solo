#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  环境音素材检索系统 - 后端启动脚本"
echo "=========================================="

PYTHON_CMD="python3"

if ! command -v $PYTHON_CMD &> /dev/null; then
    echo "错误: 未找到 Python 3"
    exit 1
fi

echo ""
echo "检查依赖..."
if [ ! -f "requirements.txt" ]; then
    echo "错误: 未找到 requirements.txt"
    exit 1
fi

$PYTHON_CMD -c "import fastapi, uvicorn, sqlalchemy, pydantic, pandas, openpyxl, ulid" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "安装 Python 依赖..."
    $PYTHON_CMD -m pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "错误: 依赖安装失败"
        exit 1
    fi
fi

echo ""
echo "初始化数据库..."
$PYTHON_CMD scripts/init_db.py
if [ $? -ne 0 ]; then
    echo "警告: 数据库初始化可能存在问题，但继续启动..."
fi

echo ""
echo "插入测试数据 (可选)..."
read -p "是否插入测试数据? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    $PYTHON_CMD scripts/seed_data.py
fi

echo ""
echo "启动 FastAPI 服务器..."
echo "API 文档: http://localhost:8000/docs"
echo "按 Ctrl+C 停止服务器"
echo ""

$PYTHON_CMD -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
