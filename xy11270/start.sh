#!/bin/bash

echo "正在安装依赖..."
pip install -r requirements.txt

echo "启动服务..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
