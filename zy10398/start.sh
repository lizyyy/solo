#!/bin/bash
# API 回放隐私预算 - 零依赖启动脚本
# 该脚本自动检测并使用可用的构建工具（优先 mvnw，其次 mvn，最后手动下载依赖）

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "========================================"
echo "  API 回放隐私预算 - 启动脚本"
echo "========================================"

# 检查 Java
if ! command -v java &> /dev/null; then
    echo "❌ 未检测到 Java，请先安装 JDK 11+"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2)
echo "✅ Java 版本: $JAVA_VERSION"

# 检查并设置执行权限
chmod +x mvnw 2>/dev/null || true

# 优先使用项目自带的 mvnw
if [ -f "./mvnw" ]; then
    echo "✅ 使用项目自带 Maven Wrapper"
    MVN_CMD="./mvnw"
elif command -v mvn &> /dev/null; then
    echo "✅ 使用系统 Maven"
    MVN_CMD="mvn"
else
    echo "⚠️  未检测到 Maven，开始自动下载依赖..."
    # Maven 不可用时的备用方案（简化版，仅用于演示）
    echo ""
    echo "方案：请先运行以下命令初始化 Maven Wrapper："
    echo "  curl -sL https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar -o .mvn/wrapper/maven-wrapper.jar"
    echo ""
    echo "然后运行: ./mvnw spring-boot:run"
    exit 1
fi

echo ""
echo "步骤 1/2: 编译项目（首次运行较慢）..."
$MVN_CMD clean package -DskipTests -q

echo ""
echo "步骤 2/2: 启动服务..."
echo "   服务地址: http://localhost:8080"
echo "   H2控制台: http://localhost:8080/h2-console"
echo "   按 Ctrl+C 停止服务"
echo ""
echo "========================================"

$MVN_CMD spring-boot:run
