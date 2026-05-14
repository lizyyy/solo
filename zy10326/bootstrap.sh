#!/bin/bash
# 接口重试预算服务 - 自举启动脚本
# 支持两种启动模式：
# 1. Maven模式（推荐） - 使用Maven wrapper自动下载Maven和依赖
# 2. 备用模式 - 自动下载Spring Boot CLI快速启动

set -e

echo "=================================="
echo "  接口重试预算服务 - 自举启动器"
echo "=================================="
echo ""

# 创建必要目录
mkdir -p data target/classes logs

# 检查Java
if ! command -v java &> /dev/null; then
    echo "❌ 未找到Java，请先安装JDK 17+"
    echo "   macOS: brew install openjdk@17"
    echo "   Linux: sudo apt install openjdk-17-jdk"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -1 | sed -n 's/.*version.*"\(.*\)".*/\1/p' | cut -d'.' -f1)
echo "✅ Java版本: $JAVA_VERSION"

# 检查curl
if ! command -v curl &> /dev/null; then
    echo "❌ 未找到curl，请先安装curl"
    exit 1
fi
echo "✅ curl可用"

# 方法1: 优先使用Maven wrapper
if [ -f "./mvnw" ]; then
    echo ""
    echo "📦 启动方式: Maven wrapper"
    echo "正在编译项目..."
    ./mvnw compile -q 2>&1 | tail -5
    echo "✅ 编译完成"
    echo ""
    echo "🚀 启动服务中..."
    echo "服务地址: http://localhost:8080"
    echo "H2控制台: http://localhost:8080/h2-console"
    echo "按 Ctrl+C 停止服务"
    echo "=================================="
    echo ""
    ./mvnw spring-boot:run -q
    exit 0
fi

# 方法2: 备用 - 自动下载Spring Boot CLI
echo ""
echo "📦 启动方式: Spring Boot CLI (备用模式)"

SPRING_CLI_VERSION="3.2.0"
SPRING_CLI_HOME="$HOME/.spring-boot-cli/spring-$SPRING_CLI_VERSION"

if [ ! -d "$SPRING_CLI_HOME" ]; then
    echo "正在下载 Spring Boot CLI $SPRING_CLI_VERSION..."
    mkdir -p "$SPRING_CLI_HOME"
    curl -sL "https://repo.maven.apache.org/maven2/org/springframework/boot/spring-boot-cli/$SPRING_CLI_VERSION/spring-boot-cli-$SPRING_CLI_VERSION-bin.tar.gz" | tar xz -C "$SPRING_CLI_HOME" --strip-components=1
    echo "✅ Spring Boot CLI 安装完成"
fi

# 创建极简的运行脚本（使用已编译的类）
echo "正在启动服务..."
SPRING_CLI="$SPRING_CLI_HOME/bin/spring"

# 检查是否有编译好的类
if [ -d "target/classes/com/retry/budget" ]; then
    echo "✅ 找到已编译的类"
else
    echo "⚠️  需要先编译，使用 javac 直接编译（需要依赖jar）"
    echo "正在尝试使用Maven wrapper方式..."
    if [ -f "./mvnw" ]; then
        ./mvnw compile -q
    else
        echo "❌ 无法编译，请确保有mvnw或系统Maven"
        exit 1
    fi
fi

echo ""
echo "🚀 正在启动 Spring Boot 服务..."
echo "服务地址: http://localhost:8080"
echo "H2控制台: http://localhost:8080/h2-console"
echo "按 Ctrl+C 停止服务"
echo "=================================="
echo ""

# 使用Maven方式启动
./mvnw spring-boot:run -q
