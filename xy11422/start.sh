#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== 二手车整备重试补偿队列服务 ==="
echo ""

echo "正在下载依赖..."
go mod download

if [ $? -ne 0 ]; then
    echo "依赖下载失败"
    exit 1
fi

echo ""
echo "正在编译..."
go build -o used-car-retry-queue .

if [ $? -ne 0 ]; then
    echo "编译失败"
    exit 1
fi

echo ""
echo "启动服务..."
echo "服务地址: http://localhost:8080"
echo "API文档请查看 API.md"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

./used-car-retry-queue
