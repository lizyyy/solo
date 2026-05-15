#!/bin/bash

cd "$(dirname "$0")"

echo "====================================="
echo "跨服务补偿指令 API - 启动脚本"
echo "====================================="

JAVA_CMD=""
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F'"' '{print $2}' | cut -d'.' -f1,2)
    echo "检测到 Java 版本: $JAVA_VERSION"
    JAVA_CMD="java"
elif [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    JAVA_VERSION=$("$JAVA_HOME/bin/java" -version 2>&1 | head -n 1 | awk -F'"' '{print $2}' | cut -d'.' -f1,2)
    echo "检测到 JAVA_HOME 中的 Java 版本: $JAVA_VERSION"
    JAVA_CMD="$JAVA_HOME/bin/java"
else
    echo "❌ 未找到 Java 环境，请先安装 JDK 8 或更高版本"
    exit 1
fi

if [ ! -d "target/classes" ]; then
    echo ""
    echo "⚠️  target/classes 目录不存在，需要编译"
    echo ""
    if command -v mvn &> /dev/null; then
        echo "检测到 Maven，开始编译..."
        mvn clean compile -DskipTests
        if [ $? -ne 0 ]; then
            echo "❌ 编译失败"
            exit 1
        fi
    else
        echo "❌ 未找到 Maven，请执行以下步骤："
        echo ""
        echo "方案 1: 安装 Maven"
        echo "  brew install maven  # Mac"
        echo "  apt install maven   # Linux"
        echo ""
        echo "方案 2: 使用 Maven Wrapper (推荐)"
        echo "  mvn wrapper:wrapper"
        echo "  ./mvnw clean compile"
        exit 1
    fi
fi

if [ ! -f "target/dependency" ]; then
    echo "正在下载依赖..."
    if command -v mvn &> /dev/null; then
        mvn dependency:copy-dependencies -q
    else
        echo "⚠️  未找到 Maven，尝试直接启动（可能失败）"
    fi
fi

echo ""
echo "正在启动服务..."
echo "====================================="

CLASSPATH="target/classes"
if [ -d "target/dependency" ]; then
    for jar in target/dependency/*.jar; do
        CLASSPATH="$CLASSPATH:$jar"
    done
fi

echo "启动中..."
echo "访问地址: http://localhost:8080/api/v1/compensation"
echo "H2控制台: http://localhost:8080/h2-console"
echo "按 Ctrl+C 停止服务"
echo "====================================="

$JAVA_CMD -cp "$CLASSPATH" com.compensation.CompensationApplication
