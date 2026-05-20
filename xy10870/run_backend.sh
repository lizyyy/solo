#!/bin/bash

cd "$(dirname "$0")"

echo "安装依赖..."
pip install -r backend/requirements.txt

echo ""
echo "初始化数据库..."
cd backend
python -c "from app.core.database import engine, Base; Base.metadata.create_all(bind=engine)"
python init_data.py

echo ""
echo "启动后端服务..."
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
