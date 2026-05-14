#!/bin/bash
# 接口重试预算服务 - 启动脚本

set -e

echo "=================================="
echo "  接口重试预算服务 - 启动脚本"
echo "=================================="
echo ""

# 创建必要目录
mkdir -p data target/classes logs

# ==================================
# 检查Java环境（更兼容的版本检测）
# ==================================
if ! command -v java &> /dev/null; then
    echo "❌ 未找到Java命令"
    echo ""
    echo "请先安装JDK 17或更高版本:"
    echo "  macOS: brew install openjdk@17"
    echo "  Linux: sudo apt install openjdk-17-jdk"
    exit 1
fi

# 获取Java版本（兼容多种输出格式）
JAVA_VERSION=$(java -version 2>&1 | head -1 | grep -Eo '[0-9]+' | head -1)
echo "✅ Java版本: $JAVA_VERSION"

# ==================================
# 检查curl
# ==================================
if ! command -v curl &> /dev/null; then
    echo "❌ 未找到curl，请先安装curl"
    exit 1
fi
echo "✅ curl可用"

# ==================================
# 选择启动方式
# ==================================
echo ""

# 方式1: 优先使用项目自带的mvnw
if [ -f "./mvnw" ]; then
    echo "📦 启动方式: 项目自带 Maven wrapper"
    echo ""
    echo "正在编译项目（首次运行需要下载依赖，可能需要几分钟）..."
    ./mvnw compile -q 2>&1 | tail -10 || {
        echo "⚠️ 编译输出（可能有警告）..."
    }
    echo "✅ 编译完成"
    echo ""
    echo "🚀 正在启动 Spring Boot 服务..."
    echo ""
    echo "访问地址:"
    echo "  主服务: http://localhost:8080"
    echo "  H2控制台: http://localhost:8080/h2-console"
    echo "  JDBC URL: jdbc:h2:file:./data/retry-budget-db"
    echo ""
    echo "按 Ctrl+C 停止服务"
    echo "=================================="
    echo ""
    ./mvnw spring-boot:run -q
    exit 0
fi

# 方式2: 系统Maven
if command -v mvn &> /dev/null; then
    echo "📦 启动方式: 系统 Maven"
    echo ""
    echo "正在编译项目..."
    mvn compile -q
    echo "✅ 编译完成"
    echo ""
    echo "🚀 启动服务中..."
    echo "服务地址: http://localhost:8080"
    echo "按 Ctrl+C 停止服务"
    echo "=================================="
    echo ""
    mvn spring-boot:run -q
    exit 0
fi

# 都没有，提示
echo ""
echo "❌ 未找到Maven，也没有mvnw"
echo ""
echo "请使用以下命令之一："
echo "  1. 安装Maven: brew install maven 或 sudo apt install maven"
echo "  2. 使用 ./bootstrap.sh （自动下载Maven wrapper）"
exit 1
