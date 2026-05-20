#!/bin/bash

echo "安装依赖..."
pip3 install -r requirements.txt

echo ""
echo "启动服务..."
python3 main.py
