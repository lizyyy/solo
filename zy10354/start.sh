#!/bin/bash

cd "$(dirname "$0")"

echo "========================================"
echo "  接口迁移双写比对 API 启动脚本"
echo "========================================"
echo ""

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
echo "检测到 Java 版本: $JAVA_VERSION"

if [ "$JAVA_VERSION" -lt 8 ]; then
    echo "错误: 需要 Java 8 或更高版本"
    exit 1
fi

if command -v mvn &> /dev/null; then
    echo "检测到 Maven，开始编译..."
    mvn clean package -DskipTests -q
    if [ $? -ne 0 ]; then
        echo "编译失败，尝试使用已有的 jar 包..."
    fi
else
    echo "未检测到 Maven，尝试使用已有的 jar 包..."
fi

JAR_FILE=$(ls target/dual-write-compare-api-*.jar 2>/dev/null | head -n 1)

if [ -z "$JAR_FILE" ] || [ ! -f "$JAR_FILE" ]; then
    echo ""
    echo "========================================"
    echo "  未找到可执行 jar 文件"
    echo "  请先运行: mvn clean package -DskipTests"
    echo "========================================"
    exit 1
fi

echo "使用 jar 文件: $JAR_FILE"
echo ""
echo "启动服务中..."
echo "服务地址: http://localhost:8080"
echo "健康检查: http://localhost:8080/actuator/health"
echo "按 Ctrl+C 停止服务"
echo ""
echo "========================================"

java -jar "$JAR_FILE"
