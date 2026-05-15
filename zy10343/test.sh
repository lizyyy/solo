#!/bin/bash

echo "========================================"
echo "  文件病毒扫描编排 API - 单元测试"
echo "========================================"
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# 检测 Java
echo "[1/4] 检测 Java 环境..."
if ! command -v java > /dev/null 2>&1; then
    echo "  ❌ 错误: 未找到 java 命令，请先安装 Java 8 或更高版本"
    exit 1
fi

JAVA_VERSION="$(java -version 2>&1 | head -n 1 | grep -Eo '"[0-9._]+"' | tr -d '"' | cut -d'.' -f1-2)"
echo "  ✅ Java 版本: $JAVA_VERSION"

# 检查 Maven Wrapper JAR
echo ""
echo "[2/4] 检查 Maven Wrapper..."
if [ ! -f "$PROJECT_DIR/.mvn/wrapper/maven-wrapper.jar" ]; then
    echo "  Maven Wrapper JAR 不存在，准备下载..."
    DOWNLOAD_URL="https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.1.0/maven-wrapper-3.1.0.jar"
    mkdir -p "$PROJECT_DIR/.mvn/wrapper"
    
    if command -v curl > /dev/null 2>&1; then
        curl -s -f -L -o "$PROJECT_DIR/.mvn/wrapper/maven-wrapper.jar" "$DOWNLOAD_URL"
    elif command -v wget > /dev/null 2>&1; then
        wget -q -O "$PROJECT_DIR/.mvn/wrapper/maven-wrapper.jar" "$DOWNLOAD_URL"
    else
        echo "  ❌ 错误: 未找到 curl 或 wget"
        exit 1
    fi
fi
echo "  ✅ Maven Wrapper 就绪"

# 运行测试
echo ""
echo "[3/4] 运行单元测试..."
echo "  首次运行可能需要几分钟下载依赖，请耐心等待..."
echo ""

if "$PROJECT_DIR/mvnw" test; then
    echo ""
    echo "========================================"
    echo "  ✅ 所有测试通过！"
    echo "========================================"
    exit 0
else
    echo ""
    echo "========================================"
    echo "  ❌ 有测试失败，请检查错误信息"
    echo "========================================"
    exit 1
fi