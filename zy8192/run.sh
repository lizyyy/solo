#!/bin/bash

cd "$(dirname "$0")"

echo "麻醉病例复盘工具"
echo "=================="

if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到 python3，请先安装 Python 3.8+"
    exit 1
fi

echo "检查依赖..."
pip3 show PyYAML > /dev/null 2>&1 || {
    echo "正在安装依赖..."
    pip3 install -r requirements.txt
}

echo "启动应用..."
python3 main.py
