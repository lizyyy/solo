#!/bin/bash

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASE_DIR"

echo "=========================================="
echo "  票据到期提醒系统"
echo "=========================================="
echo

PYTHON_BIN="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_BIN="python"
fi

echo "检查依赖..."
$PYTHON_BIN -c "import fastapi, uvicorn, sqlalchemy, pandas, openpyxl" 2>/dev/null || {
    echo "正在安装依赖..."
    $PYTHON_BIN -m pip install fastapi uvicorn sqlalchemy pydantic python-multipart pandas openpyxl xlsxwriter jinja2 python-dateutil
}

echo "创建数据目录..."
mkdir -p data/uploads data/exports data/sample_data

echo "生成示例数据..."
$PYTHON_BIN scripts/generate_sample_data.py

echo
echo "启动服务中..."
echo "=========================================="
echo "  服务地址: http://127.0.0.1:8000"
echo "  API文档:  http://127.0.0.1:8000/docs"
echo "  按 Ctrl+C 停止服务"
echo "=========================================="
echo

$PYTHON_BIN main.py
