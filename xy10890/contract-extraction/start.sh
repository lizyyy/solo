#!/bin/bash

echo "=== 合同条款抽取系统 启动脚本 ==="

echo ""
echo "检查Python环境..."
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3，请先安装Python"
    exit 1
fi

echo ""
echo "安装后端依赖..."
cd backend
pip3 install -r requirements.txt -q
if [ $? -ne 0 ]; then
    echo "错误: 依赖安装失败"
    exit 1
fi
echo "依赖安装完成"

echo ""
echo "创建必要的目录..."
mkdir -p uploads exports
echo "目录创建完成"

echo ""
echo "启动后端服务 (端口: 8000)..."
echo "API文档地址: http://localhost:8000/docs"
echo ""
echo "前端请直接在浏览器打开: frontend/index.html"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8000
