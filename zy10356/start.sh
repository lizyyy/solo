#!/bin/bash

echo "=========================================="
echo "  特征开关命中审计 API - 启动脚本"
echo "=========================================="
echo ""

PROJECT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$PROJECT_DIR"

# 检查 Java 版本
check_java_version() {
    if ! command -v java &> /dev/null; then
        echo "❌ 未找到 Java 命令，请先安装 JDK 17+"
        exit 1
    fi

    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F'"' '{print $2}' | cut -d'.' -f1)
    echo "ℹ️  检测到 Java 版本: $JAVA_VERSION"

    if [ "$JAVA_VERSION" -lt 17 ]; then
        echo ""
        echo "⚠️  警告: 当前 Java 版本低于 17，Spring Boot 3.x 需要 Java 17+"
        echo "   请升级 Java 或使用以下方式之一:"
        echo "   1. export JAVA_HOME=/path/to/jdk-17"
        echo "   2. 安装 Temurin JDK 17: https://adoptium.net/"
        echo ""
        read -p "是否继续尝试启动? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# 尝试使用 Maven Wrapper 或系统 Maven
build_and_run() {
    if [ -f "mvnw" ]; then
        echo "📦 使用 Maven Wrapper 编译..."
        chmod +x mvnw
        ./mvnw spring-boot:run
    elif command -v mvn &> /dev/null; then
        echo "📦 使用系统 Maven 编译..."
        mvn spring-boot:run
    else
        echo ""
        echo "❌ 未找到 Maven 或 Maven Wrapper"
        echo "   请安装 Maven 或下载 mvnw 脚本:"
        echo "   https://maven.apache.org/wrapper/"
        exit 1
    fi
}

check_java_version
echo ""
echo "🚀 开始启动服务..."
echo "   服务启动后访问: http://localhost:8080"
echo "   H2数据库控制台: http://localhost:8080/h2-console"
echo ""
build_and_run
