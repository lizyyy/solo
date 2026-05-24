#!/bin/bash
echo "安装依赖..."
pip install -r requirements.txt

echo "启动服务..."
python main.py
