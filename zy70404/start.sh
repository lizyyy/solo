#!/bin/bash
set -e

echo "========================================="
echo "  批量账号冻结后端服务 - 一键启动"
echo "========================================="
echo ""

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# 检查 JAR 是否存在，不存在则编译
JAR_FILE="$PROJECT_DIR/target/batch-account-freeze-standalone-1.0.0.jar"
if [ ! -f "$JAR_FILE" ]; then
    echo "📦 JAR 不存在，正在编译..."
    if [ ! -d "$PROJECT_DIR/out" ]; then
        mkdir -p "$PROJECT_DIR/out"
    fi
    javac -d "$PROJECT_DIR/out" "$PROJECT_DIR/standalone/StandaloneServer.java"
    
    cd "$PROJECT_DIR/out"
    echo 'Main-Class: standalone.StandaloneServer' > MANIFEST.MF
    jar cfm "$JAR_FILE" MANIFEST.MF standalone/*.class
    cd "$PROJECT_DIR"
    
    echo "✅ JAR 构建完成: $JAR_FILE"
    echo ""
fi

# 停止已运行的服务
if pgrep -f "batch-account-freeze" > /dev/null; then
    echo "🛑 停止已运行的服务..."
    pkill -f "batch-account-freeze" 2>/dev/null || true
    sleep 1
fi

echo "🚀 启动服务..."
echo "   JAR 文件: $JAR_FILE"
echo "   服务地址: http://localhost:8080/api"
echo "   按 Ctrl+C 停止服务"
echo ""
echo "========================================"
echo ""

java -jar "$JAR_FILE"
