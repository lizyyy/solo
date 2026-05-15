#!/bin/bash
# 资源锁冲突解释 API - 离线验证脚本
# 无需 Maven/Spring Boot，直接使用 Java 8 运行

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src/standalone/java"
OUT_DIR="$SCRIPT_DIR/out/standalone"

echo "============================================================"
echo "  资源锁冲突解释 API - 离线验证工具"
echo "  Java 版本兼容，无需 Maven/Spring Boot"
echo "============================================================"
echo ""

echo "[1/3] 检查 Java 环境..."
if ! command -v java &> /dev/null; then
    echo "❌ 未找到 Java，请先安装 JDK"
    exit 1
fi
if ! command -v javac &> /dev/null; then
    echo "❌ 未找到 javac，请先安装完整 JDK"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F '"' '{print $2}' | cut -d'.' -f1-2)
echo "✅ Java 版本: $JAVA_VERSION"
echo ""

echo "[2/3] 编译源码..."
mkdir -p "$OUT_DIR"
javac -source 8 -target 8 -d "$OUT_DIR" "$SRC_DIR/com/example/lock/StandaloneLockVerifier.java"
echo "✅ 编译完成"
echo ""

echo "[3/3] 运行验证..."
echo "============================================================"
java -cp "$OUT_DIR" com.example.lock.StandaloneLockVerifier
echo ""
echo "✅ 验证完成！所有核心功能已验证"
