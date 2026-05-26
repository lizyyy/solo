#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "==> 安装依赖..."
pip install -q -r requirements.txt

echo ""
echo "==> 启动服务 (端口 8000)..."
echo "    API 文档: http://localhost:8000/docs"
echo "    健康检查: http://localhost:8000/health"
echo ""
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
