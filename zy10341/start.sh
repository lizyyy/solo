#!/bin/bash
# Schema 注册审批 API 启动脚本
# 使用 Maven Wrapper（已内置在项目中）

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
MVN_CMD="$PROJECT_DIR/mvnw"

echo "============================================"
echo "Schema 注册审批 API 启动脚本"
echo "============================================"

# 检查 Java
echo ""
echo "检查 Java 环境..."
if ! command -v java &> /dev/null; then
    echo "错误: 未找到 Java，请先安装 Java 8 JDK 或更高版本"
    exit 1
fi
JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}')
echo "Java 版本: $JAVA_VERSION"

# 检查是否有 javac 编译器
if ! command -v javac &> /dev/null; then
    echo ""
    echo "警告: 未找到 javac 编译器，当前可能是 JRE 而不是 JDK"
    echo "如果编译失败，请安装 JDK（Java Development Kit）"
fi

# 检查 Maven Wrapper
echo ""
echo "检查 Maven Wrapper..."
if [ ! -f "$PROJECT_DIR/.mvn/wrapper/maven-wrapper.jar" ]; then
    echo "错误: 找不到 maven-wrapper.jar"
    exit 1
fi
echo "Maven Wrapper 就绪"

# 编译项目
echo ""
echo "============================================"
echo "开始编译项目..."
echo "============================================"
cd "$PROJECT_DIR"
$MVN_CMD clean compile -DskipTests -q

echo ""
echo "编译成功！"

# 启动项目
echo ""
echo "============================================"
echo "启动 Schema 注册审批 API..."
echo "============================================"
echo "服务地址: http://localhost:8080"
echo "H2 控制台: http://localhost:8080/h2-console"
echo "按 Ctrl+C 停止服务"
echo "============================================"
echo ""

cd "$PROJECT_DIR"
$MVN_CMD spring-boot:run
