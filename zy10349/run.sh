#!/bin/bash

echo "======================================"
echo "   Read-Write Split API - 启动脚本"
echo "======================================"
echo ""

echo "📦 下载依赖..."
go mod download

if [ $? -ne 0 ]; then
    echo "❌ 依赖下载失败"
    exit 1
fi

echo "✅ 依赖下载完成"
echo ""

echo "🚀 启动服务..."
echo "📝 服务地址: http://localhost:8080"
echo "🔍 健康检查: http://localhost:8080/health"
echo "📖 API 文档: 请参考 README.md"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

go run cmd/server/main.go
