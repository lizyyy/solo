#!/bin/bash
# 接口降级演练服务启动脚本

set -e

echo "========================================"
echo "  接口降级演练服务启动脚本"
echo "========================================"

# 检查Java环境
if command -v java >/dev/null 2>&1; then
    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1-2)
    echo "✓ 检测到Java版本: $JAVA_VERSION"
else
    echo "✗ 未检测到Java环境，请先安装JDK 1.8或更高版本"
    exit 1
fi

# 检查Maven环境
if command -v mvn >/dev/null 2>&1; then
    MAVEN_BIN="mvn"
    echo "✓ 检测到系统Maven"
elif [ -x "./mvnw" ]; then
    MAVEN_BIN="./mvnw"
    echo "✓ 使用项目内Maven wrapper"
else
    echo "⚠ 未检测到Maven，尝试查找..."
    if [ -x "/usr/local/bin/mvn" ]; then
        MAVEN_BIN="/usr/local/bin/mvn"
        echo "✓ 检测到/usr/local/bin/mvn"
    elif [ -x "/opt/homebrew/bin/mvn" ]; then
        MAVEN_BIN="/opt/homebrew/bin/mvn"
        echo "✓ 检测到/opt/homebrew/bin/mvn"
    else
        echo "✗ 未找到Maven，请先安装Maven 3.6或更高版本"
        echo "  macOS: brew install maven"
        echo "  Linux: sudo apt install maven"
        exit 1
    fi
fi

# 创建数据目录
mkdir -p data
echo "✓ 数据目录准备完成"

# 编译并启动服务
echo ""
echo "开始编译并启动服务..."
echo "服务端口: 8080"
echo "停止服务请按: Ctrl+C"
echo ""

chmod +x mvnw 2>/dev/null || true

$MAVEN_BIN spring-boot:run \
    -Dspring-boot.run.profiles=default \
    -DskipTests
