#!/bin/bash
# 资源锁冲突解释 API - 独立HTTP服务器
# 零依赖！纯JDK 8内置HTTP服务器
# 无需Maven、无需Spring Boot、无需任何外部jar

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src/standalone/java"
OUT_DIR="$SCRIPT_DIR/out/standalone"

echo "============================================================"
echo "  \uD83D\uDD12 资源锁冲突解释 API - 独立服务器版本"
echo "  \u2728 零依赖！纯JDK 8内置HTTP服务器"
echo "============================================================"
echo ""

# 检查Java环境
echo "[1/3] 检查Java环境..."
if ! command -v java &> /dev/null; then
    echo "❌ 未找到 java 命令，请先安装JDK"
    exit 1
fi
if ! command -v javac &> /dev/null; then
    echo "❌ 未找到 javac 命令，请先安装完整JDK（不是JRE）"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1)
echo "✅ Java版本: $JAVA_VERSION"
echo ""

# 编译
echo "[2/3] 编译源代码..."
mkdir -p "$OUT_DIR"
javac -source 8 -target 8 -d "$OUT_DIR" -encoding UTF-8 \
    "$SRC_DIR/com/example/lock/StandaloneHttpServer.java"
echo "✅ 编译完成"
echo ""

# 运行
echo "[3/3] 启动HTTP服务器..."
echo "  服务地址: http://localhost:8080"
echo "  管理界面: http://localhost:8080/"
echo ""
echo "  按 Ctrl+C 停止服务"
echo "============================================================"
echo ""

cd "$OUT_DIR"
java com.example.lock.StandaloneHttpServer
