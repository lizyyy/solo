#!/bin/bash

echo "========================================"
echo "  Webhook 顺序保证 API - 一键启动"
echo "========================================"
echo ""

JAVA_CMD=""
if command -v java &> /dev/null; then
    JAVA_CMD="java"
elif command -v /usr/bin/java &> /dev/null; then
    JAVA_CMD="/usr/bin/java"
fi

if [ -z "$JAVA_CMD" ]; then
    echo "❌ 未找到 Java 运行环境"
    echo "请安装 JDK 8 或更高版本"
    exit 1
fi

echo "✅ 找到 Java: $JAVA_CMD"
$JAVA_CMD -version 2>&1 | head -n 1
echo ""

cd "$(dirname "$0")"

echo "📦 编译 WebhookServer..."
mkdir -p out
javac -d out standalone/WebhookServer.java 2>&1

if [ $? -ne 0 ]; then
    echo "❌ 编译失败"
    exit 1
fi

echo "✅ 编译成功"
echo ""
echo "🚀 启动服务器 (端口 8080)..."
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""
echo "新开终端运行: ./test_standalone.sh 执行完整测试"
echo "========================================"
echo ""

cd out && $JAVA_CMD standalone.WebhookServer
