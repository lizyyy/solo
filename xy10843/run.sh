#!/bin/bash

echo "安装依赖..."
pip install -r requirements.txt

echo "启动服务..."
cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000