#!/bin/bash

echo "安装Python依赖..."
pip install -r requirements.txt

echo "启动FastAPI服务..."
cd app && python main.py
