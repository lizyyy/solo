#!/bin/bash
set -e

echo "========================================="
echo "  批量账号冻结后端服务 - 独立版启动器"
echo "  (零依赖，仅需 Java 环境)"
echo "========================================="
echo ""

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# 检查 Java
if ! command -v java &> /dev/null; then
    echo "❌ 未找到 Java，请先安装 JDK"
    exit 1
fi
echo "✅ Java 环境: $(java -version 2>&1 | head -n 1)"
echo ""

# 编译
echo "📝 编译独立版服务器..."
javac -d "$PROJECT_DIR/out" "$PROJECT_DIR/standalone/StandaloneServer.java"

if [ ! -f "$PROJECT_DIR/out/standalone/StandaloneServer.class" ]; then
    echo "❌ 编译失败"
    exit 1
fi
echo "✅ 编译完成"
echo ""

# 启动
echo "🚀 启动服务..."
echo "   服务地址: http://localhost:8080/api"
echo "   按 Ctrl+C 停止服务"
echo ""
echo "========================================="
echo ""

cd "$PROJECT_DIR/out"
java standalone.StandaloneServer
